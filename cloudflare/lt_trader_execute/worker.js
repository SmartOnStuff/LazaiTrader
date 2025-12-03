/**
 * LazaiTrader Trading Execution Worker (Consumer)
 * 
 * Triggered by messages in the Cloudflare Queue.
 * Processes one trade at a time:
 * 1. Re-validates trigger condition with fresh price
 * 2. Calculates trade amount with consecutive multiplier
 * 3. Applies Min/Max USD limits
 * 4. Executes trade via SCW
 * 5. Records trade and metrics in DB
 * 6. Notifies user via Telegram
 */

import { ethers } from 'ethers';

// ============================================
// ABIs
// ============================================

const ERC20_ABI = [
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)'
];

const SCW_ABI = [
  'function executeTrade(address _dex, bytes _data) returns (bool success, bytes returnData)',
  'function approveToken(address _token, address _dex, uint256 _amount)',
  'function getTokenBalance(address _token) view returns (uint256 balance)',
  'function getNativeBalance() view returns (uint256 balance)',
  'function isDEXWhitelisted(address _dex) view returns (bool)'
];

const DEX_ABI = [
  'function swap(address tokenInAddr, uint256 amountIn)',
  'function setPrices(uint256 _baseToQuote, uint256 _quoteToBase)'
];

// ============================================
// ORACLE PRICE UPDATE
// ============================================

/**
 * Calculate oracle prices from USD price
 * Both tokens are 18 decimals, contract expects 1e18 scaling for price ratios
 */
function calculateOraclePrices(priceUSD) {
  // Price base to quote (e.g., ETH price in USDC terms)
  const priceBaseToQuote = BigInt(Math.floor(priceUSD * 1e18));
  // Price quote to base (inverse)
  const priceQuoteToBase = BigInt(Math.floor((1 / priceUSD) * 1e18));
  
  return { priceBaseToQuote, priceQuoteToBase };
}

/**
 * Update DEX oracle prices before executing trade
 * This ensures the DEX has accurate prices for the swap
 */
async function updateOraclePrices(
  provider,
  oracleOwnerWallet,
  dexAddress,
  priceUSD
) {
  const { priceBaseToQuote, priceQuoteToBase } = calculateOraclePrices(priceUSD);
  
  const dex = new ethers.Contract(dexAddress, DEX_ABI, oracleOwnerWallet);
  
  console.log(`[ORACLE] Updating prices: baseToQuote=${priceBaseToQuote}, quoteToBase=${priceQuoteToBase}`);
  
  const tx = await dex.setPrices(priceBaseToQuote, priceQuoteToBase, {
    gasLimit: 200000
  });
  
  const receipt = await tx.wait();
  
  return {
    success: receipt.status === 1,
    txHash: receipt.hash,
    priceBaseToQuote: priceBaseToQuote.toString(),
    priceQuoteToBase: priceQuoteToBase.toString()
  };
}

// ============================================
// PRICE FETCHING
// ============================================

/**
 * Normalize base pair symbol from trading pair name
 */
function normalizeBasePairSymbol(pairName) {
  let normalized = pairName
    .replace(/^tg/gi, '')
    .replace(/-tg/gi, '-')
    .replace(/^t/gi, '')
    .replace(/-t/gi, '-')
    .toUpperCase();
  
  const symbolMap = {
    'GETH': 'ETH',
    'GUSDC': 'USDC',
    'GBTC': 'BTC',
    'WETH': 'ETH',
    'WBTC': 'BTC',
  };
  
  const parts = normalized.split('-');
  const mappedParts = parts.map(p => symbolMap[p] || p);
  return mappedParts.join('-');
}

/**
 * Parse price from various API response formats
 */
function parsePrice(provider, data) {
  try {
    switch (provider.toLowerCase()) {
      case 'binance':
        return parseFloat(data.price);
      case 'coinbase':
        return parseFloat(data.data?.amount);
      case 'coingecko':
        const keys = Object.keys(data);
        if (keys.length > 0) {
          const tokenData = data[keys[0]];
          const priceKeys = Object.keys(tokenData);
          if (priceKeys.length > 0) {
            return parseFloat(tokenData[priceKeys[0]]);
          }
        }
        return null;
      case 'dexscreener':
        if (data.pairs && data.pairs.length > 0) {
          return parseFloat(data.pairs[0].priceUsd);
        }
        return null;
      default:
        if (data.price) return parseFloat(data.price);
        if (data.last) return parseFloat(data.last);
        return null;
    }
  } catch (e) {
    return null;
  }
}

