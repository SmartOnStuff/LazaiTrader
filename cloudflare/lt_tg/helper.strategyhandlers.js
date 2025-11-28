/**
 * Strategy Handlers Module - Multi-step Configuration
 * Handles all trading strategy CRUD operations with elaborate UX
 */

import { sendMessage, callBalanceWorker } from './worker.js';

/**
 * Step 1: Pair Selection
 */
export async function handleConfig(chatId, userId, env) {
  try {
    console.log(`[handleConfig] User ${userId} starting config`);
    
    await sendMessage(chatId, env, {
      text: '⏳ *Checking your balances across all chains...*',
      parse_mode: 'Markdown'
    });

    const user = await env.DB.prepare(
      'SELECT SCWAddress FROM Users WHERE UserID = ?'
    ).bind(userId).first();

    if (!user || !user.SCWAddress) {
      await sendMessage(chatId, env, {
        text: '❌ You need to create a Smart Contract Wallet first. Use /deposit to create one.'
      });
      return;
    }

    const balanceResult = await callBalanceWorker(userId, user.SCWAddress, env);

    if (!balanceResult.success) {
      await sendMessage(chatId, env, {
        text: `❌ Could not fetch balances: ${balanceResult.error}`
      });
      return;
    }

    // Get all active trading pairs
    const pairs = await env.DB.prepare(
      `SELECT 
        tp.PairID,
        tp.PairName,
        tp.ChainID,
        c.ChainName,
        bt.Symbol AS BaseSymbol,
        qt.Symbol AS QuoteSymbol
      FROM TradingPairs tp
      INNER JOIN Chains c ON tp.ChainID = c.ChainID
      INNER JOIN Tokens bt ON tp.BaseTokenID = bt.TokenID
      INNER JOIN Tokens qt ON tp.QuoteTokenID = qt.TokenID
      WHERE tp.IsActive = 1
      ORDER BY c.ChainName, tp.PairName`
    ).all();

    if (!pairs || pairs.results.length === 0) {
      await sendMessage(chatId, env, {
        text: '❌ No trading pairs available.'
      });
      return;
    }

    // Get user balances from UserBalances table
    const userBalances = await env.DB.prepare(
      `SELECT t.Symbol, ub.Balance 
       FROM UserBalances ub
       INNER JOIN Tokens t ON ub.TokenID = t.TokenID
       WHERE ub.UserID = ? AND ub.Balance > 0`
    ).bind(userId).all();

    const balanceMap = {};
    if (userBalances?.results) {
      for (const balance of userBalances.results) {
        balanceMap[balance.Symbol] = parseFloat(balance.Balance);
      }
    }

    // Filter pairs where user has at least one token
    const availablePairs = [];
    for (const pair of pairs.results) {
      const hasBaseToken = balanceMap[pair.BaseSymbol] > 0;
      const hasQuoteToken = balanceMap[pair.QuoteSymbol] > 0;

      if (hasBaseToken || hasQuoteToken) {
        availablePairs.push({
          pairId: pair.PairID,
          pairName: pair.PairName,
          chainId: pair.ChainID,
          chainName: pair.ChainName,
          baseSymbol: pair.BaseSymbol,
          quoteSymbol: pair.QuoteSymbol,
          hasBase: hasBaseToken,
          hasQuote: hasQuoteToken
        });
      }
    }

    if (availablePairs.length === 0) {
      await sendMessage(chatId, env, {
        text: `❌ *No Available Trading Pairs*\n\nYou don't have any supported tokens in your wallet to trade with.\n\n💡 *Next Steps:*\n1. Use /deposit to add tokens to your SCW\n2. Supported tokens vary by chain\n3. After depositing, run /config again`,
        parse_mode: 'Markdown'
      });
      return;
    }

    // Build keyboard with chain prefix
    const keyboard = {
      inline_keyboard: availablePairs.map(pair => [
        {
          text: `🔗 ${pair.chainName}: ${pair.baseSymbol}-${pair.quoteSymbol}`,
          callback_data: `pair_${pair.pairId}`
        }
      ])
    };

    await sendMessage(chatId, env, {
      text: `🔄 *Select Trading Pair*\n\nChoose the pair you want to configure for automated trading:\n\n💡 Only pairs where you have tokens are shown.`,
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });

  } catch (error) {
    console.error('[handleConfig] Error:', error);
    await sendMessage(chatId, env, {
      text: '❌ An error occurred. Please try again.'
    });
  }
}

