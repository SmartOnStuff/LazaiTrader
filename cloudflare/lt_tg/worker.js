/**
 * LazaiTrader Telegram Bot - Cloudflare Worker
 * Main entry point with deposit command support
 * 
 * Responsibilities:
 * - Handle all Telegram interactions
 * - Call lt_tg_deposit worker for blockchain operations
 * - Display responses to users
 * - Handle all error messages and user guidance
 */

const TELEGRAM_API = 'https://api.telegram.org/bot';

// Bot commands configuration
const COMMANDS = [
  { command: 'start', description: '🚀 Register with LazaiTrader' },
  { command: 'wallet', description: '📋 Show wallet addresses' },
  { command: 'balance', description: '💰 Check balances' },
  { command: 'deposit', description: '📥 Deposit to Smart Wallet' },
  { command: 'withdraw', description: '💸 Withdraw funds' },
  { command: 'config', description: '⚙️ Configure strategy' },
  { command: 'myconfig', description: '📊 View strategies' },
  { command: 'deleteconfig', description: '🗑️ Delete strategy' },
  { command: 'chart', description: '📈 View trade history' },
  { command: 'contribute', description: '📈 Share trading data' },
  { command: 'suggestion', description: '🔮 Get strategy suggestions' },
  { command: 'help', description: '❓ Show help menu' }
];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Handle GET request for setup endpoint
    if (request.method === 'GET' && url.pathname === '/setup') {
      return await handleSetup(env);
    }

    // Only accept POST requests from Telegram for webhook
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    try {
      const update = await request.json();

      // Handle both messages and callback queries
      if (update.message) {
        await handleMessage(update.message, env);
      } else if (update.callback_query) {
        await handleCallbackQuery(update.callback_query, env);
      }

      return new Response('OK', { status: 200 });
    } catch (error) {
      console.error('Error processing update:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  }
};

/**
 * Handle setup - sets bot commands menu
 */
async function handleSetup(env) {
  const botToken = env.BOT_TOKEN;
  
  if (!botToken) {
    return new Response(JSON.stringify({
      success: false,
      error: 'BOT_TOKEN is not configured'
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500
    });
  }

  const url = `${TELEGRAM_API}${botToken}/setMyCommands`;

  const payload = {
    commands: COMMANDS
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (result.ok) {
      return new Response(JSON.stringify({
        success: true,
        message: 'Bot commands menu has been set successfully!',
        commands: COMMANDS
      }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200
      });
    } else {
      return new Response(JSON.stringify({
        success: false,
        error: result.description
      }), {
        headers: { 'Content-Type': 'application/json' },
        status: 500
      });
    }
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500
    });
  }
}

/**
 * Handle incoming messages
 */
async function handleMessage(message, env) {
  const chatId = message.chat.id;
  const userId = message.from.id;
  const username = message.from.username || '';
  const text = message.text || '';
  const command = text.split(' ')[0].replace('/', '');

  // Check if user is in registration session (awaiting wallet) - but NOT if they're sending /start
  if (command !== 'start') {
    try {
      const session = await env.DB.prepare(
        'SELECT State FROM RegistrationSessions WHERE UserID = ?'
      ).bind(userId).first();

      if (session && session.State === 'awaiting_wallet') {
        // User is registering - treat text as wallet address
        console.log(`[handleMessage] User ${userId} is registering, treating input as wallet address`);
        await callWorker(env, 'START_WORKER', 'verify_wallet', chatId, userId, username, text);
        return;
      }
    } catch (error) {
      console.error('Error checking registration session:', error);
      // Continue with normal command routing
    }
  }

  // Route to appropriate handler based on command
  switch (command) {
    case 'start':
      // Route to START_WORKER via service binding
      await callWorker(env, 'START_WORKER', 'start', chatId, userId, username, text);
      break;
    case 'deposit':
      await handleDeposit(chatId, userId, env);
      break;
    case 'wallet':
      await sendTodoMessage(chatId, env, 'Wallet');
      break;
    case 'balance':
      await handleBalance(chatId, userId, env);
      break;
    case 'withdraw':
      await handleWithdraw(chatId, userId, env);
      break;
    case 'config':
      await handleConfig(chatId, env);
      break;
    case 'myconfig':
      await sendTodoMessage(chatId, env, 'My Config');
      break;
    case 'deleteconfig':
      await handleDeleteConfig(chatId, env);
      break;
    case 'chart':
      await sendTodoMessage(chatId, env, 'Chart');
      break;
    case 'contribute':
      await sendTodoMessage(chatId, env, 'Contribute');
      break;
    case 'suggestion':
      await sendTodoMessage(chatId, env, 'Suggestion');
      break;
    case 'help':
      await handleHelp(chatId, env);
      break;
    default:
      // Unknown command
      await sendMessage(chatId, env, {
        text: '❓ Unknown command. Use /help to see available commands.'
      });
  }
}