/**
 * Fetch fresh price for validation
 */
async function fetchFreshPrice(db, pairName) {
  const basePairSymbol = normalizeBasePairSymbol(pairName);
  
  const endpoints = await db.prepare(`
    SELECT * FROM PriceAPIEndpoints 
    WHERE BasePairSymbol = ? AND IsActive = 1 
    ORDER BY Priority ASC
  `).bind(basePairSymbol).all();
  
  if (!endpoints.results || endpoints.results.length === 0) {
    return null;
  }
  
  for (const endpoint of endpoints.results) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(endpoint.EndpointURL, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) continue;
      
      const data = await response.json();
      const price = parsePrice(endpoint.Provider, data);
      
      if (price && price > 0) {
        return { price, provider: endpoint.Provider };
      }
    } catch (e) {
      continue;
    }
  }
  
  return null;
}

// ============================================
// TRIGGER VALIDATION
// ============================================

/**
 * Re-validate trigger with fresh price
 */
function validateTrigger(currentPrice, lastTradePrice, triggerPercentage) {
  if (!lastTradePrice || lastTradePrice <= 0) {
    return { valid: false, reason: 'Invalid last trade price' };
  }
  
  const percentChange = ((currentPrice - lastTradePrice) / lastTradePrice) * 100;
  const absChange = Math.abs(percentChange);
  const triggerThreshold = triggerPercentage * 100;
  
  if (absChange >= triggerThreshold) {
    const action = percentChange > 0 ? 'SELL' : 'BUY';
    return {
      valid: true,
      action,
      percentChange,
      absChange
    };
  }
  
  return {
    valid: false,
    reason: `Price change ${absChange.toFixed(2)}% below trigger ${triggerThreshold}%`,
    percentChange,
    absChange
  };
}

// ============================================
// TRADE CALCULATIONS
// ============================================

/**
 * Get consecutive count from last trade metrics
 */
async function getConsecutiveCount(db, userId, pairId, currentAction) {
  const lastTrade = await db.prepare(`
    SELECT t.TradeID, t.Action, tm.ConsecutiveCount
    FROM Trades t
    LEFT JOIN TradeMetrics tm ON t.TradeID = tm.TradeID
    WHERE t.UserID = ? AND t.PairID = ?
    ORDER BY t.CreatedAt DESC
    LIMIT 1
  `).bind(userId, pairId).first();
  
  if (!lastTrade) {
    return 0;
  }
  
  // If same direction, increment consecutive count
  if (lastTrade.Action === currentAction) {
    return (lastTrade.ConsecutiveCount || 0) + 1;
  }
  
  // Different direction, reset to 0
  return 0;
}

/**
 * Calculate actual trade percentage with multiplier
 * Formula: TradePercentage * (Multiplier ^ ConsecutiveCount)
 */
function calculateActualTradePercentage(basePercentage, multiplier, consecutiveCount) {
  return basePercentage * Math.pow(multiplier, consecutiveCount);
}

/**
 * Calculate trade amount with Min/Max USD limits
 * Returns { amount, amountUSD, capped, belowMinimum }
 */
function calculateTradeAmount(
  tokenBalance,
  tokenDecimals,
  actualTradePercentage,
  currentPriceUSD,
  minAmountUSD,
  maxAmountUSD
) {
  // Calculate raw amount based on percentage of balance
  const rawAmount = tokenBalance * actualTradePercentage;
  const rawAmountUSD = rawAmount * currentPriceUSD;
  
  // Check minimum
  if (rawAmountUSD < minAmountUSD && minAmountUSD > 0) {
    return {
      amount: 0,
      amountUSD: rawAmountUSD,
      capped: false,
      belowMinimum: true,
      reason: `Trade amount $${rawAmountUSD.toFixed(2)} below minimum $${minAmountUSD}`
    };
  }
  
  // Check maximum
  if (rawAmountUSD > maxAmountUSD && maxAmountUSD > 0) {
    // Cap at max amount USD
    const cappedAmount = maxAmountUSD / currentPriceUSD;
    // Round to 5 decimals
    const roundedAmount = Math.ceil(cappedAmount * 100000) / 100000;
    
    return {
      amount: roundedAmount,
      amountUSD: maxAmountUSD,
      capped: true,
      belowMinimum: false,
      originalAmount: rawAmount,
      originalAmountUSD: rawAmountUSD
    };
  }
  
  // Within limits - round to 5 decimals
  const roundedAmount = Math.ceil(rawAmount * 100000) / 100000;
  
  return {
    amount: roundedAmount,
    amountUSD: roundedAmount * currentPriceUSD,
    capped: false,
    belowMinimum: false
  };
}