/**
 * Step 2: Trade Percentage
 */
export async function handleConfigPairSelected(chatId, userId, pairId, env) {
  try {
    console.log(`[handleConfigPairSelected] User ${userId} selected pair ${pairId}`);

    // Get pair details
    const pair = await env.DB.prepare(
      `SELECT 
        tp.PairName,
        tp.ChainID,
        c.ChainName,
        bt.Symbol AS BaseSymbol,
        qt.Symbol AS QuoteSymbol
      FROM TradingPairs tp
      INNER JOIN Chains c ON tp.ChainID = c.ChainID
      INNER JOIN Tokens bt ON tp.BaseTokenID = bt.TokenID
      INNER JOIN Tokens qt ON tp.QuoteTokenID = qt.TokenID
      WHERE tp.PairID = ?`
    ).bind(pairId).first();

    if (!pair) {
      await sendMessage(chatId, env, {
        text: '❌ Pair not found.'
      });
      return;
    }

    const tradePercentage = 0.10; // Start with 10%
    const keyboard = {
      inline_keyboard: [
        [{ text: '✅ Confirm', callback_data: `trade_agree_${pairId}_${tradePercentage}` }],
        [
          { text: '📉 Less (-20%)', callback_data: `trade_less_${pairId}_${tradePercentage}` },
          { text: '📈 More (+20%)', callback_data: `trade_more_${pairId}_${tradePercentage}` }
        ]
      ]
    };

    const message = `
📊 *Trade Size Configuration*

🔄 Pair: ${pair.ChainName} • ${pair.BaseSymbol}-${pair.QuoteSymbol}

💹 *Current Trade Percentage: ${(tradePercentage * 100).toFixed(1)}%*

📖 *What does this mean?*
This is the percentage of your available balance that will be used for each automated trade.

💡 *Example:*
If you have \$1,000 available and set trade percentage to 10%, each trade will use up to \$100.

⚠️ *Risk Level:*
• Lower % = More conservative, smaller trades
• Higher % = More aggressive, larger trades

Click ✅ Confirm to continue, or adjust using the buttons below.`;

    await sendMessage(chatId, env, {
      text: message.trim(),
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });

  } catch (error) {
    console.error('[handleConfigPairSelected] Error:', error);
    await sendMessage(chatId, env, {
      text: '❌ An error occurred. Please try again.'
    });
  }
}

/**
 * Step 3: Trigger Percentage
 */
export async function handleTradePercentage(chatId, userId, pairId, tradePercentage, env) {
  try {
    const triggerPercentage = 0.05; // Start with 5%
    
    const keyboard = {
      inline_keyboard: [
        [{ text: '✅ Confirm', callback_data: `trigger_agree_${pairId}_${tradePercentage}_${triggerPercentage}` }],
        [
          { text: '📉 Less (-20%)', callback_data: `trigger_less_${pairId}_${tradePercentage}_${triggerPercentage}` },
          { text: '📈 More (+20%)', callback_data: `trigger_more_${pairId}_${tradePercentage}_${triggerPercentage}` }
        ]
      ]
    };

    const examplePrice = 100;
    const triggerPrice = examplePrice * (1 - triggerPercentage);

    const message = `
🎯 *Trigger Sensitivity Configuration*

📊 *Current Trigger Percentage: ${(triggerPercentage * 100).toFixed(1)}%*

📖 *What does this mean?*
This is the price change threshold that will trigger an automated trade. When the asset's price changes by this percentage in either direction, a trade will be executed.

💡 *Example:*
If an asset costs \$${examplePrice} and drops by ${(triggerPercentage * 100).toFixed(1)}%, it will fall to \$${triggerPrice.toFixed(2)}.
At this point, a BUY trade will be automatically executed.

⚠️ *Sensitivity Levels:*
• Lower % = Less sensitive, fewer trades triggered (1-3% = Conservative)
• Higher % = More sensitive, more trades triggered (5-10% = Moderate)

📌 *Recommended: 3-8% for most strategies*

Click ✅ Confirm to continue, or adjust using the buttons below.`;

    await sendMessage(chatId, env, {
      text: message.trim(),
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });

  } catch (error) {
    console.error('[handleTradePercentage] Error:', error);
    await sendMessage(chatId, env, {
      text: '❌ An error occurred. Please try again.'
    });
  }
}