/**
 * Handle /deposit command - initiate deposit flow
 */
async function handleDeposit(chatId, userId, env) {
  try {
    console.log(`[handleDeposit] User ${userId} requested deposit`);
    
    // Check if user is registered and has a wallet
    const user = await env.DB.prepare(
      'SELECT UserID, UserWallet FROM Users WHERE UserID = ?'
    ).bind(userId).first();

    if (!user) {
      console.log(`[handleDeposit] User ${userId} not registered`);
      await sendMessage(chatId, env, {
        text: '❌ You are not registered yet. Please use /start to register first.'
      });
      return;
    }

    if (!user.UserWallet) {
      console.log(`[handleDeposit] User ${userId} has no wallet`);
      await sendMessage(chatId, env, {
        text: '❌ No wallet found. Please use /start to complete registration.'
      });
      return;
    }

    console.log(`[handleDeposit] User ${userId} wallet: ${user.UserWallet}`);

    // Get active chains with RPC endpoints
    const chains = await env.DB.prepare(
      'SELECT ChainID, ChainName, RPCEndpoint FROM Chains WHERE IsActive = 1 ORDER BY ChainID'
    ).all();

    console.log(`[handleDeposit] Found ${chains.results?.length || 0} chains`);

    if (!chains.results || chains.results.length === 0) {
      console.log(`[handleDeposit] No active chains found`);
      await sendMessage(chatId, env, {
        text: '❌ No active chains available at the moment.'
      });
      return;
    }

    // Build keyboard with active chains
    const keyboard = {
      inline_keyboard: chains.results.map(chain => [
        { text: `🔗 ${chain.ChainName}`, callback_data: `deposit_chain_${chain.ChainID}` }
      ])
    };

    console.log(`[handleDeposit] Sending chain menu to user ${userId}`);

    await sendMessage(chatId, env, {
      text: `📥 *Select a chain to deposit to:*\n\nChoose which blockchain network you want to use for your Smart Contract Wallet:`,
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  } catch (error) {
    console.error('Error in handleDeposit:', error);
    await sendMessage(chatId, env, {
      text: '❌ An error occurred. Please try again later.'
    });
  }
}

/**
 * Handle callback queries from inline keyboards
 */
async function handleCallbackQuery(callbackQuery, env) {
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  const userId = callbackQuery.from.id;
  const data = callbackQuery.data;

  // Answer callback query to remove loading state
  await answerCallbackQuery(callbackQuery.id, env);

  // Handle different callback actions
  if (data.startsWith('deposit_chain_')) {
    const chainId = parseInt(data.replace('deposit_chain_', ''));
    await handleDepositChain(chatId, userId, chainId, env);
  } else if (data.startsWith('pair_')) {
    await editMessage(chatId, messageId, env, {
      text: '📊 *TODO: Pair Selection*\n\nThis feature will allow you to select trading pairs.',
      parse_mode: 'Markdown'
    });
  } else if (data.includes('risk')) {
    await editMessage(chatId, messageId, env, {
      text: '⚖️ *TODO: Risk Level*\n\nThis feature will allow you to configure risk settings.',
      parse_mode: 'Markdown'
    });
  } else if (data.startsWith('del_')) {
    await editMessage(chatId, messageId, env, {
      text: '🗑️ *TODO: Delete Config*\n\nThis feature will allow you to delete configurations.',
      parse_mode: 'Markdown'
    });
  } else if (data.startsWith('withdraw_')) {
    // Format: withdraw_chain_chainId
    const parts = data.replace('withdraw_', '').split('_');
    if (parts.length >= 2) {
      const chainId = parseInt(parts[1]);
      await handleWithdrawChain(chatId, userId, chainId, env);
    }
  }
}

/**
 * Handle deposit chain selection - call deposit worker
 */
async function handleDepositChain(chatId, userId, chainId, env) {
  try {
    // Get user wallet and chain info
    const user = await env.DB.prepare(
      'SELECT UserWallet FROM Users WHERE UserID = ?'
    ).bind(userId).first();

    if (!user || !user.UserWallet) {
      await sendMessage(chatId, env, {
        text: '❌ User wallet not found. Please try /start again.'
      });
      return;
    }

    const chain = await env.DB.prepare(
      'SELECT ChainID, ChainName, RPCEndpoint FROM Chains WHERE ChainID = ? AND IsActive = 1'
    ).bind(chainId).first();

    if (!chain) {
      await sendMessage(chatId, env, {
        text: '❌ Chain not available or inactive.'
      });
      return;
    }

    // Show loading message
    await sendMessage(chatId, env, {
      text: `⏳ *Processing Deposit for ${chain.ChainName}...*\n\nSetting up your Smart Contract Wallet...`,
      parse_mode: 'Markdown'
    });

    // Call deposit worker
    const depositResult = await callDepositWorker(
      userId,
      user.UserWallet,
      chainId,
      chain.RPCEndpoint,
      env
    );

    if (!depositResult.success) {
      // Handle errors
      await handleDepositError(chatId, depositResult.errorCode, depositResult.error, chain, env);
      return;
    }

    // Success - display deposit address
    await displayDepositAddress(
      chatId,
      user.UserWallet,
      depositResult.scwAddress,
      chain,
      env
    );

  } catch (error) {
    console.error('Error in handleDepositChain:', error);
    await sendMessage(chatId, env, {
      text: '❌ An error occurred. Please try again later.'
    });
  }
}

/**
 * Call the deposit worker (blockchain backend)
 */
async function callDepositWorker(userId, userWallet, chainId, rpcUrl, env) {
  try {
    const response = await env.DEPOSIT_WORKER.fetch('https://internal/scw-deploy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: userId,
        userWallet: userWallet,
        chainId: chainId,
        rpcUrl: rpcUrl
      })
    });

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error calling deposit worker:', error);
    return {
      success: false,
      error: error.message,
      errorCode: 'WORKER_ERROR'
    };
  }
}

