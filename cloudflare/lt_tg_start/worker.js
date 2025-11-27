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
      // User already registered - welcome back
      const message = {
        chat_id: chatId,
        text: `👋 *Welcome back, ${username || 'trader'}!*\n\n` +
          `Your account is active and ready to trade!\n\n` +
          `📋 *Your Details:*\n` +
          `💼 Your Wallet: \`${existingUser.UserWallet}\`\n` +
          (existingUser.SCWAddress ? `🔐 Trading Wallet: \`${existingUser.SCWAddress}\`\n\n` : '\n') +
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
        registered: true
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // New user - show intro and request wallet
    const introMessage = {
      chat_id: chatId,
      text: `🎉 *Welcome to LazaiTrader!*\n\n` +
        `I'm your AI-powered trading assistant. Here's how it works:\n\n` +
        `🤖 *Automated Trading*\n` +
        `• I trade for you 24/7 based on your strategy\n` +
        `• You stay in control - set your own rules\n` +
        `• No manual trading needed\n\n` +
        `🔐 *Your Funds, Your Control*\n` +
        `• You provide your wallet address\n` +
        `• We create a secure Smart Contract Wallet for trading\n` +
        `• Only YOU can withdraw - we can't touch your funds\n\n` +
        `📊 *Smart Strategy*\n` +
        `• Set your risk level (conservative or aggressive)\n` +
        `• Define when to buy/sell automatically\n` +
        `• Track performance with real-time charts\n\n` +
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

    await sendMessage(env.BOT_TOKEN, introMessage);

    // Store pending registration state
    await env.DB.prepare(
      `INSERT OR REPLACE INTO RegistrationSessions (UserID, TelegramChatID, Username, State, CreatedAt)
       VALUES (?, ?, ?, 'awaiting_wallet', datetime('now'))`
    ).bind(userId, chatId, username || '').run();

    return new Response(JSON.stringify({
      success: true,
      registered: false,
      awaiting: 'wallet'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in handleStart:', error);
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
        `⚡ This takes about 10-30 seconds\n\n` +
        `*What we're doing:*\n` +
        `• Verifying your wallet address\n` +
        `• Setting up your profile\n` +
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

    // Send success message
    const successMessage = {
      chat_id: chatId,
      text: `🎉 *You're all set!*\n\n` +
        `Your LazaiTrader account is ready!\n\n` +
        `📋 *Your Details:*\n` +
        `💼 Wallet: \`${walletAddress}\`\n` +
        `👤 Telegram: @${username || 'N/A'}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `🚀 *Next Steps:*\n\n` +
        `*1️⃣ Set Your Strategy* ⚙️\n` +
        `Use /config to tell me how you want to trade:\n` +
        `• Choose trading pairs (e.g., ETH-USDC)\n` +
        `• Set your risk level\n` +
        `• Define buy/sell triggers\n\n` +
        `*2️⃣ Fund Your Trading Wallet* 💰\n` +
        `We'll create a Smart Contract Wallet for you\n` +
        `Only you can withdraw from it!\n\n` +
        `*3️⃣ Start Trading* 📈\n` +
        `Once funded, I'll trade automatically 24/7\n` +
        `Check progress anytime with /balance or /chart\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `*Quick Commands:*\n` +
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
