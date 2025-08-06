from telegram import BotCommand
import json
import os
import random
import pathlib
from pathlib import Path
from telegram import (
    Update,
    InlineKeyboardButton,
    InlineKeyboardMarkup
)
from telegram.ext import (
    ApplicationBuilder,
    CommandHandler,
    MessageHandler,
    CallbackQueryHandler,
    ConversationHandler,
    filters,
    ContextTypes
)
from dotenv import load_dotenv
from web3 import Web3

# Load environment variables
BASE_PATH = pathlib.Path(__file__).parent.parent  # adjust as needed
load_dotenv(dotenv_path=BASE_PATH / ".env")

# Get bot token and RPC URL
bot_token = os.getenv("TELEGRAM_BOT_TOKEN")
RPC_URL = os.getenv('RPC_URL', "https://hyperion-testnet.metisdevops.link")

# File paths
PROJECT_ROOT = pathlib.Path(__file__).resolve().parent.parent
USERS_FILE = PROJECT_ROOT / "config" / "users.json"
CONFIG_PATH = PROJECT_ROOT / "config" / "config.json"
TOKENS_FILE = PROJECT_ROOT / "config" / "tokens.json"

PLUGIN_DIR = pathlib.Path(__file__).resolve().parent
ADDRESSES_FILE = PLUGIN_DIR / "addresses.txt"

# Conversation states
PAIR_SELECT, RISK, TRADE_PERCENTAGE_CONFIRM, TRIGGER_PERCENTAGE_CONFIRM, MAX_AMOUNT_CONFIRM, FINALIZE = range(6)

# ERC20 ABI for balance queries
ERC20_ABI = json.loads("""[
  {"constant":true,"inputs":[{"name":"account","type":"address"}],
   "name":"balanceOf","outputs":[{"name":"","type":"uint256"}],"type":"function"},
  {"constant":true,"inputs":[],"name":"decimals",
   "outputs":[{"name":"","type":"uint8"}],"type":"function"},
  {"constant":true,"inputs":[],"name":"symbol",
   "outputs":[{"name":"","type":"string"}],"type":"function"}
]""")

# User management functions
def load_users():
    if not os.path.exists(USERS_FILE):
        return {"users": {}}
    with open(USERS_FILE, "r") as f:
        return json.load(f)

def save_users(data):
    os.makedirs(os.path.dirname(USERS_FILE), exist_ok=True)
    with open(USERS_FILE, "w") as f:
        json.dump(data, f, indent=2)

def load_addresses():
    if not os.path.exists(ADDRESSES_FILE):
        return []
    with open(ADDRESSES_FILE, "r") as f:
        return json.load(f)

def save_addresses(addrs):
    with open(ADDRESSES_FILE, "w") as f:
        json.dump(addrs, f, indent=2)

def get_next_wallet():
    addrs = load_addresses()
    if not addrs:
        return None
    next_wallet = addrs.pop(0)
    save_addresses(addrs)
    return next_wallet

def load_tokens():
    """Load token information from tokens.json"""
    if not os.path.exists(TOKENS_FILE):
        return {}
    with open(TOKENS_FILE, "r") as f:
        data = json.load(f)
        return data.get("tokens", {})

def get_wallet_balances(wallet_address):
    """Get wallet balances for all configured tokens"""
    try:
        w3 = Web3(Web3.HTTPProvider(RPC_URL))
        if not w3.is_connected():
            return None
        
        tokens = load_tokens()
        balances = {}
        
        wallet_address = Web3.to_checksum_address(wallet_address)
        
        for symbol, token_info in tokens.items():
            try:
                token_address = Web3.to_checksum_address(token_info['address'])
                contract = w3.eth.contract(address=token_address, abi=ERC20_ABI)
                
                balance_raw = contract.functions.balanceOf(wallet_address).call()
                decimals = token_info.get('decimals', 18)
                balance = balance_raw / (10 ** decimals)
                
                balances[symbol] = {
                    'balance': balance,
                    'symbol': symbol
                }
            except Exception as e:
                balances[symbol] = {
                    'balance': 0.0,
                    'symbol': symbol,
                    'error': str(e)
                }
        
        return balances
    except Exception as e:
        return None

