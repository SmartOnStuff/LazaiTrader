/**
 * LazaiTrader Registration Worker
 * Handles user registration and wallet verification
 * Only callable via Service Binding from lt_tg worker
 */

const TELEGRAM_API = 'https://api.telegram.org/bot';

export default {
  async fetch(request, env) {
    // Only accept POST requests
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    try {
      const { action, chatId, userId, username, text } = await request.json();

      switch (action) {
        case 'start':
          return await handleStart(chatId, userId, username, env);
        case 'legal_agreed':
          return await handleLegalAgreed(chatId, userId, username, env);
        case 'verify_wallet':
          return await handleWalletVerification(chatId, userId, username, text, env);
        default:
          return new Response(JSON.stringify({ error: 'Invalid action' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
      }
    } catch (error) {
      console.error('Error in lt_tg_start worker:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};

/**
 * Handle start command - check if user exists or show intro
 */
async function handleStart(chatId, userId, username, env) {
  try {
    // Check if user already exists
    const existingUser = await env.DB.prepare(
      'SELECT * FROM Users WHERE UserID = ?'
    ).bind(userId).first();

    if (existingUser) {
      // User already registered - check if they have SCW
      if (existingUser.SCWAddress) {
        // User has SCW - welcome back
        const message = {
          chat_id: chatId,
          text: `👋 *Welcome back, ${username || 'trader'}!*\n\n` +
            `Your account is active and ready to trade!\n\n` +
            `📋 *Your Details:*\n` +
            `💼 Your Wallet: \`${existingUser.UserWallet}\`\n` +
            `🔐 Trading Wallet: \`${existingUser.SCWAddress}\`\n\n` +
            `*Quick Actions:*\n` +
            `💰 /balance - Check your funds\n` +
            `📈 /chart - See your performance\n` +
            `⚙️ /config - Set up trading strategy\n` +
            `💸 /withdraw - Cash out profits\n\n` +
            `💡 Ready to trade? Your AI is watching the markets 24/7!`,
          parse_mode: 'Markdown'
        };

        await sendMessage(env.BOT_TOKEN, message);

        return new Response(JSON.stringify({
          success: true,
          registered: true,
          hasSCW: true
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } else {
        // User exists but no SCW - deploy it now
        console.log(`[handleStart] User ${userId} exists but has no SCW, deploying...`);

        const processingMessage = {
          chat_id: chatId,
          text: `⏳ *Setting up your Smart Contract Wallet...*\n\n` +
            `🔧 Deploying your trading wallet on all chains\n` +
            `⚡ This may take 30-60 seconds\n\n` +
            `Please wait... ✨`,
          parse_mode: 'Markdown'
        };

        await sendMessage(env.BOT_TOKEN, processingMessage);

        // Deploy SCW on all supported chains
        const depositResult = await callDepositWorker(userId, existingUser.UserWallet, env);

        if (!depositResult.success) {
          console.error(`[handleStart] SCW deployment failed:`, depositResult.error);
          const errorMessage = {
            chat_id: chatId,
            text: `⚠️ *Setup Incomplete*\n\n` +
              `We encountered an issue deploying your Smart Contract Wallet.\n\n` +
              `*What to do:*\n` +
              `Please try /start again or contact support: @LazaiTraderDev\n\n` +
              `Error: ${depositResult.error || 'Unknown error'}`,
            parse_mode: 'Markdown'
          };
          await sendMessage(env.BOT_TOKEN, errorMessage);
          return new Response(JSON.stringify({
            success: false,
            error: 'SCW deployment failed',
            errorCode: depositResult.errorCode
          }), {
            headers: { 'Content-Type': 'application/json' }
          });
        }

        const scwAddress = depositResult.scwAddress;
        console.log(`[handleStart] SCW deployed successfully: ${scwAddress}`);

        // Analyze deployment results
        const deployments = depositResult.deployments || [];
        const successfulChains = deployments.filter(d => d.status === 'deployed' || d.status === 'already_exists');
        const failedChains = deployments.filter(d => d.status === 'failed');

        console.log(`[handleStart] Deployment summary: ${successfulChains.length} successful, ${failedChains.length} failed`);

        // Build deployment status message
        let deploymentStatus = '';
        if (failedChains.length > 0) {
          deploymentStatus = `\n⚠️ *Deployment Status:*\n`;
          deploymentStatus += `✅ Deployed on ${successfulChains.length} chains\n`;
          deploymentStatus += `❌ Failed on ${failedChains.length} chains: ${failedChains.map(c => c.chainName).join(', ')}\n\n`;
          deploymentStatus += `_Failed chains will be retried. Please contact support if issues persist._\n\n`;
        } else {
          deploymentStatus = `\n✅ *Successfully deployed on all ${successfulChains.length} chains!*\n\n`;
        }

        // Get chains info for display (only successful ones)
        let chainInfo = '';
        for (const deployment of successfulChains) {
          const tokens = await env.DB.prepare(
            'SELECT Symbol FROM Tokens WHERE ChainID = ? AND IsActive = 1 ORDER BY Symbol'
          ).bind(deployment.chainId).all();

          const tokenList = tokens?.results?.map(t => t.Symbol).join(', ') || '(Loading...)';
          chainInfo += `\n🔗 *${deployment.chainName}:* ${tokenList}`;
        }

        // Send success message
        const successMessage = {
          chat_id: chatId,
          text: `✅ *Smart Contract Wallet Deployed!*\n\n` +
            `Your trading wallet is now ready!\n\n` +
            `📋 *Your Details:*\n` +
            `💼 Your Wallet (EOA): \`${existingUser.UserWallet}\`\n` +
            `🔐 Trading Wallet (SCW): \`${scwAddress}\`\n` +
            deploymentStatus +
            `💰 *Available Networks & Tokens:*${chainInfo}\n\n` +
            `━━━━━━━━━━━━━━━━━━━━\n\n` +
            `*Quick Commands:*\n` +
            `/deposit - View your deposit address\n` +
            `/config - Set up your trading strategy\n` +
            `/balance - Check your funds\n` +
            `/help - See all commands\n\n` +
            `Let's make some profits! 💎`,
          parse_mode: 'Markdown'
        };

        await sendMessage(env.BOT_TOKEN, successMessage);

        return new Response(JSON.stringify({
          success: true,
          registered: true,
          scwDeployed: true,
          scwAddress: scwAddress
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // New user - show legal disclaimer first before registration
    const legalMessage = {
      chat_id: chatId,
      text: `🎉 *Welcome to LazaiTrader!*\n\n` +
        `I'm your AI-powered trading assistant.\n\n` +
        `⚠️ *IMPORTANT: Please Read Before Continuing*\n\n` +
        `Before you can use LazaiTrader, you must acknowledge our terms:\n\n` +
        `📋 *Key Points:*\n` +
        `• This is *BETA software* - bugs may occur\n` +
        `• Smart contracts are *NOT audited*\n` +
        `• Automated trading involves *significant risk*\n` +
        `• You may *lose all deposited funds*\n` +
        `• LazaiTrader is *non-custodial* - you control your funds\n` +
        `• Service is *not available* in restricted jurisdictions (US, sanctioned countries)\n\n` +
        `📖 *Full Legal Documentation:*\n` +
        `[Terms of Service](http://docs.lazaitrader.com/legal/TERMS_OF_SERVICE)\n` +
        `[Disclaimer](http://docs.lazaitrader.com/legal/DISCLAIMER)\n` +
        `[Privacy Policy](http://docs.lazaitrader.com/legal/PRIVACY_POLICY)\n` +
        `[Restricted Jurisdictions](http://docs.lazaitrader.com/legal/RESTRICTED_JURISDICTIONS)\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `By clicking "I Agree", you confirm that:\n` +
        `✅ You have read and understood the terms\n` +
        `✅ You are NOT in a restricted jurisdiction\n` +
        `✅ You accept all risks of using this beta software\n` +
        `✅ You will not hold LazaiTrader liable for any losses`,
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
      reply_markup: {
        inline_keyboard: [
          [{ text: '✅ I Agree to Terms & Conditions', callback_data: 'legal_agree' }],
          [{ text: '📖 Read Full Terms', url: 'http://docs.lazaitrader.com/legal/TERMS_OF_SERVICE' }]
        ]
      }
    };

    await sendMessage(env.BOT_TOKEN, legalMessage);

    // Store pending registration state - awaiting legal agreement
    await env.DB.prepare(
      `INSERT OR REPLACE INTO RegistrationSessions (UserID, TelegramChatID, Username, State, CreatedAt)
       VALUES (?, ?, ?, 'awaiting_legal', datetime('now'))`
    ).bind(userId, chatId, username || '').run();

    return new Response(JSON.stringify({
      success: true,
      registered: false,
      awaiting: 'legal_agreement'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in handleStart:', error);
    throw error;
  }
}

/**
 * Handle legal agreement - user clicked "I Agree"
 * Now ask for their wallet address
 */
async function handleLegalAgreed(chatId, userId, username, env) {
  try {
    // Verify user is in the awaiting_legal state
    const session = await env.DB.prepare(
      'SELECT State FROM RegistrationSessions WHERE UserID = ?'
    ).bind(userId).first();

    if (!session || session.State !== 'awaiting_legal') {
      // User might have already agreed or session expired
      const message = {
        chat_id: chatId,
        text: `⚠️ Session expired or already completed.\n\nPlease use /start to begin again.`,
        parse_mode: 'Markdown'
      };
      await sendMessage(env.BOT_TOKEN, message);
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid session state'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Record legal agreement timestamp
    const agreedAt = new Date().toISOString();

    // Update session to awaiting_wallet and record agreement
    await env.DB.prepare(
      `UPDATE RegistrationSessions
       SET State = 'awaiting_wallet', LegalAgreedAt = ?
       WHERE UserID = ?`
    ).bind(agreedAt, userId).run();

    // Now ask for wallet address
    const walletMessage = {
      chat_id: chatId,
      text: `✅ *Terms Accepted!*\n\n` +
        `Thank you for accepting our terms. Now let's set up your account!\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `🤖 *How LazaiTrader Works:*\n\n` +
        `• I trade for you 24/7 based on your strategy\n` +
        `• You stay in control - set your own rules\n` +
        `• No manual trading needed\n\n` +
        `🔐 *Your Funds, Your Control:*\n\n` +
        `• You provide your wallet address\n` +
        `• We create a secure Smart Contract Wallet for trading\n` +
        `• Only YOU can withdraw - we can't touch your funds\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `*Let's get started!* 🚀\n\n` +
        `Please send me your **Ethereum wallet address**.\n\n` +
        `💡 *What's a wallet address?*\n` +
        `It's like your crypto bank account number. It starts with "0x" and looks like:\n` +
        `\`0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb\`\n\n` +
        `*Where to find it:*\n` +
        `• MetaMask app: Tap your address at the top\n` +
        `• Trust Wallet: Tap "Receive" → Copy address\n` +
        `• Any EVM wallet: Look for "Receive" or "Address"\n\n` +
        `Just copy and paste it here! 👇`,
      parse_mode: 'Markdown'
    };

    await sendMessage(env.BOT_TOKEN, walletMessage);

    return new Response(JSON.stringify({
      success: true,
      legalAgreed: true,
      agreedAt: agreedAt,
      awaiting: 'wallet'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in handleLegalAgreed:', error);
    throw error;
  }
}

/**
 * Handle wallet address verification and user registration
 */
async function handleWalletVerification(chatId, userId, username, walletAddress, env) {
  try {
    // Validate wallet address format
    const validation = validateEthereumAddress(walletAddress);

    if (!validation.valid) {
      const errorMessage = {
        chat_id: chatId,
        text: `⚠️ *Hmm, that doesn't look right...*\n\n` +
          `${validation.error}\n\n` +
          `*What I need:*\n` +
          `• Must start with "0x"\n` +
          `• Must be exactly 42 characters\n` +
          `• Contains only numbers and letters (A-F)\n\n` +
          `*Example:*\n` +
          `\`0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb\`\n\n` +
          `💡 *Quick tip:* Just copy it from your wallet app and paste it here.\n\n` +
          `Try again! 👇`,
        parse_mode: 'Markdown'
      };

      await sendMessage(env.BOT_TOKEN, errorMessage);

      return new Response(JSON.stringify({
        success: false,
        error: validation.error
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Normalize address to checksum format
    const normalizedAddress = walletAddress.toLowerCase();

    // Check if wallet is already registered
    const existingWallet = await env.DB.prepare(
      'SELECT UserID, Username FROM Users WHERE LOWER(UserWallet) = ?'
    ).bind(normalizedAddress).first();

    if (existingWallet) {
      const errorMessage = {
        chat_id: chatId,
        text: `🔒 *This wallet is already registered!*\n\n` +
          `Someone has already linked this wallet to LazaiTrader.\n\n` +
          `*What this means:*\n` +
          `• Each wallet can only have one account\n` +
          `• This keeps your funds secure\n` +
          `• Prevents duplicate trading strategies\n\n` +
          `*Your options:*\n` +
          `✅ Use a different wallet address\n` +
          `✅ Contact support if this is your wallet: @lazaitrader_support\n\n` +
          `Send a different wallet address to continue! 👇`,
        parse_mode: 'Markdown'
      };

      await sendMessage(env.BOT_TOKEN, errorMessage);

      return new Response(JSON.stringify({
        success: false,
        error: 'Wallet already registered'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Send processing message
    const processingMessage = {
      chat_id: chatId,
      text: `⏳ *Setting up your account...*\n\n` +
        `🔧 Creating your secure trading system\n` +
        `⚡ This may take 30-60 seconds\n\n` +
        `*What we're doing:*\n` +
        `• Verifying your wallet address\n` +
        `• Setting up your profile\n` +
        `• Deploying Smart Contract Wallets on all chains\n` +
        `• Preparing your trading dashboard\n\n` +
        `Please wait... ✨`,
      parse_mode: 'Markdown'
    };

    await sendMessage(env.BOT_TOKEN, processingMessage);

    // Register user in database
    const now = new Date().toISOString();
    await env.DB.prepare(
      `INSERT INTO Users (UserID, UserWallet, TelegramChatID, Username, RegisteredAt, IsActive, CreatedAt)
       VALUES (?, ?, ?, ?, ?, 1, ?)`
    ).bind(userId, walletAddress, chatId, username || '', now, now).run();

    // Clear registration session
    await env.DB.prepare(
      'DELETE FROM RegistrationSessions WHERE UserID = ?'
    ).bind(userId).run();

    // Deploy SCW on all supported chains
    console.log(`[handleWalletVerification] Deploying SCW for user ${userId}...`);
    const depositResult = await callDepositWorker(userId, walletAddress, env);

    if (!depositResult.success) {
      console.error(`[handleWalletVerification] SCW deployment failed:`, depositResult.error);
      // Registration still succeeded, but SCW deployment failed
      const errorMessage = {
        chat_id: chatId,
        text: `⚠️ *Account Created, but Setup Incomplete*\n\n` +
          `Your account was created successfully, but we encountered an issue deploying your Smart Contract Wallet.\n\n` +
          `*What this means:*\n` +
          `• Your account is registered\n` +
          `• But you can't trade yet\n\n` +
          `*What to do:*\n` +
          `Please contact support: @LazaiTraderDev\n\n` +
          `Error: ${depositResult.error || 'Unknown error'}`,
        parse_mode: 'Markdown'
      };
      await sendMessage(env.BOT_TOKEN, errorMessage);
      return new Response(JSON.stringify({
        success: false,
        error: 'SCW deployment failed',
        errorCode: depositResult.errorCode
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const scwAddress = depositResult.scwAddress;
    console.log(`[handleWalletVerification] SCW deployed successfully: ${scwAddress}`);

    // Analyze deployment results
    const deployments = depositResult.deployments || [];
    const successfulChains = deployments.filter(d => d.status === 'deployed' || d.status === 'already_exists');
    const failedChains = deployments.filter(d => d.status === 'failed');

    console.log(`[handleWalletVerification] Deployment summary: ${successfulChains.length} successful, ${failedChains.length} failed`);

    // Build deployment status message
    let deploymentStatus = '';
    if (failedChains.length > 0) {
      deploymentStatus = `\n⚠️ *Deployment Status:*\n`;
      deploymentStatus += `✅ Deployed on ${successfulChains.length} chains\n`;
      deploymentStatus += `❌ Failed on ${failedChains.length} chains: ${failedChains.map(c => c.chainName).join(', ')}\n\n`;
      deploymentStatus += `_Failed chains will be retried. Please contact support if issues persist._\n\n`;
    } else {
      deploymentStatus = `\n✅ *Successfully deployed on all ${successfulChains.length} chains!*\n\n`;
    }

    // Get chains info for display (only successful ones)
    let chainInfo = '';
    for (const deployment of successfulChains) {
      const tokens = await env.DB.prepare(
        'SELECT Symbol FROM Tokens WHERE ChainID = ? AND IsActive = 1 ORDER BY Symbol'
      ).bind(deployment.chainId).all();

      const tokenList = tokens?.results?.map(t => t.Symbol).join(', ') || '(Loading...)';
      chainInfo += `\n🔗 *${deployment.chainName}:* ${tokenList}`;
    }

    // Send success message with SCW info
    const successMessage = {
      chat_id: chatId,
      text: `🎉 *You're all set!*\n\n` +
        `Your LazaiTrader account is ready!\n\n` +
        `📋 *Your Details:*\n` +
        `💼 Your Wallet (EOA): \`${walletAddress}\`\n` +
        `🔐 Trading Wallet (SCW): \`${scwAddress}\`\n` +
        `👤 Telegram: @${username || 'N/A'}\n` +
        deploymentStatus +
        `💰 *Available Networks & Tokens:*${chainInfo}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `🚀 *Next Steps:*\n\n` +
        `*1️⃣ Fund Your Trading Wallet* 💰\n` +
        `Use /deposit to see your deposit address\n` +
        `Send tokens from your exchange or wallet\n` +
        `Only you can withdraw from it!\n\n` +
        `*2️⃣ Set Your Strategy* ⚙️\n` +
        `Use /config to tell me how you want to trade:\n` +
        `• Choose trading pairs (e.g., ETH-USDC)\n` +
        `• Set your risk level\n` +
        `• Define buy/sell triggers\n\n` +
        `*3️⃣ Start Trading* 📈\n` +
        `Once funded and configured, I'll trade automatically 24/7\n` +
        `Check progress anytime with /balance or /chart\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `*Quick Commands:*\n` +
        `/deposit - View your deposit address\n` +
        `/config - Set up your first strategy\n` +
        `/balance - Check your funds\n` +
        `/help - See all commands\n\n` +
        `Let's make some profits! 💎`,
      parse_mode: 'Markdown'
    };

    await sendMessage(env.BOT_TOKEN, successMessage);

    return new Response(JSON.stringify({
      success: true,
      registered: true,
      userId: userId,
      walletAddress: walletAddress
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in handleWalletVerification:', error);

    // Send error message to user
    const errorMessage = {
      chat_id: chatId,
      text: `❌ *Oops! Something went wrong*\n\n` +
        `We couldn't complete your registration right now.\n\n` +
        `*Error:* ${error.message}\n\n` +
        `*What to do:*\n` +
        `• Wait a moment and try /start again\n` +
        `• Contact support if this keeps happening\n\n` +
        `Sorry for the inconvenience! 🙏`,
      parse_mode: 'Markdown'
    };

    await sendMessage(env.BOT_TOKEN, errorMessage);

    throw error;
  }
}

/**
 * Validate Ethereum address format
 */
function validateEthereumAddress(address) {
  if (!address || typeof address !== 'string') {
    return { valid: false, error: 'Please provide a wallet address' };
  }

  const trimmed = address.trim();

  // Check if starts with 0x
  if (!trimmed.startsWith('0x')) {
    return { valid: false, error: 'Wallet address must start with "0x"' };
  }

  // Check length (0x + 40 hex chars = 42)
  if (trimmed.length !== 42) {
    return {
      valid: false,
      error: `Wallet address must be 42 characters (yours is ${trimmed.length})`
    };
  }

  // Check if contains only valid hex characters
  const hexPart = trimmed.slice(2);
  if (!/^[0-9a-fA-F]+$/.test(hexPart)) {
    return {
      valid: false,
      error: 'Wallet address contains invalid characters (only 0-9 and A-F allowed)'
    };
  }

  return { valid: true };
}

/**
 * Call deposit worker for SCW deployment
 */
async function callDepositWorker(userId, userWallet, env) {
  try {
    const response = await env.DEPOSIT_WORKER.fetch('https://internal/scw-deploy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: userId,
        userWallet: userWallet
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
 * Send message to Telegram
 */
async function sendMessage(botToken, messageData) {
  const url = `${TELEGRAM_API}${botToken}/sendMessage`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(messageData)
  });

  const result = await response.json();

  if (!result.ok) {
    console.error('Telegram API error:', result);
    throw new Error(`Telegram API error: ${result.description}`);
  }

  return result;
}