/**
 * Step 4: Maximum Trade Amount
 */
export async function handleTriggerPercentage(chatId, userId, pairId, tradePercentage, triggerPercentage, env) {
  try {
    const maxAmount = 100.0; // Start with $100
    
    const keyboard = {
      inline_keyboard: [
        [{ text: '✅ Confirm', callback_data: `max_agree_${pairId}_${tradePercentage}_${triggerPercentage}_${maxAmount}` }],
        [
          { text: '📉 Less (-20%)', callback_data: `max_less_${pairId}_${tradePercentage}_${triggerPercentage}_${maxAmount}` },
          { text: '📈 More (+20%)', callback_data: `max_more_${pairId}_${tradePercentage}_${triggerPercentage}_${maxAmount}` }
        ]
      ]
    };

    const message = `
💰 *Maximum Trade Amount Configuration*

💵 *Current Maximum Amount: \$${maxAmount.toFixed(2)}*

📖 *What does this mean?*
This is a safety limit that prevents any single trade from exceeding a specific dollar amount, even if your trade percentage would suggest a larger trade.

💡 *Example:*
• Your trade percentage is 20% of available funds
• Your available balance is \$1,000
• Without a limit, each trade could be \$200
• But with a \$100 max limit, trades will cap at \$100

⚠️ *Why is this important?*
Protects you from:
• Accidentally using too much capital on a single trade
• Over-leveraging when you have large balances
• Unexpected market volatility

📌 *Recommended: \$50-\$500 depending on your capital*

Click ✅ Confirm to continue, or adjust using the buttons below.`;

    await sendMessage(chatId, env, {
      text: message.trim(),
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });

  } catch (error) {
    console.error('[handleTriggerPercentage] Error:', error);
    await sendMessage(chatId, env, {
      text: '❌ An error occurred. Please try again.'
    });
  }
}

/**
 * Step 5: Summary & Confirmation
 */
export async function handleMaxAmount(chatId, userId, pairId, tradePercentage, triggerPercentage, maxAmount, env) {
  try {
    // Get pair details for summary
    const pair = await env.DB.prepare(
      `SELECT 
        bt.Symbol AS BaseSymbol,
        qt.Symbol AS QuoteSymbol,
        c.ChainName
      FROM TradingPairs tp
      INNER JOIN Chains c ON tp.ChainID = c.ChainID
      INNER JOIN Tokens bt ON tp.BaseTokenID = bt.TokenID
      INNER JOIN Tokens qt ON tp.QuoteTokenID = qt.TokenID
      WHERE tp.PairID = ?`
    ).bind(pairId).first();

    const keyboard = {
      inline_keyboard: [[
        { text: '✅ Confirm & Save Strategy', callback_data: `final_confirm_${pairId}_${tradePercentage}_${triggerPercentage}_${maxAmount}` }
      ]]
    };

    const summaryText = `
🎉 *Your Strategy Configuration*

📊 *Pair:* ${pair.ChainName} • ${pair.BaseSymbol}-${pair.QuoteSymbol}
📈 *Trade Size:* ${(tradePercentage * 100).toFixed(1)}% per trade
🎯 *Trigger:* Price changes by ${(triggerPercentage * 100).toFixed(1)}%
💰 *Max Trade:* \$${maxAmount.toFixed(2)}

📌 *Summary:*
Your bot will automatically execute trades when:
1. Price moves by ${(triggerPercentage * 100).toFixed(1)}% in either direction
2. Each trade uses ${(tradePercentage * 100).toFixed(1)}% of available balance
3. No single trade exceeds \$${maxAmount.toFixed(2)}

Click ✅ Confirm & Save Strategy to activate!`;

    await sendMessage(chatId, env, {
      text: summaryText.trim(),
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });

  } catch (error) {
    console.error('[handleMaxAmount] Error:', error);
    await sendMessage(chatId, env, {
      text: '❌ An error occurred. Please try again.'
    });
  }
}