/**
 * Handle deposit errors with user-friendly messages
 */
async function handleDepositError(chatId, errorCode, errorMessage, chain, env) {
  let message = '';

  switch (errorCode) {
    case 'DEPLOYMENT_FAILED':
      message = `❌ *Failed to Deploy Smart Contract Wallet*\n\nThe deployment failed after 2 attempts.\n\n📧 *Contact Support:*\n• @LazaiTraderDev\n• support@lazaitrader.com\n\n💡 *You can try again in a few moments.*`;
      break;
    case 'CONFIG_ERROR':
      message = `❌ *Service Configuration Error*\n\nOur system is experiencing a temporary issue.\n\n📧 *Contact Support:*\n• @LazaiTraderDev\n• support@lazaitrader.com`;
      break;
    case 'INVALID_INPUT':
      message = `❌ *Invalid Input*\n\nPlease try again with the /deposit command.`;
      break;
    default:
      message = `❌ *Error: ${errorMessage}*\n\n📧 *Contact Support:*\n• @LazaiTraderDev\n• support@lazaitrader.com`;
  }

  await sendMessage(chatId, env, {
    text: message,
    parse_mode: 'Markdown'
  });
}

/**
 * Display deposit address with instructions
 */
async function displayDepositAddress(chatId, userWallet, scwAddress, chain, env) {
  // Get supported tokens for this chain
  const tokens = await env.DB.prepare(
    'SELECT Symbol FROM Tokens WHERE ChainID = ? AND IsActive = 1 ORDER BY Symbol'
  ).bind(chain.ChainID).all();

  const tokenList = tokens?.results?.map(t => `• ${t.Symbol}`).join('\n') || '(Loading...)';

  const message = `
✅ *Smart Contract Wallet Ready!*

🔗 *Network:* ${chain.ChainName}
📬 *Your Deposit Address:*
\`${scwAddress}\`

💰 *Supported Tokens on ${chain.ChainName}:*
${tokenList}

📋 *How to Deposit:*
1️⃣ Copy the wallet address above
2️⃣ Go to your exchange or wallet
3️⃣ Send tokens to this address on ${chain.ChainName}
4️⃣ Wait for blockchain confirmation
5️⃣ Your funds will appear in your trading wallet

⚠️ *IMPORTANT:*
🔴 Only send tokens to this address on ${chain.ChainName}
🔴 Sending to this address on OTHER networks = LOST FUNDS
🔴 Always double-check the address before sending

📊 *Your Wallets:*
• EOA: \`${userWallet}\` (your external wallet)
• SCW: \`${scwAddress}\` (your trading wallet)

❓ *Need Help?*
Use /help or contact: support@lazaitrader.com
`;

  await sendMessage(chatId, env, {
    text: message.trim(),
    parse_mode: 'Markdown'
  });
}

