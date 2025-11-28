/**
 * LazaiTrader Telegram Bot - Cloudflare Worker
 * Main entry point with deposit, withdrawal, and strategy features
 * 
 * Responsibilities:
 * - Handle all Telegram interactions
 * - Route to specialized workers (deposit, withdrawal, balance)
 * - Handle strategy management (config, read, delete)
 * - Display responses to users
 * - Handle all error messages and user guidance
 */

// Import strategy handlers
import {
  handleConfig,
  handleConfigPairSelected,
  handleStrategyConfigInput,
  handleViewConfig,
  handleDeleteConfig,
  handleDeleteStrategyConfirm
} from './helper.strategyhandlers.js';

import {
  handleWithdraw,
  handleWithdrawChain
} from './helper.withdrawalhandlers.js';

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
      // Clone request so body can be read
      const clonedRequest = request.clone();
      const update = await clonedRequest.json();

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
      await handleConfig(chatId, userId, env);
      break;
    case 'myconfig':
      await handleViewConfig(chatId, userId, env);
      break;
    case 'deleteconfig':
      await handleDeleteConfig(chatId, userId, env);
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
      // Check if this is a strategy configuration input (comma-separated numbers)
      if (text.includes(',') && !text.startsWith('/')) {
        const parts = text.split(',').map(p => parseFloat(p.trim()));
        if (parts.length === 5 && parts.every(p => !isNaN(p))) {
          // This looks like strategy config input
          await handleStrategyConfigInput(chatId, userId, parts[0], parts[1], parts[2], parts[3], parts[4], env);
          return;
        }
      }
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

  // Deposit flow
  if (data.startsWith('deposit_chain_')) {
    const chainId = parseInt(data.replace('deposit_chain_', ''));
    await handleDepositChain(chatId, userId, chainId, env);
  }
  // Strategy config: Step 1 - Pair selection
  else if (data.startsWith('pair_')) {
    const pairId = parseInt(data.replace('pair_', ''));
    await handleConfigPairSelected(chatId, userId, pairId, env);
  }
  // Strategy config: Step 2 - Risk level
  else if (data.startsWith('risk_')) {
    const parts = data.replace('risk_', '').split('_');
    const riskLevel = parts[0]; // 'low' or 'high'
    const pairId = parseInt(parts[1]);
    const { handleRiskSelection } = await import('./helper.strategyhandlers.js');
    await handleRiskSelection(chatId, userId, pairId, riskLevel, env);
  }
  // Strategy config: Step 3 - Trade percentage confirmation
  else if (data.startsWith('trade_')) {
    const parts = data.split('_');
    const action = parts[1]; // 'agree', 'less', 'more'
    const pairId = parseInt(parts[2]);
    let tradePercentage = parseFloat(parts[3]);

    if (action === 'less') {
      tradePercentage = Math.max(0.01, tradePercentage * 0.8);
    } else if (action === 'more') {
      tradePercentage = Math.min(1.0, tradePercentage * 1.2);
    }

    if (action !== 'agree') {
      // Delete old message and send new one with updated value
      try {
        await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN || env.TELEGRAM_BOT_TOKEN}/deleteMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, message_id: messageId })
        });
      } catch (e) { console.error('Delete error:', e); }
      
      // Get pair info
      const pair = await env.DB.prepare(
        `SELECT c.ChainName, bt.Symbol AS BaseSymbol, qt.Symbol AS QuoteSymbol
         FROM TradingPairs tp
         INNER JOIN Chains c ON tp.ChainID = c.ChainID
         INNER JOIN Tokens bt ON tp.BaseTokenID = bt.TokenID
         INNER JOIN Tokens qt ON tp.QuoteTokenID = qt.TokenID
         WHERE tp.PairID = ?`
      ).bind(pairId).first();

      const exampleBalance = 1000;
      const exampleTrade = exampleBalance * tradePercentage;
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
If you have \$${exampleBalance} available and set trade percentage to ${(tradePercentage * 100).toFixed(1)}%, each trade will use up to \$${exampleTrade.toFixed(2)}.