/**
 * Step 6: Save Configuration
 */
export async function handleStrategyConfigInput(chatId, userId, pairId, tradePercentage, triggerPercentage, maxAmount, multiplier, env) {
  try {
    console.log(`[handleStrategyConfigInput] Saving config for user ${userId}, pair ${pairId}`);

    // Get pair details
    const pair = await env.DB.prepare(
      `SELECT PairID FROM TradingPairs WHERE PairID = ?`
    ).bind(pairId).first();

    if (!pair) {
      await sendMessage(chatId, env, {
        text: '❌ Pair not found.'
      });
      return;
    }

    // Check if config already exists for this user and pair
    const existingConfig = await env.DB.prepare(
      `SELECT ConfigID FROM UserTradingConfigs WHERE UserID = ? AND PairID = ?`
    ).bind(userId, pairId).first();

    // Save or update configuration
    if (existingConfig) {
      await env.DB.prepare(
        `UPDATE UserTradingConfigs SET 
          TradePercentage = ?, 
          TriggerPercentage = ?, 
          MaxAmount = ?, 
          Multiplier = ?,
          UpdatedAt = datetime('now')
         WHERE UserID = ? AND PairID = ?`
      ).bind(tradePercentage, triggerPercentage, maxAmount, multiplier, userId, pairId).run();
    } else {
      await env.DB.prepare(
        `INSERT INTO UserTradingConfigs 
          (UserID, PairID, TradePercentage, TriggerPercentage, MaxAmount, MinimumAmount, Multiplier)
         VALUES (?, ?, ?, ?, ?, 0, ?)`
      ).bind(userId, pairId, tradePercentage, triggerPercentage, maxAmount, multiplier).run();
    }

    const pairDetails = await env.DB.prepare(
      `SELECT 
        bt.Symbol AS BaseSymbol,
        qt.Symbol AS QuoteSymbol,
        c.ChainName
      FROM TradingPairs tp
      INNER JOIN Chains c ON tp.ChainID = c.ChainID
      INNER JOIN Tokens bt ON tp.BaseTokenID = bt.TokenID
      INNER JOIN Tokens qt ON tp.QuoteTokenID = qt.TokenID
      WHERE tp.PairID = ?`
    ).bind(pairId).first();

    await sendMessage(chatId, env, {
      text: `✅ *Strategy Activated Successfully!*\n\n📊 *Pair:* ${pairDetails.ChainName} • ${pairDetails.BaseSymbol}-${pairDetails.QuoteSymbol}\n\n🤖 Your bot is now active and monitoring price changes.\n\nUse /myconfig to review or /deleteconfig to remove.`,
      parse_mode: 'Markdown'
    });

  } catch (error) {
    console.error('[handleStrategyConfigInput] Error:', error);
    await sendMessage(chatId, env, {
      text: '❌ An error occurred while saving. Please try again.'
    });
  }
}

/**
 * View all user strategies
 */
export async function handleViewConfig(chatId, userId, env) {
  try {
    console.log(`[handleViewConfig] User ${userId} viewing configs`);

    const configs = await env.DB.prepare(
      `SELECT 
        utc.ConfigID,
        tp.PairID,
        bt.Symbol AS BaseSymbol,
        qt.Symbol AS QuoteSymbol,
        c.ChainName,
        utc.TradePercentage,
        utc.TriggerPercentage,
        utc.MaxAmount,
        utc.IsActive
      FROM UserTradingConfigs utc
      INNER JOIN TradingPairs tp ON utc.PairID = tp.PairID
      INNER JOIN Chains c ON tp.ChainID = c.ChainID
      INNER JOIN Tokens bt ON tp.BaseTokenID = bt.TokenID
      INNER JOIN Tokens qt ON tp.QuoteTokenID = qt.TokenID
      WHERE utc.UserID = ?
      ORDER BY c.ChainName, tp.PairName`
    ).bind(userId).all();

    if (!configs || configs.results.length === 0) {
      await sendMessage(chatId, env, {
        text: '❌ You haven\'t configured any strategies. Use /config to get started.'
      });
      return;
    }

    let message = `📊 *Your Active Configurations*\n\n`;
    for (const config of configs.results) {
      const status = config.IsActive ? '✅' : '⏸️';
      message += `${status} *${config.ChainName}: ${config.BaseSymbol}-${config.QuoteSymbol}*\n`;
      message += `  📈 Trade: ${(config.TradePercentage * 100).toFixed(1)}%\n`;
      message += `  🎯 Trigger: ${(config.TriggerPercentage * 100).toFixed(1)}%\n`;
      message += `  💰 Max: \$${config.MaxAmount.toFixed(2)}\n\n`;
    }

    await sendMessage(chatId, env, {
      text: message,
      parse_mode: 'Markdown'
    });

  } catch (error) {
    console.error('[handleViewConfig] Error:', error);
    await sendMessage(chatId, env, {
      text: '❌ An error occurred. Please try again.'
    });
  }
}