/**
 * Handle withdrawal chain selection - withdraw all tokens on selected chain
 */
async function handleWithdrawChain(chatId, userId, chainId, env) {
  try {
    console.log(`[handleWithdrawChain] User ${userId} initiating withdrawal from chain ${chainId}`);
    
    // Get user wallet and SCW
    const user = await env.DB.prepare(
      'SELECT UserWallet, SCWAddress FROM Users WHERE UserID = ?'
    ).bind(userId).first();

    if (!user || !user.SCWAddress) {
      await sendMessage(chatId, env, {
        text: '❌ No Smart Contract Wallet found.'
      });
      return;
    }

    // Get chain details including explorer URL
    const chain = await env.DB.prepare(
      'SELECT ChainName, RPCEndpoint, ExplorerURL FROM Chains WHERE ChainID = ?'
    ).bind(chainId).first();

    if (!chain) {
      await sendMessage(chatId, env, {
        text: '❌ Chain not found.'
      });
      return;
    }

    // Send processing message
    await sendMessage(chatId, env, {
      text: `⏳ *Processing Withdrawal*\n\n🔗 Chain: ${chain.ChainName}\n\nFetching balances and executing withdrawals...`,
      parse_mode: 'Markdown'
    });

    // Get current balances from blockchain
    const balanceResult = await callBalanceWorker(userId, user.SCWAddress, env);

    if (!balanceResult.success) {
      await sendMessage(chatId, env, {
        text: `❌ *Could not fetch balances*\n\n${balanceResult.error}`
      });
      return;
    }

    // Extract tokens for this chain with non-zero balance
    const chainBalance = balanceResult.balances[chainId];
    if (!chainBalance) {
      await sendMessage(chatId, env, {
        text: `❌ No tokens found on this chain.`
      });
      return;
    }

    const tokensToWithdraw = chainBalance.tokens.filter(t => t.balance !== '0' && parseFloat(t.balanceFormatted) > 0);
    
    if (tokensToWithdraw.length === 0) {
      await sendMessage(chatId, env, {
        text: `❌ No tokens with balance on ${chain.ChainName}.`
      });
      return;
    }

    console.log(`[handleWithdrawChain] Found ${tokensToWithdraw.length} tokens to withdraw on chain ${chainId}`);

    // Withdraw all tokens on this chain via single withdrawal worker call
    const withdrawalResult = await callWithdrawalWorker(
      userId,
      user.UserWallet,
      user.SCWAddress,
      chainId,
      chain.RPCEndpoint,
      env
    );

    if (!withdrawalResult.success) {
      await sendMessage(chatId, env, {
        text: `❌ *Withdrawal Failed*\n\n${withdrawalResult.error}\n\n📧 *Contact Support:*\n• @LazaiTraderDev\n• support@lazaitrader.com`,
        parse_mode: 'Markdown'
      });
      return;
    }

    // Build transaction link
    const transactionLink = buildTransactionLink(chain.ExplorerURL, withdrawalResult.txHash);

    // Build success message with transaction link
    let responseText = `✅ *Withdrawal Complete*\n\n`;
    responseText += `🔗 *Chain:* ${chain.ChainName}\n`;
    responseText += `📍 *To:* \`${user.UserWallet}\`\n\n`;
    responseText += `💸 *Withdrawn Tokens:*\n`;
    
    tokensToWithdraw.forEach(token => {
      responseText += `• ${token.symbol}: ${token.balanceFormatted}\n`;
    });

    responseText += `\n🔗 *Transaction:*\n`;
    responseText += `[View on Explorer](${transactionLink})\n`;
    responseText += `\`${withdrawalResult.txHash}\`\n`;
    responseText += `\nYour funds will arrive shortly.`;

    await sendMessage(chatId, env, {
      text: responseText,
      parse_mode: 'Markdown'
    });

  } catch (error) {
    console.error('Error in handleWithdrawChain:', error);
    await sendMessage(chatId, env, {
      text: '❌ An error occurred. Please try again later.'
    });
  }
}