⚠️ *Risk Level:*
• Lower % = More conservative, smaller trades
• Higher % = More aggressive, larger trades

Click ✅ Confirm to continue, or adjust using the buttons below.`;

      await sendMessage(chatId, env, {
        text: message.trim(),
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });
    } else {
      // action === 'agree', move to trigger percentage step
      const { handleTradePercentage } = await import('./helper.strategyhandlers.js');
      await handleTradePercentage(chatId, userId, pairId, tradePercentage, env);
    }
  }
  // Strategy config: Step 4 - Trigger percentage confirmation
  else if (data.startsWith('trigger_')) {
    const parts = data.split('_');
    const action = parts[1]; // 'agree', 'less', 'more'
    const pairId = parseInt(parts[2]);
    const tradePercentage = parseFloat(parts[3]);
    let triggerPercentage = parseFloat(parts[4]);

    if (action === 'less') {
      triggerPercentage = Math.max(0.001, triggerPercentage * 0.8);
    } else if (action === 'more') {
      triggerPercentage = Math.min(0.3, triggerPercentage * 1.2);
    }

    if (action !== 'agree') {
      // Delete old message and send new one with updated value
      try {
        await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN || env.TELEGRAM_BOT_TOKEN}/deleteMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, message_id: messageId })
        });
      } catch (e) { console.error('Delete error:', e); }

      const examplePrice = 100;
      const triggerPrice = examplePrice * (1 - triggerPercentage);

      const keyboard = {
        inline_keyboard: [
          [{ text: '✅ Confirm', callback_data: `trigger_agree_${pairId}_${tradePercentage}_${triggerPercentage}` }],
          [
            { text: '📉 Less (-20%)', callback_data: `trigger_less_${pairId}_${tradePercentage}_${triggerPercentage}` },
            { text: '📈 More (+20%)', callback_data: `trigger_more_${pairId}_${tradePercentage}_${triggerPercentage}` }
          ]
        ]
      };

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
    } else {
      // action === 'agree', move to max amount step
      const { handleTriggerPercentage } = await import('./helper.strategyhandlers.js');
      await handleTriggerPercentage(chatId, userId, pairId, tradePercentage, triggerPercentage, env);
    }
  }
  // Strategy config: Step 5 - Max amount confirmation
  else if (data.startsWith('max_')) {
    const parts = data.split('_');
    const action = parts[1]; // 'agree', 'less', 'more'
    const pairId = parseInt(parts[2]);
    const tradePercentage = parseFloat(parts[3]);
    const triggerPercentage = parseFloat(parts[4]);
    let maxAmount = parseFloat(parts[5]);

    if (action === 'less') {
      maxAmount = Math.max(1.0, maxAmount * 0.8);
    } else if (action === 'more') {
      maxAmount = Math.min(1000.0, maxAmount * 1.2);
    }

    if (action !== 'agree') {
      // Delete old message and send new one with updated value
      try {
        await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN || env.TELEGRAM_BOT_TOKEN}/deleteMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, message_id: messageId })
        });
      } catch (e) { console.error('Delete error:', e); }

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
• Your trade percentage is ${(tradePercentage * 100).toFixed(1)}% of available funds
• Your available balance is \$1,000
• Without a limit, each trade could be \$${(1000 * tradePercentage).toFixed(2)}
• But with a \$${maxAmount.toFixed(2)} max limit, trades will cap at \$${Math.min(1000 * tradePercentage, maxAmount).toFixed(2)}

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
    } else {
      // action === 'agree', move to summary step
      const { handleMaxAmount } = await import('./helper.strategyhandlers.js');
      await handleMaxAmount(chatId, userId, pairId, tradePercentage, triggerPercentage, maxAmount, env);
    }
  }
  // Strategy config: Step 6 - Final confirmation
  else if (data.startsWith('final_confirm_')) {
    const parts = data.split('_');
    const pairId = parseInt(parts[2]);
    const tradePercentage = parseFloat(parts[3]);
    const triggerPercentage = parseFloat(parts[4]);
    const maxAmount = parseFloat(parts[5]);
    const multiplier = 1.5; // Default multiplier

    const { handleStrategyConfigInput } = await import('./helper.strategyhandlers.js');
    await handleStrategyConfigInput(chatId, userId, pairId, tradePercentage, triggerPercentage, maxAmount, multiplier, env);
  }
  // Delete config: Select which one
  else if (data.startsWith('del_') && data.split('_').length === 2) {
    const configId = parseInt(data.replace('del_', ''));
    const { handleDeleteStrategyConfirm } = await import('./helper.strategyhandlers.js');
    await handleDeleteStrategyConfirm(chatId, userId, configId, env);
  }
  // Delete config: Confirm deletion
  else if (data.startsWith('confirm_del_')) {
    const configId = parseInt(data.replace('confirm_del_', ''));
    try {
      await env.DB.prepare(
        'DELETE FROM UserTradingConfigs WHERE ConfigID = ? AND UserID = ?'
      ).bind(configId, userId).run();
      
      await sendMessage(chatId, env, {
        text: '✅ *Configuration Deleted*\n\nYour strategy has been removed.',
        parse_mode: 'Markdown'
      });
    } catch (error) {
      console.error('Error deleting config:', error);
      await sendMessage(chatId, env, {
        text: '❌ Error deleting configuration.'
      });
    }
  }
  // Delete config: Cancel deletion
  else if (data.startsWith('cancel_del_')) {
    await sendMessage(chatId, env, {
      text: '👍 Deletion cancelled. Your configuration is safe.'
    });
  }
  // Withdraw flow
  else if (data.startsWith('withdraw_')) {
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
/**
 * Generic worker caller for service bindings
 */
async function callWorker(env, workerName, action, chatId, userId, username, text) {
  try {
    const workerBinding = env[workerName];
    if (!workerBinding) {
      console.error(`Worker binding ${workerName} not found`);
      return {
        success: false,
        error: `Worker ${workerName} not configured`
      };
    }

    const response = await workerBinding.fetch('https://internal/handle', {
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

    const result = await response.json();
    return result;
  } catch (error) {
    console.error(`Error calling ${workerName}:`, error);
    return {
      success: false,
      error: error.message,
      errorCode: 'WORKER_ERROR'
    };
  }
}

/**
 * Call deposit worker for SCW deployment
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
 * Withdrawal logic imported from helper.withdrawalhandlers.js
 */

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
export async function callBalanceWorker(userId, scwAddress, env) {
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
 * Withdrawal handlers imported from helper.withdrawalhandlers.js
 */

/**
 * Helper Functions
 */

/**
 * Send message to Telegram chat
 */
export async function sendMessage(chatId, env, options) {
  const token = env.TELEGRAM_BOT_TOKEN || env.BOT_TOKEN;
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  
  const body = {
    chat_id: chatId,
    ...options
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Telegram error: ${response.status}`, errorText);
      return { ok: false, error: errorText };
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
}

/**
 * Answer callback query to remove loading state
 */
async function answerCallbackQuery(callbackQueryId, env) {
  try {
    const token = env.TELEGRAM_BOT_TOKEN || env.BOT_TOKEN;
    const url = `https://api.telegram.org/bot${token}/answerCallbackQuery`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId
      })
    });
  } catch (error) {
    console.error('Error answering callback query:', error);
  }
}

/**
 * Edit message text
 */
async function editMessage(chatId, messageId, env, options) {
  try {
    const token = env.TELEGRAM_BOT_TOKEN || env.BOT_TOKEN;
    const url = `https://api.telegram.org/bot${token}/editMessageText`;
    const body = {
      chat_id: chatId,
      message_id: messageId,
      ...options
    };

    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  } catch (error) {
    console.error('Error editing message:', error);
  }
}