/**
 * Delete configuration - Select which one
 */
export async function handleDeleteConfig(chatId, userId, env) {
  try {
    console.log(`[handleDeleteConfig] User ${userId} initiating delete`);

    const configs = await env.DB.prepare(
      `SELECT 
        utc.ConfigID,
        bt.Symbol AS BaseSymbol,
        qt.Symbol AS QuoteSymbol,
        c.ChainName
      FROM UserTradingConfigs utc
      INNER JOIN TradingPairs tp ON utc.PairID = tp.PairID
      INNER JOIN Chains c ON tp.ChainID = c.ChainID
      INNER JOIN Tokens bt ON tp.BaseTokenID = bt.TokenID
      INNER JOIN Tokens qt ON tp.QuoteTokenID = qt.TokenID
      WHERE utc.UserID = ?
      ORDER BY c.ChainName, tp.PairName`
    ).bind(userId).all();

    if (!configs || configs.results.length === 0) {
      await sendMessage(chatId, env, {
        text: '❌ You have no active configurations to delete.'
      });
      return;
    }

    const keyboard = {
      inline_keyboard: configs.results.map(config => [
        {
          text: `🗑️ ${config.ChainName}: ${config.BaseSymbol}-${config.QuoteSymbol}`,
          callback_data: `del_${config.ConfigID}`
        }
      ])
    };

    await sendMessage(chatId, env, {
      text: `🗑️ *Select a Configuration to Delete*\n\nChoose which strategy you want to remove:`,
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });

  } catch (error) {
    console.error('[handleDeleteConfig] Error:', error);
    await sendMessage(chatId, env, {
      text: '❌ An error occurred. Please try again.'
    });
  }
}

/**
 * Delete configuration - Confirmation
 */
export async function handleDeleteStrategyConfirm(chatId, userId, configId, env) {
  try {
    console.log(`[handleDeleteStrategyConfirm] Confirming delete for config ${configId}`);

    // Get config details
    const config = await env.DB.prepare(
      `SELECT 
        bt.Symbol AS BaseSymbol,
        qt.Symbol AS QuoteSymbol
      FROM UserTradingConfigs utc
      INNER JOIN TradingPairs tp ON utc.PairID = tp.PairID
      INNER JOIN Tokens bt ON tp.BaseTokenID = bt.TokenID
      INNER JOIN Tokens qt ON tp.QuoteTokenID = qt.TokenID
      WHERE utc.ConfigID = ? AND utc.UserID = ?`
    ).bind(configId, userId).first();

    if (!config) {
      await sendMessage(chatId, env, {
        text: '❌ Configuration not found.'
      });
      return;
    }

    const keyboard = {
      inline_keyboard: [
        [
          { text: '✅ Yes, Delete', callback_data: `confirm_del_${configId}` },
          { text: '❌ No, Cancel', callback_data: `cancel_del_${configId}` }
        ]
      ]
    };

    await sendMessage(chatId, env, {
      text: `⚠️ *Are you sure?*\n\nThis will permanently delete your *${config.BaseSymbol}-${config.QuoteSymbol}* configuration.`,
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });

  } catch (error) {
    console.error('[handleDeleteStrategyConfirm] Error:', error);
    await sendMessage(chatId, env, {
      text: '❌ An error occurred. Please try again.'
    });
  }
}