// ============================================
// BLOCKCHAIN INTERACTION
// ============================================

/**
 * Get token balance from SCW
 */
async function getSCWTokenBalance(provider, scwAddress, tokenAddress) {
  const scw = new ethers.Contract(scwAddress, SCW_ABI, provider);
  const balance = await scw.getTokenBalance(tokenAddress);
  return balance;
}

/**
 * Approve token from SCW to DEX (if not already approved)
 */
async function approveTokenOnSCW(
  botWallet,
  scwAddress,
  tokenAddress,
  dexAddress,
  amountWei
) {
  console.log(`[APPROVE] Approving ${tokenAddress} for DEX ${dexAddress}...`);
  
  const scw = new ethers.Contract(scwAddress, SCW_ABI, botWallet);
  
  // Approve max uint256 to avoid repeated approvals
  const maxApproval = ethers.MaxUint256;
  
  const tx = await scw.approveToken(tokenAddress, dexAddress, maxApproval, {
    gasLimit: 200000
  });
  
  console.log(`[APPROVE] TX Hash: ${tx.hash}`);
  
  const receipt = await tx.wait();
  
  return {
    success: receipt.status === 1,
    txHash: receipt.hash
  };
}

/**
 * Execute trade on DEX through SCW
 */
async function executeTrade(
  provider,
  botWallet,
  scwAddress,
  dexAddress,
  tokenInAddress,
  amountInWei
) {
  console.log(`[EXECUTE] SCW: ${scwAddress}`);
  console.log(`[EXECUTE] DEX: ${dexAddress}`);
  console.log(`[EXECUTE] Token In: ${tokenInAddress}`);
  console.log(`[EXECUTE] Amount Wei: ${amountInWei.toString()}`);
  
  const scw = new ethers.Contract(scwAddress, SCW_ABI, botWallet);
  
  // Encode swap call data using ABI coder directly
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  const swapSelector = ethers.id('swap(address,uint256)').slice(0, 10); // Function selector
  const encodedParams = abiCoder.encode(
    ['address', 'uint256'],
    [tokenInAddress, amountInWei]
  );
  const swapData = swapSelector + encodedParams.slice(2); // Remove '0x' from params
  
  console.log(`[EXECUTE] Swap selector: ${swapSelector}`);
  console.log(`[EXECUTE] Swap data: ${swapData}`);
  console.log(`[EXECUTE] Swap data length: ${swapData.length}`);
  
  // Execute trade through SCW
  const tx = await scw.executeTrade(dexAddress, swapData, {
    gasLimit: 500000
  });
  
  console.log(`[EXECUTE] TX Hash: ${tx.hash}`);
  
  const receipt = await tx.wait();
  
  return {
    success: receipt.status === 1,
    txHash: receipt.hash,
    gasUsed: receipt.gasUsed.toString()
  };
}

// ============================================
// DATABASE OPERATIONS
// ============================================

/**
 * Record trade in database
 */