/**
 * Call the withdrawal worker (blockchain backend)
 */
async function callWithdrawalWorker(userId, userWallet, scwAddress, chainId, rpcUrl, env) {
  try {
    const response = await env.WITHDRAWAL_WORKER.fetch('https://internal/withdraw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: userId,
        userWallet: userWallet,
        scwAddress: scwAddress,
        chainId: chainId,
        rpcUrl: rpcUrl
      })
    });

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error calling withdrawal worker:', error);
    return {
      success: false,
      error: error.message,
      errorCode: 'WORKER_ERROR'
    };
  }
}

/**
 * Build transaction explorer link
 * @param explorerURL Base explorer URL from database
 * @param txHash Transaction hash
 * @returns Full transaction link
 */
function buildTransactionLink(explorerURL, txHash) {
  if (!explorerURL) {
    return `https://etherscan.io/tx/${txHash}`;
  }

  // Ensure explorerURL doesn't have trailing slash
  const baseURL = explorerURL.replace(/\/$/, '');

  // Support different explorer URL formats
  if (baseURL.includes('etherscan')) {
    return `${baseURL}/tx/${txHash}`;
  } else if (baseURL.includes('explorer')) {
    // Generic explorer (works for most EVM chains)
    return `${baseURL}/tx/${txHash}`;
  } else if (baseURL.includes('scan')) {
    // Scan-based explorers
    return `${baseURL}/tx/${txHash}`;
  } else {
    // Fallback
    return `${baseURL}/tx/${txHash}`;
  }
}

/**
 * Handle /balance command - fetch and display SCW balances
 */
async function handleBalance(chatId, userId, env) {
  try {
    console.log(`[handleBalance] User ${userId} requested balance`);
    
    // Check if user is registered and has SCW
    const user = await env.DB.prepare(
      'SELECT UserID, UserWallet, SCWAddress FROM Users WHERE UserID = ?'
    ).bind(userId).first();

    if (!user) {
      await sendMessage(chatId, env, {
        text: '❌ You are not registered yet. Please use /start to register first.'
      });
      return;
    }

    if (!user.SCWAddress) {
      await sendMessage(chatId, env, {
        text: '❌ No Smart Contract Wallet found. Please use /deposit to create one first.'
      });
      return;
    }

    // Send loading message
    await sendMessage(chatId, env, {
      text: `⏳ *Fetching your balances...*\n\nQuerying blockchain networks...`,
      parse_mode: 'Markdown'
    });

    // Call balance worker
    const balanceResult = await callBalanceWorker(userId, user.SCWAddress, env);

    if (!balanceResult.success) {
      await sendMessage(chatId, env, {
        text: `❌ *Error fetching balances*\n\n${balanceResult.error}`
      });
      return;
    }

    // Format and display balances
    await displayBalances(chatId, balanceResult.balances, user.SCWAddress, env);

  } catch (error) {
    console.error('Error in handleBalance:', error);
    await sendMessage(chatId, env, {
      text: '❌ An error occurred. Please try again later.'
    });
  }
}

/**
 * Call the balance worker
 */
async function callBalanceWorker(userId, scwAddress, env) {
  try {
    const response = await env.BALANCE_WORKER.fetch('https://internal/balance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: userId,
        scwAddress: scwAddress
      })
    });

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error calling balance worker:', error);
    return {
      success: false,
      error: error.message,
      errorCode: 'WORKER_ERROR'
    };
  }
}

/**
 * Display balances grouped by chain
 */