# Placeholder function for when all wallets are used
async def handle_no_wallets_available(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    Placeholder function to handle the case when all 100 wallets from addresses.txt have been used.
    This could implement a waitlist, notify admins, or other fallback behavior.
    """
    await update.message.reply_text(
        "🚫 All test wallets are currently assigned.\n\n"
        "We're at capacity for the Hyperion Testnet phase. "
        "Please check back later or contact support for updates."
    )

# Config management functions
def round_to_one_decimal(value):
    """Round value to (actually 2) decimal place"""
    return round(value, 2)

def save_config_entry(user_id, config_data):
    os.makedirs(CONFIG_PATH.parent, exist_ok=True)
    
    if not os.path.exists(CONFIG_PATH):
        config = {"trading_pairs": []}
    else:
        with open(CONFIG_PATH, "r") as f:
            config = json.load(f)

    # Remove existing config for same user/pair combination
    config["trading_pairs"] = [
        entry for entry in config["trading_pairs"]
        if not (entry["userID"] == user_id and entry["symbol1"] == config_data["symbol1"] and entry["symbol2"] == config_data["symbol2"])
    ]

    config["trading_pairs"].append(config_data)

    with open(CONFIG_PATH, "w") as f:
        json.dump(config, f, indent=2)

# Command handlers
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = str(update.effective_user.id)
    username = update.effective_user.username or ""
    data = load_users()

    # Check if already registered
    if chat_id in data["users"]:
        await update.message.reply_text(
            "👋 *Welcome back to LazaiTrader!* 🎉\n\n"
            "🚀 *Hyperion Testnet Phase* (until Aug 7, 2025)\n"
            "💼 Wallet funded with: 100 TESTgUSDC + 10 000 000 TESTgMetis. Find your wallet address: /wallet \n\n"
            "🔧 Configure your Martingale strategy: /config\n"
            "   • Set trade %, trigger %, multiplier & max/min amounts\n\n"
            "🤖 Our AI monitors prices, executes trades & sends real-time summaries\n\n"
            "🏆 Top 3 testers share $100 in rewards ($50 / $25 / $25)\n\n"
            "💰 Check balances: /balance\n"
            "💸 Withdraw funds: /withdraw\n\n"
            "💬 To chat with our Alith-powered agent and explore all commands, LazaiTrader tips visit @LazaiTrader group!",
            parse_mode='Markdown'
        )
        return

    # Assign the next available wallet
    wallet = get_next_wallet()
    if not wallet:
        await handle_no_wallets_available(update, context)
        return

    # Save new user
    data["users"][chat_id] = {
        "wallet_address": wallet,
        "telegram_chat_id": chat_id,
        "username": username if username else chat_id  # Use chat_id if username is empty
    }
    save_users(data)

    await update.message.reply_text(
        f"👋 *Welcome to LazaiTrader @{username}!* 🎉\n\n"
        f"Your wallet is: `{wallet}`\n\n"
        "🚀 *Hyperion Testnet Phase* (until Aug 7, 2025)\n"
        "💼 Wallet funded with: 100 TESTgUSDC + 10 000 000 TESTgMetis. Find your wallet address: /wallet \n\n"
        "the fluctuation depends on gMetis price on Metis Andromeda - Hercules DEX\n\n"
        "💬 In @LazaiTrader group you can talk with our Alith-powered agent and explore all commands, LazaiTrader trading strategy tips, Metis & Hyperion insights!\n\n"
        "🔧 Configure your Martingale strategy: /config\n"
        "   • Set trade %, trigger %, multiplier & max/min amounts\n\n"
        "🤖 Our AI Agent monitors prices, executes trades & sends real-time summaries\n\n"
        "🏆 Top 3 testers (highest USD value at the end of testing) share $100 in rewards ($50 / $25 / $25)\n\n"
        "💰 Check balances: /balance\n"
        "💸 Withdraw funds: /withdraw",
        parse_mode='Markdown'
    )

async def wallet(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = str(update.effective_user.id)
    data = load_users()

    user = data["users"].get(chat_id)
    if not user:
        await update.message.reply_text("You're not registered yet. Please send /start first.")
        return

    await update.message.reply_text(
        f"Your assigned wallet: `{user['wallet_address']}`",
        parse_mode='Markdown'
    )

async def balance(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show wallet balances"""
    chat_id = str(update.effective_user.id)
    data = load_users()

    user = data["users"].get(chat_id)
    if not user:
        await update.message.reply_text("You're not registered yet. Please send /start first.")
        return

    await update.message.reply_text("🔄 Fetching your wallet balances...")
    
    balances = get_wallet_balances(user['wallet_address'])
    
    if balances is None:
        await update.message.reply_text("❌ Failed to fetch wallet balances. Please try again later.")
        return
    
    balance_text = f"💰 *Wallet Balances*\n\n📍 Address: `{user['wallet_address']}`\n\n"
    
    for symbol, info in balances.items():
        if 'error' in info:
            balance_text += f"❌ {symbol}: Error fetching balance\n"
        else:
            balance_text += f"💎 {symbol}: {info['balance']:.1f}\n"
    
    await update.message.reply_text(balance_text, parse_mode='Markdown')

async def withdraw(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle withdrawal requests"""
    chat_id = str(update.effective_user.id)
    data = load_users()

    user = data["users"].get(chat_id)
    if not user:
        await update.message.reply_text("You're not registered yet. Please send /start first.")
        return

    await update.message.reply_text(
        "🚫 *Withdrawal Currently Disabled*\n\n"
        "During the Hyperion testing phase, withdrawal functionality is disabled.\n\n"
        "💡 *Why?*\n"
        "• This is a testnet environment\n"
        "• Funds are test tokens only\n"
        "• Focus is on testing trading strategies\n\n"
        "🎯 Withdrawals will be enabled in the mainnet version!",
        parse_mode='Markdown'
    )

# Config conversation handlers
async def config_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    # Check if user is registered first
    chat_id = str(update.effective_user.id)
    data = load_users()
    
    if chat_id not in data["users"]:
        await update.message.reply_text("You need to register first. Please send /start to get started.")
        return ConversationHandler.END

    # Initialize config with fixed values for later
    context.user_data["minimum_amount"] = 0.0  # Fixed to 0
    context.user_data["multiplier"] = 1.5  # Fixed to 1.5

    # First step: Select trading pair
    keyboard = [
        [InlineKeyboardButton("🟢 gMetis-USDC", callback_data="pair_gmetis_usdc")],
        [InlineKeyboardButton("🔒 Metis-USDC", callback_data="pair_metis_usdc")],
        [InlineKeyboardButton("🔒 ETH-USDC", callback_data="pair_eth_usdc")]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    await update.message.reply_text(
        "🔄 *Select Trading Pair*\n\n"
        "Choose which pair you want to trade:\n\n"
        "🟢 Available during testnet\n"
        "🔒 Coming soon after testnet",
        reply_markup=reply_markup,
        parse_mode='Markdown'
    )
    return PAIR_SELECT

async def handle_risk(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()

    if query.data == "low_risk":
        context.user_data["trade_percentage"] = round_to_one_decimal(0.05)
        context.user_data["trigger_percentage"] = round_to_one_decimal(0.05)
        context.user_data["max_amount"] = round_to_one_decimal(20.0)
        risk_type = "Conservative"
    else:
        context.user_data["trade_percentage"] = round_to_one_decimal(0.2)
        context.user_data["trigger_percentage"] = round_to_one_decimal(0.15)
        context.user_data["max_amount"] = round_to_one_decimal(100.0)
        risk_type = "Aggressive"

    # Show trade percentage confirmation
    trade_pct = context.user_data["trade_percentage"]
    keyboard = [
        [InlineKeyboardButton("✅ Yes, I agree", callback_data="trade_agree")],
        [InlineKeyboardButton("📉 Make it less (-20%)", callback_data="trade_less")],
        [InlineKeyboardButton("📈 Make it more (+20%)", callback_data="trade_more")]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    await query.edit_message_text(
        f"📊 *{risk_type} Strategy Selected*\n\n"
        f"Trade percentage set to *{trade_pct*100:.1f}%* which means:\n\n"
        f"💡 If you have 100 USDC, we will trade with *{trade_pct*100:.1f} USDC* per signal.\n\n"
        f"Do you agree with this trade size?",
        reply_markup=reply_markup,
        parse_mode='Markdown'
    )
    return TRADE_PERCENTAGE_CONFIRM

async def handle_max_amount(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()

    if query.data == "max_agree":
        # Move to final confirmation
        pass
    elif query.data == "max_less":
        # Reduce by 20%
        current = context.user_data["max_amount"]
        new_value = round_to_one_decimal(current * 0.8)
        context.user_data["max_amount"] = max(1.0, new_value)  # Min $1
    else:  # max_more
        # Increase by 20%
        current = context.user_data["max_amount"]
        new_value = round_to_one_decimal(current * 1.2)
        context.user_data["max_amount"] = min(1000.0, new_value)  # Max $1000

    if query.data != "max_agree":
        # Show updated max amount
        max_amount = context.user_data["max_amount"]
        keyboard = [
            [InlineKeyboardButton("✅ Yes, I agree", callback_data="max_agree")],
            [InlineKeyboardButton("📉 Make it less (-20%)", callback_data="max_less")],
            [InlineKeyboardButton("📈 Make it more (+20%)", callback_data="max_more")]
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        await query.edit_message_text(
            f"💰 *Updated Maximum Trade Amount*\n\n"
            f"Maximum trade amount set to *${max_amount:.1f}* which means:\n\n"
            f"💡 No single trade will exceed *${max_amount:.1f}* in value, even if your percentage would suggest a larger trade.\n\n"
            f"This protects you from very large trades when you have significant balances.\n\n"
            f"Do you agree with this safety limit?",
            reply_markup=reply_markup,
            parse_mode='Markdown'
        )
        return MAX_AMOUNT_CONFIRM

    # Show final confirmation
    keyboard = [
        [InlineKeyboardButton("✅ Confirm & Save Strategy", callback_data="final_confirm")]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    config_summary = (
        f"🎉 *Your Trading Strategy is Ready!*\n\n"
        f"📊 *Pair:* {context.user_data['symbol1']}-{context.user_data['symbol2']}\n"
        f"📈 *Trade %:* {context.user_data['trade_percentage']*100:.1f}%\n"
        f"🎯 *Trigger %:* {context.user_data['trigger_percentage']*100:.1f}%\n"
        f"💰 *Max Amount:* ${context.user_data['max_amount']:.1f}\n"
        f"💸 *Min Amount:* ${context.user_data['minimum_amount']:.1f}\n"
        f"🔄 *Multiplier:* {context.user_data['multiplier']:.1f}x\n\n"
        f"Click confirm to activate your strategy!"
    )
    
    await query.edit_message_text(
        config_summary,
        reply_markup=reply_markup,
        parse_mode='Markdown'
    )
    return FINALIZE

async def my_config(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = str(update.effective_user.id)
    
    # Check if user is registered
    data = load_users()
    if user_id not in data["users"]:
        await update.message.reply_text("You need to register first. Please send /start to get started.")
        return

    if not os.path.exists(CONFIG_PATH):
        await update.message.reply_text("❌ No configuration found. Use /config to set up your strategy.")
        return

    with open(CONFIG_PATH, "r") as f:
        config = json.load(f)

    user_configs = [
        entry for entry in config.get("trading_pairs", [])
        if entry["userID"] == user_id
    ]

    if not user_configs:
        await update.message.reply_text("❌ You haven't configured any strategies yet. Use /config to get started.")
        return

    for entry in user_configs:
        config_text = (
            f"📊 *Active Configuration*\n\n"
            f"🔄 Pair: {entry['symbol1']}-{entry['symbol2']}\n"
            f"📈 Trade %: {entry['trade_percentage']*100:.1f}%\n"
            f"🎯 Trigger %: {entry['trigger_percentage']*100:.1f}%\n"
            f"💰 Max Amount: ${entry['max_amount']:.1f}\n"
            f"💸 Min Amount: ${entry['minimum_amount']:.1f}\n"
            f"🔄 Multiplier: {entry['multiplier']:.1f}x\n\n"
            f"💡 Use /config to update your strategy"
        )
        await update.message.reply_text(config_text, parse_mode='Markdown')

async def cancel_config(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Cancel the configuration process"""
    await update.message.reply_text("❌ Configuration cancelled. You can start again anytime with /config")
    return ConversationHandler.END


async def handle_pair_selection(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle trading pair selection"""
    query = update.callback_query
    await query.answer()
    
    if query.data == "pair_gmetis_usdc":
        context.user_data["symbol1"] = "tgMetis"  # Changed from "gMetis"
        context.user_data["symbol2"] = "tgUSDC"   # Changed from "USDC"
        
        # Show risk selection
        keyboard = [
            [InlineKeyboardButton("🛡️ Conservative (Lower Risk)", callback_data="low_risk")],
            [InlineKeyboardButton("⚡ Aggressive (Higher Risk)", callback_data="high_risk")]
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        await query.edit_message_text(
            "⚖️ *Choose Your Risk Level*\n\n"
            "🛡️ **Conservative Strategy:**\n"
            "• Trade 5% of balance per signal\n"
            "• Trigger on 5% price changes\n"
            "• Max trade: $20\n\n"
            "⚡ **Aggressive Strategy:**\n"
            "• Trade 20% of balance per signal\n"
            "• Trigger on 15% price changes\n"
            "• Max trade: $100\n\n"
            "Choose your preferred risk level:",
            reply_markup=reply_markup,
            parse_mode='Markdown'
        )
        return RISK
    else:
        await query.edit_message_text(
            "🔒 This trading pair is not available during the testnet phase.\n\n"
            "Only gMetis-USDC is currently supported. Please use /config to try again.",
            parse_mode='Markdown'
        )
        return ConversationHandler.END

async def handle_trigger_percentage(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()

    # Store the previous value to check for changes
    previous_value = context.user_data["trigger_percentage"]

    if query.data == "trigger_agree":
        # Move to max amount
        pass
    elif query.data == "trigger_less":
        # Reduce by 20%
        current = context.user_data["trigger_percentage"]
        new_value = round_to_one_decimal(current * 0.8)
        context.user_data["trigger_percentage"] = max(0.01, new_value)  # Min 1%
    else:  # trigger_more
        # Increase by 20%
        current = context.user_data["trigger_percentage"]
        new_value = round_to_one_decimal(current * 1.2)
        context.user_data["trigger_percentage"] = min(0.3, new_value)  # Max 30%

    if query.data != "trigger_agree":
        # Check if value actually changed
        if context.user_data["trigger_percentage"] == previous_value:
            # Value didn't change, just answer the callback without updating message
            return TRIGGER_PERCENTAGE_CONFIRM
        
        # Show updated trigger percentage
        trigger_pct = context.user_data["trigger_percentage"]
        keyboard = [
            [InlineKeyboardButton("✅ Yes, I agree", callback_data="trigger_agree")],
            [InlineKeyboardButton("📉 Make it less (-20%)", callback_data="trigger_less")],
            [InlineKeyboardButton("📈 Make it more (+20%)", callback_data="trigger_more")]
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        await query.edit_message_text(
            f"🎯 *Updated Trigger Percentage*\n\n"
            f"Trigger percentage set to *{trigger_pct*100:.1f}%* which means:\n\n"
            f"💡 We will execute trades when tgMetis price changes by *{trigger_pct*100:.1f}%* or more.\n\n"
            f"Example: If tgMetis is $10 and drops to ${10*(1-trigger_pct):.2f} (-{trigger_pct*100:.1f}%), we buy tgMetis with tgUSDC.\n\n"
            f"Do you agree with this trigger sensitivity?",
            reply_markup=reply_markup,
            parse_mode='Markdown'
        )
        return TRIGGER_PERCENTAGE_CONFIRM

    # Show max amount confirmation
    max_amount = context.user_data["max_amount"]
    keyboard = [
        [InlineKeyboardButton("✅ Yes, I agree", callback_data="max_agree")],
        [InlineKeyboardButton("📉 Make it less (-20%)", callback_data="max_less")],
        [InlineKeyboardButton("📈 Make it more (+20%)", callback_data="max_more")]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    await query.edit_message_text(
        f"💰 *Maximum Trade Amount*\n\n"
        f"Maximum trade amount set to *${max_amount:.1f}* which means:\n\n"
        f"💡 No single trade will exceed *${max_amount:.1f}* in value, even if your percentage would suggest a larger trade.\n\n"
        f"This protects you from very large trades when you have significant balances.\n\n"
        f"Do you agree with this safety limit?",
        reply_markup=reply_markup,
        parse_mode='Markdown'
    )
    return MAX_AMOUNT_CONFIRM

async def handle_trade_percentage(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()

    # Store the previous value to check for changes
    previous_value = context.user_data["trade_percentage"]

    if query.data == "trade_agree":
        # Move to trigger percentage
        pass
    elif query.data == "trade_less":
        # Reduce by 20%
        current = context.user_data["trade_percentage"]
        new_value = round_to_one_decimal(current * 0.8)
        context.user_data["trade_percentage"] = max(0.01, new_value)  # Min 1%
    else:  # trade_more
        # Increase by 20%
        current = context.user_data["trade_percentage"]
        new_value = round_to_one_decimal(current * 1.2)
        context.user_data["trade_percentage"] = min(0.5, new_value)  # Max 50%

    if query.data != "trade_agree":
        # Check if value actually changed
        if context.user_data["trade_percentage"] == previous_value:
            # Value didn't change, just answer the callback without updating message
            return TRADE_PERCENTAGE_CONFIRM
        
        # Show updated trade percentage
        trade_pct = context.user_data["trade_percentage"]
        keyboard = [
            [InlineKeyboardButton("✅ Yes, I agree", callback_data="trade_agree")],
            [InlineKeyboardButton("📉 Make it less (-20%)", callback_data="trade_less")],
            [InlineKeyboardButton("📈 Make it more (+20%)", callback_data="trade_more")]
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        await query.edit_message_text(
            f"📊 *Updated Trade Percentage*\n\n"
            f"Trade percentage set to *{trade_pct*100:.1f}%* which means:\n\n"
            f"💡 If you have 100 tgUSDC, we will trade with *{trade_pct*100:.1f} tgUSDC* per signal.\n\n"
            f"Do you agree with this trade size?",
            reply_markup=reply_markup,
            parse_mode='Markdown'
        )
        return TRADE_PERCENTAGE_CONFIRM

    # Show trigger percentage confirmation
    trigger_pct = context.user_data["trigger_percentage"]
    keyboard = [
        [InlineKeyboardButton("✅ Yes, I agree", callback_data="trigger_agree")],
        [InlineKeyboardButton("📉 Make it less (-20%)", callback_data="trigger_less")],
        [InlineKeyboardButton("📈 Make it more (+20%)", callback_data="trigger_more")]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    await query.edit_message_text(
        f"🎯 *Trigger Percentage Setting*\n\n"
        f"Trigger percentage set to *{trigger_pct*100:.1f}%* which means:\n\n"
        f"💡 We will execute trades when tgMetis price changes by *{trigger_pct*100:.1f}%* or more.\n\n"
        f"Example: If tgMetis is $10 and drops to ${10*(1-trigger_pct):.2f} (-{trigger_pct*100:.1f}%), we buy tgMetis with tgUSDC.\n\n"
        f"Do you agree with this trigger sensitivity?",
        reply_markup=reply_markup,
        parse_mode='Markdown'
    )
    return TRIGGER_PERCENTAGE_CONFIRM

async def finalize_config(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()

    user_id = str(update.effective_user.id)

    # Use exact values (no randomization for this simplified flow)
    final_config = {
        "userID": user_id,
        "symbol1": context.user_data["symbol1"],  # This will now be "tgMetis"
        "symbol2": context.user_data["symbol2"],  # This will now be "tgUSDC"
        "trade_percentage": context.user_data["trade_percentage"],
        "trigger_percentage": context.user_data["trigger_percentage"],
        "max_amount": context.user_data["max_amount"],
        "minimum_amount": context.user_data["minimum_amount"],
        "multiplier": context.user_data["multiplier"]
    }

    save_config_entry(user_id, final_config)

    await query.edit_message_text(
        f"✅ *Strategy Activated Successfully!*\n\n"
        f"📊 Pair: {final_config['symbol1']}-{final_config['symbol2']}\n"
        f"📈 Trade %: {final_config['trade_percentage']*100:.1f}%\n"
        f"🎯 Trigger %: {final_config['trigger_percentage']*100:.1f}%\n"
        f"💰 Max Amount: ${final_config['max_amount']:.1f}\n"
        f"💸 Min Amount: ${final_config['minimum_amount']:.1f}\n"
        f"🔄 Multiplier: {final_config['multiplier']:.1f}x\n\n"
        "🤖 Your Martingale strategy is now active and monitoring tgMetis-tgUSDC prices!\n\n"
        "📊 Check current config: /myconfig\n"
        "💰 Check balances: /balance\n\n"
        "\n✅ *The process is complete. Nothing else needs to be done.*\n",
        parse_mode='Markdown'
    )
    return ConversationHandler.END

from telegram import BotCommand

async def setup_commands(app):
    """Set up the bot commands menu"""
    commands = [
        BotCommand("start", "🚀 Start/Register with LazaiTrader"),
        BotCommand("config", "⚙️ Configure trading strategy"),
        BotCommand("myconfig", "📊 View current configuration"),
        BotCommand("balance", "💰 Check wallet balances"),
        BotCommand("wallet", "📋 Show wallet address"),
        BotCommand("withdraw", "💸 Withdraw funds"),
    ]
    
    await app.bot.set_my_commands(commands)

async def post_init(app):
    """Initialize bot commands after startup"""
    await setup_commands(app)

def main():
    if not bot_token:
        print("Error: TELEGRAM_BOT_TOKEN not found in environment variables")
        return

    app = ApplicationBuilder().token(bot_token).post_init(post_init).build()
    
    # Config conversation handler with per_message=False to avoid warning
    config_conv = ConversationHandler(
        entry_points=[CommandHandler("config", config_start)],
        states={
            PAIR_SELECT: [CallbackQueryHandler(handle_pair_selection)],
            RISK: [CallbackQueryHandler(handle_risk)],
            TRADE_PERCENTAGE_CONFIRM: [CallbackQueryHandler(handle_trade_percentage)],
            TRIGGER_PERCENTAGE_CONFIRM: [CallbackQueryHandler(handle_trigger_percentage)],
            MAX_AMOUNT_CONFIRM: [CallbackQueryHandler(handle_max_amount)],
            FINALIZE: [CallbackQueryHandler(finalize_config)],
        },
        fallbacks=[CommandHandler("cancel", cancel_config)],
        per_message=False,
    )

    # Add handlers
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("wallet", wallet))
    app.add_handler(CommandHandler("address", wallet))  # alias for wallet
    app.add_handler(CommandHandler("balance", balance))
    app.add_handler(CommandHandler("withdraw", withdraw))
    app.add_handler(config_conv)
    app.add_handler(CommandHandler("myconfig", my_config))
    
    print("Enhanced LazaiTrader bot is running...")
    app.run_polling()

if __name__ == "__main__":
    main()