async function recordTrade(db, tradeData) {
  // Insert price history first
  const priceResult = await db.prepare(`
    INSERT INTO PriceHistory (PairID, Price, CreatedAt)
    VALUES (?, ?, datetime('now'))
  `).bind(tradeData.pairId, tradeData.price).run();
  
  const priceId = priceResult.meta?.last_row_id;
  
  // Insert trade
  const tradeResult = await db.prepare(`
    INSERT INTO Trades (PairID, UserID, PriceID, Action, QuantitySent, QuantityReceived, TxHash, CreatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).bind(
    tradeData.pairId,
    tradeData.userId,
    priceId,
    tradeData.action,
    tradeData.quantitySent,
    tradeData.quantityReceived,
    tradeData.txHash
  ).run();
  
  const tradeId = tradeResult.meta?.last_row_id;
  
  // Insert trade metrics
  await db.prepare(`
    INSERT INTO TradeMetrics (TradeID, ConsecutiveCount, ActualTradePercentage, CreatedAt)
    VALUES (?, ?, ?, datetime('now'))
  `).bind(
    tradeId,
    tradeData.consecutiveCount,
    tradeData.actualTradePercentage
  ).run();
  
  return { tradeId, priceId };
}

// ============================================
// TELEGRAM NOTIFICATIONS
// ============================================

/**
 * Send notification to user via Telegram
 */
async function sendTelegramNotification(botToken, chatId, message) {
  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML'
      })
    });
    
    return response.ok;
  } catch (e) {
    console.error(`[TELEGRAM] Failed to send notification: ${e.message}`);
    return false;
  }
}

/**
 * Format trade success notification
 */
function formatTradeSuccessMessage(trade) {
  return `🎯 <b>Trade Executed!</b>

📊 <b>Pair:</b> ${trade.pairName}
🔄 <b>Action:</b> ${trade.action}
💰 <b>Amount:</b> ${trade.amount.toFixed(5)} ${trade.tokenSymbol}
💵 <b>Value:</b> $${trade.amountUSD.toFixed(2)}
📈 <b>Price:</b> $${trade.price.toFixed(2)}
📉 <b>Change:</b> ${trade.percentChange.toFixed(2)}%
🔗 <b>Chain:</b> ${trade.chainName}

${trade.capped ? '⚠️ Amount capped to MaxAmount limit' : ''}

🔗 <a href="${trade.explorerUrl}/tx/${trade.txHash}">View Transaction</a>`;
}

/**
 * Format below minimum notification
 */
function formatBelowMinimumMessage(trade) {
  return `⚠️ <b>Trade Skipped - Below Minimum</b>

📊 <b>Pair:</b> ${trade.pairName}
🔄 <b>Action:</b> ${trade.action}
💰 <b>Calculated Amount:</b> $${trade.amountUSD.toFixed(2)}
🚫 <b>Minimum Required:</b> $${trade.minAmount}

The trade amount is below your minimum trade setting. Adjust your settings or wait for larger price movements.`;
}

/**
 * Format zero balance notification
 */
function formatZeroBalanceMessage(trade) {
  return `⚠️ <b>Trade Skipped - No Balance</b>

📊 <b>Pair:</b> ${trade.pairName}
🔄 <b>Action:</b> ${trade.action}
💰 <b>Token:</b> ${trade.tokenSymbol}
📍 <b>SCW:</b> <code>${trade.scwAddress}</code>
🔗 <b>Chain:</b> ${trade.chainName}

Your Smart Contract Wallet has no ${trade.tokenSymbol} balance. Please fund your SCW to enable trading.`;
}

// ============================================
// MAIN PROCESSING LOGIC
// ============================================

/**
 * Process a single trade message from the queue
 */
async function processTradeMessage(message, env) {
  const trade = message.body;
  
  console.log(`[PROCESS] Starting trade for user ${trade.userId}, pair ${trade.pair.pairName}, action ${trade.action}`);
  console.log(`[MESSAGE] Full payload: ${JSON.stringify(trade)}`);
  
  try {
    const db = env.DB;
    
    // Step 1: Fetch fresh price
    console.log(`[PRICE] Fetching fresh price for ${trade.pair.pairName}...`);
    const freshPriceData = await fetchFreshPrice(db, trade.pair.pairName);
    
    if (!freshPriceData) {
      console.error(`[ERROR] Failed to fetch fresh price for ${trade.pair.pairName}`);
      // Don't log, don't execute - just skip
      message.ack();
      return;
    }
    
    const currentPrice = freshPriceData.price;
    console.log(`[PRICE] Fresh price: $${currentPrice} (was $${trade.triggerPrice} when queued)`);
    
    // Step 2: Re-validate trigger
    console.log(`[VALIDATE] Re-validating trigger...`);
    const validation = validateTrigger(
      currentPrice,
      trade.lastTradePrice,
      trade.triggerPercentage
    );
    
    if (!validation.valid) {
      console.log(`[SKIP] Trigger no longer valid: ${validation.reason}`);
      // Don't log, don't execute - just skip
      message.ack();
      return;
    }
    
    console.log(`[VALIDATE] Trigger still valid: ${validation.action} at ${validation.percentChange.toFixed(2)}% change`);
    
    // Step 3: Get consecutive count
    const consecutiveCount = await getConsecutiveCount(
      db,
      trade.userId,
      trade.pairId,
      validation.action
    );
    console.log(`[CALC] Consecutive count: ${consecutiveCount}`);
    
    // Step 4: Calculate actual trade percentage
    const actualTradePercentage = calculateActualTradePercentage(
      trade.tradePercentage,
      trade.multiplier,
      consecutiveCount
    );
    console.log(`[CALC] Actual trade percentage: ${(actualTradePercentage * 100).toFixed(2)}% (base: ${(trade.tradePercentage * 100).toFixed(2)}%, multiplier: ${trade.multiplier}, consecutive: ${consecutiveCount})`);
    
    // Step 5: Connect to blockchain and get balance
    const provider = new ethers.JsonRpcProvider(trade.chain.rpcEndpoint);
    
    // Determine which token we're selling
    const tokenIn = validation.action === 'SELL' 
      ? trade.pair.baseToken 
      : trade.pair.quoteToken;
    
    const tokenOut = validation.action === 'SELL'
      ? trade.pair.quoteToken
      : trade.pair.baseToken;
    
    console.log(`[TRADE] ${validation.action}: Selling ${tokenIn.symbol} for ${tokenOut.symbol}`);
    
    // Get SCW balance of token to sell
    const balanceWei = await getSCWTokenBalance(
      provider,
      trade.scwAddress,
      tokenIn.address
    );
    const balance = parseFloat(ethers.formatUnits(balanceWei, tokenIn.decimals));
    console.log(`[BALANCE] SCW ${tokenIn.symbol} balance: ${balance}`);
    
    // Step 6: Check for zero balance
    if (balance <= 0) {
      console.log(`[SKIP] Zero balance - cannot execute trade`);
      
      // Record as 0-amount trade with explanation
      await recordTrade(db, {
        pairId: trade.pairId,
        userId: trade.userId,
        price: currentPrice,
        action: validation.action,
        quantitySent: 0,
        quantityReceived: 0,
        txHash: `NO_BALANCE-${trade.userId}-${trade.pairId}-${Date.now()}`,
        consecutiveCount: 0,
        actualTradePercentage: 0
      });
      
      // Notify user
      await sendTelegramNotification(
        env.TELEGRAM_BOT_TOKEN,
        trade.telegramChatId,
        formatZeroBalanceMessage({
          pairName: trade.pair.pairName,
          action: validation.action,
          tokenSymbol: tokenIn.symbol,
          scwAddress: trade.scwAddress,
          chainName: trade.chain.chainName
        })
      );
      
      message.ack();
      return;
    }
    
    // Step 7: Calculate trade amount with limits
    const tradeCalc = calculateTradeAmount(
      balance,
      tokenIn.decimals,
      actualTradePercentage,
      currentPrice,
      trade.minimumAmount,
      trade.maxAmount
    );
    
    // Step 8: Handle below minimum case
    if (tradeCalc.belowMinimum) {
      console.log(`[MINIMUM] Trade below minimum: ${tradeCalc.reason}`);
      
      // Record as 0-amount trade with explanation
      await recordTrade(db, {
        pairId: trade.pairId,
        userId: trade.userId,
        price: currentPrice,
        action: validation.action,
        quantitySent: 0,
        quantityReceived: 0,
        txHash: `BELOW_MIN-${trade.userId}-${trade.pairId}-${Date.now()}`,
        consecutiveCount: consecutiveCount,
        actualTradePercentage: actualTradePercentage
      });
      
      // Notify user
      await sendTelegramNotification(
        env.TELEGRAM_BOT_TOKEN,
        trade.telegramChatId,
        formatBelowMinimumMessage({
          pairName: trade.pair.pairName,
          action: validation.action,
          amountUSD: tradeCalc.amountUSD,
          minAmount: trade.minimumAmount
        })
      );
      
      message.ack();
      return;
    }
    
    console.log(`[TRADE] Amount to trade: ${tradeCalc.amount} ${tokenIn.symbol} ($${tradeCalc.amountUSD.toFixed(2)})${tradeCalc.capped ? ' [CAPPED]' : ''}`);
    
    // Step 9: Connect bot wallet and update oracle prices
    const botWallet = new ethers.Wallet(env.BOT_PRIVATE_KEY, provider);
    
    // Update DEX oracle with fresh price before executing trade
    console.log(`[ORACLE] Updating DEX oracle prices...`);
    try {
      const oracleResult = await updateOraclePrices(
        provider,
        botWallet,  // Bot wallet is also the oracle owner
        trade.pair.dexAddress,
        currentPrice
      );
      
      if (!oracleResult.success) {
        console.error(`[ERROR] Failed to update oracle prices`);
        message.retry();
        return;
      }
      
      console.log(`[ORACLE] Prices updated successfully. TxHash: ${oracleResult.txHash}`);
    } catch (oracleError) {
      console.error(`[ERROR] Oracle update failed: ${oracleError.message}`);
      message.retry();
      return;
    }
    
    // Calculate amount in wei for approval and trade
    const amountWei = ethers.parseUnits(
      tradeCalc.amount.toFixed(tokenIn.decimals),
      tokenIn.decimals
    );
    
    // Step 10: Approve token from SCW to DEX
    console.log(`[APPROVE] Approving token for trade...`);
    try {
      const approvalResult = await approveTokenOnSCW(
        botWallet,
        trade.scwAddress,
        tokenIn.address,
        trade.pair.dexAddress,
        amountWei
      );
      
      if (!approvalResult.success) {
        console.error(`[ERROR] Token approval failed`);
        message.retry();
        return;
      }
      
      console.log(`[APPROVE] Token approved successfully. TxHash: ${approvalResult.txHash}`);
    } catch (approvalError) {
      console.error(`[ERROR] Token approval failed: ${approvalError.message}`);
      message.retry();
      return;
    }
    
    // Step 11: Execute trade
    console.log(`[EXECUTE] Executing trade on DEX ${trade.pair.dexAddress}...`);
    
    const result = await executeTrade(
      provider,
      botWallet,
      trade.scwAddress,
      trade.pair.dexAddress,
      tokenIn.address,
      amountWei
    );
    
    if (!result.success) {
      console.error(`[ERROR] Trade execution failed`);
      message.retry();
      return;
    }
    
    console.log(`[SUCCESS] Trade executed! TxHash: ${result.txHash}`);
    
    // Step 12: Record trade in database
    // Note: We record quantitySent, quantityReceived would need to be parsed from events
    // For simplicity, we'll estimate based on price
    const estimatedReceived = tradeCalc.amount; // In practice, parse from tx receipt
    
    const { tradeId } = await recordTrade(db, {
      pairId: trade.pairId,
      userId: trade.userId,
      price: currentPrice,
      action: validation.action,
      quantitySent: tradeCalc.amount,
      quantityReceived: estimatedReceived,
      txHash: result.txHash,
      consecutiveCount: consecutiveCount,
      actualTradePercentage: actualTradePercentage
    });
    
    console.log(`[DB] Recorded trade ID: ${tradeId}`);
    
    // Step 13: Send Telegram notification
    await sendTelegramNotification(
      env.TELEGRAM_BOT_TOKEN,
      trade.telegramChatId,
      formatTradeSuccessMessage({
        pairName: trade.pair.pairName,
        action: validation.action,
        amount: tradeCalc.amount,
        tokenSymbol: tokenIn.symbol,
        amountUSD: tradeCalc.amountUSD,
        price: currentPrice,
        percentChange: validation.percentChange,
        chainName: trade.chain.chainName,
        explorerUrl: trade.chain.explorerUrl,
        txHash: result.txHash,
        capped: tradeCalc.capped
      })
    );
    
    console.log(`[COMPLETE] Trade processed successfully for user ${trade.userId}`);
    message.ack();
    
  } catch (error) {
    console.error(`[ERROR] Failed to process trade: ${error.message}`);
    console.error(error.stack);
    
    // Retry the message
    message.retry();
  }
}

// ============================================
// WORKER ENTRY POINTS
// ============================================

export default {
  /**
   * Queue consumer handler - processes one message at a time
   */
  async queue(batch, env) {
    console.log(`[QUEUE] Received batch of ${batch.messages.length} messages`);
    
    // Process messages one at a time (no parallel processing)
    for (const message of batch.messages) {
      await processTradeMessage(message, env);
    }
  },
  
  /**
   * HTTP handler for health checks
   */
  async fetch(request, env) {
    const url = new URL(request.url);
    
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({
        status: 'ok',
        worker: 'lt-trading-execution (consumer)',
        timestamp: new Date().toISOString()
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({
      error: 'Not found',
      worker: 'lt-trading-execution (consumer)',
      endpoints: ['/health']
    }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};