async function displayBalances(chatId, balances, scwAddress, env) {
  try {
    // Build message for each chain
    let message = `💰 *Your Smart Contract Wallet Balances*\n\n`;
    message += `📬 *Wallet Address:*\n\`${scwAddress}\`\n\n`;

    let hasAnyBalance = false;

    // Sort chains by ID
    const chainIds = Object.keys(balances).sort((a, b) => parseInt(a) - parseInt(b));

    for (const chainId of chainIds) {
      const chain = balances[chainId];
      
      message += `🔗 *${chain.chainName}*\n`;

      // Check if any tokens have non-zero balance
      const tokensWithBalance = chain.tokens.filter(t => parseFloat(t.balanceFormatted) > 0);
      const tokensWithoutBalance = chain.tokens.filter(t => parseFloat(t.balanceFormatted) === 0);

      if (tokensWithBalance.length > 0) {
        hasAnyBalance = true;
        tokensWithBalance.forEach(token => {
          message += `  💵 ${token.symbol}: \`${token.balanceFormatted}\`\n`;
        });
      }

      if (tokensWithoutBalance.length > 0) {
        tokensWithoutBalance.forEach(token => {
          message += `  ⚪ ${token.symbol}: \`0\`\n`;
        });
      }

      message += `\n`;
    }

    if (!hasAnyBalance) {
      message += `_Your wallet appears to be empty. Use /deposit to fund it!_`;
    }

    message += `\n📊 Last updated: \`${new Date().toISOString()}\``;

    await sendMessage(chatId, env, {
      text: message,
      parse_mode: 'Markdown'
    });

  } catch (error) {
    console.error('Error displaying balances:', error);
    await sendMessage(chatId, env, {
      text: '❌ Error displaying balances.'
    });
  }
}

/**
 * Handle /withdraw command - initiate withdrawal flow
 */
async function handleWithdraw(chatId, userId, env) {
  try {
    console.log(`[handleWithdraw] User ${userId} requested withdrawal`);
    
    // Check if user is registered and has SCW
    const user = await env.DB.prepare(
      'SELECT UserID, UserWallet, SCWAddress FROM Users WHERE UserID = ?'
    ).bind(userId).first();

    if (!user) {
      await sendMessage(chatId, env, {
        text: '❌ You are not registered yet. Please use /start to register first.'
      });
      return;
    }

    if (!user.SCWAddress) {
      await sendMessage(chatId, env, {
        text: '❌ No Smart Contract Wallet found. Please use /deposit to create one first.'
      });
      return;
    }

    // Send loading message
    await sendMessage(chatId, env, {
      text: `⏳ *Fetching your balances...*\n\nQuerying blockchain networks...`,
      parse_mode: 'Markdown'
    });

    // Call balance worker to get current balances
    const balanceResult = await callBalanceWorker(userId, user.SCWAddress, env);

    if (!balanceResult.success) {
      await sendMessage(chatId, env, {
        text: `❌ *Error fetching balances*\n\n${balanceResult.error}`
      });
      return;
    }

    // Find chains with available balances
    const chainsWithBalance = {};
    const chainIds = Object.keys(balanceResult.balances).sort((a, b) => parseInt(a) - parseInt(b));

    for (const chainId of chainIds) {
      const chain = balanceResult.balances[chainId];
      const tokensWithBalance = chain.tokens.filter(t => parseFloat(t.balanceFormatted) > 0);
      
      if (tokensWithBalance.length > 0) {
        // Build token summary
        const tokenSummary = tokensWithBalance.map(t => `${t.symbol}: ${t.balanceFormatted}`).join('\n');
        
        chainsWithBalance[chainId] = {
          chainName: chain.chainName,
          tokens: tokensWithBalance,
          tokenSummary: tokenSummary
        };
      }
    }

    if (Object.keys(chainsWithBalance).length === 0) {
      await sendMessage(chatId, env, {
        text: '💰 You have no tokens to withdraw.\n\nYour Smart Contract Wallet is empty.'
      });
      return;
    }

    // Build chain selection menu with token summaries
    let menuText = `💸 *Select a blockchain network to withdraw from:*\n\nAll tokens on the selected chain will be withdrawn to your wallet:\n\n`;
    
    for (const [chainId, chainData] of Object.entries(chainsWithBalance)) {
      menuText += `🔗 *${chainData.chainName}*\n${chainData.tokenSummary}\n\n`;
    }

    const keyboard = {
      inline_keyboard: Object.entries(chainsWithBalance).map(([chainId, chain]) => [
        {
          text: `💳 ${chain.chainName}`,
          callback_data: `withdraw_chain_${chainId}`
        }
      ])
    };

    await sendMessage(chatId, env, {
      text: menuText,
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  } catch (error) {
    console.error('Error in handleWithdraw:', error);
    await sendMessage(chatId, env, {
      text: '❌ An error occurred. Please try again later.'
    });
  }
}

/**
 * Handle /config command - show trading pair options
 */
async function handleConfig(chatId, env) {
  const keyboard = {
    inline_keyboard: [
      [{ text: '🟢 tgMetis-tgUSDC', callback_data: 'pair_tgmetis_tgusdc' }],
      [{ text: '🟢 tgETH-tgUSDC', callback_data: 'pair_tgeth_tgusdc' }],
      [{ text: '🔒 Metis-USDC', callback_data: 'pair_metis_usdc' }],
      [{ text: '🔒 ETH-USDC', callback_data: 'pair_eth_usdc' }]
    ]
  };

  await sendMessage(chatId, env, {
    text: `⚙️ *Let's Set Up Your Trading Strategy!*

First, choose which crypto pair you want to trade.

*Available on Testnet:*
🟢 = Active and ready
🔒 = Coming soon

Select a trading pair:`,
    parse_mode: 'Markdown',
    reply_markup: keyboard
  });
}

/**
 * Handle /deleteconfig command
 */
async function handleDeleteConfig(chatId, env) {
  const keyboard = {
    inline_keyboard: [
      [{ text: 'Delete tgMetis-tgUSDC', callback_data: 'del_tgMetis_tgUSDC' }],
      [{ text: 'Delete tgETH-tgUSDC', callback_data: 'del_tgETH_tgUSDC' }]
    ]
  };

  await sendMessage(chatId, env, {
    text: '🗑️ *Select Configuration to Delete*',
    parse_mode: 'Markdown',
    reply_markup: keyboard
  });
}

/**
 * Handle /help command
 */
async function handleHelp(chatId, env) {
  const commandList = COMMANDS.map(cmd => `/${cmd.command} - ${cmd.description}`).join('\n');

  await sendMessage(chatId, env, {
    text: `❓ *Available Commands:*\n\n${commandList}\n\n💡 *Tip:* Use the inline menu buttons for quick access!`,
    parse_mode: 'Markdown'
  });
}

/**
 * Send a generic TODO message
 */
async function sendTodoMessage(chatId, env, feature) {
  await sendMessage(chatId, env, {
    text: `✅ *TODO: ${feature}*\n\nThis feature is not yet implemented.`,
    parse_mode: 'Markdown'
  });
}

/**
 * Send a message to Telegram
 */
async function sendMessage(chatId, env, options) {
  try {
    const botToken = env.BOT_TOKEN;
    
    if (!botToken) {
      console.error('BOT_TOKEN not found in environment');
      throw new Error('BOT_TOKEN is not configured');
    }
    
    const url = `${TELEGRAM_API}${botToken}/sendMessage`;

    const payload = {
      chat_id: chatId,
      ...options
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    
    if (!result.ok) {
      console.error('Telegram API error:', result.description || result.error);
    }
    
    return result;
  } catch (error) {
    console.error('Error in sendMessage:', error.message);
    throw error;
  }
}

/**
 * Edit an existing message
 */
async function editMessage(chatId, messageId, env, options) {
  const botToken = env.BOT_TOKEN;
  const url = `${TELEGRAM_API}${botToken}/editMessageText`;

  const payload = {
    chat_id: chatId,
    message_id: messageId,
    ...options
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  return await response.json();
}

/**
 * Answer a callback query
 */
async function answerCallbackQuery(callbackQueryId, env) {
  const botToken = env.BOT_TOKEN;
  const url = `${TELEGRAM_API}${botToken}/answerCallbackQuery`;

  const payload = {
    callback_query_id: callbackQueryId
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  return await response.json();
}

/**
 * Call another worker via service binding
 */
async function callWorker(env, workerBinding, action, chatId, userId, username, text) {
  try {
    const response = await env[workerBinding].fetch('https://internal/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: action,
        chatId: chatId,
        userId: userId,
        username: username,
        text: text
      })
    });

    return await response.json();
  } catch (error) {
    console.error(`Error calling ${workerBinding}:`, error);
    throw error;
  }
}