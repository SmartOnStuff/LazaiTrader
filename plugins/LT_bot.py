import json
import pathlib
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
import numpy as np
from pathlib import Path
from telegram import (
    Update,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    BotCommand
)
from telegram.ext import (
    ApplicationBuilder,
    CommandHandler,
    CallbackQueryHandler,
    ConversationHandler,
    ContextTypes
)
from dotenv import load_dotenv
from web3 import Web3


import datetime
import requests

import glob



from alith.lazai import Client, ProofRequest
from alith.data import encrypt
from alith.data.storage import (
    PinataIPFS,
    UploadOptions,
    GetShareLinkOptions,
    StorageError,
)
from eth_account.messages import encode_defunct
from os import getenv
import asyncio
import requests
import rsa
from pathlib import Path
from dotenv import load_dotenv
 
import os, sys
import platform



# Load environment variables
BASE_PATH = pathlib.Path(__file__).parent.parent
load_dotenv(dotenv_path=BASE_PATH / ".env")

# Get bot token and RPC URL
bot_token = os.getenv("TELEGRAM_BOT_TOKEN")
RPC_URL = os.getenv('RPC_URL', "https://hyperion-testnet.metisdevops.link")

DEEPSEEK_API_URL = os.getenv("DEEPSEEK_API_URL", "https://api.deepseek.com/v1/chat/completions")
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY")
# File paths
PROJECT_ROOT = pathlib.Path(__file__).resolve().parent.parent
USERS_FILE = PROJECT_ROOT / "config" / "users.json"
CONFIG_PATH = PROJECT_ROOT / "config" / "config.json"
TOKENS_FILE = PROJECT_ROOT / "config" / "tokens.json"
LOGS_DIR = PROJECT_ROOT / "logs" # New path for log files
IPFS_DIR = PROJECT_ROOT / "ipfs" # Directory for IPFS files
PLUGIN_DIR = pathlib.Path(__file__).resolve().parent
ADDRESSES_FILE = PLUGIN_DIR / "addresses.txt"

# Conversation states
# States for creating a config
PAIR_SELECT, RISK, TRADE_PERCENTAGE_CONFIRM, TRIGGER_PERCENTAGE_CONFIRM, MAX_AMOUNT_CONFIRM, FINALIZE = range(6)
# States for deleting a config
SELECT_CONFIG_TO_DELETE, CONFIRM_DELETE = range(6, 8)


# ERC20 ABI for balance queries
ERC20_ABI = json.loads("""[
  {"constant":true,"inputs":[{"name":"account","type":"address"}],
   "name":"balanceOf","outputs":[{"name":"","type":"uint256"}],"type":"function"},
  {"constant":true,"inputs":[],"name":"decimals",
   "outputs":[{"name":"","type":"uint8"}],"type":"function"},
  {"constant":true,"inputs":[],"name":"symbol",
   "outputs":[{"name":"","type":"string"}],"type":"function"}
]""")

# --- User and Wallet Management Functions ---

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

async def handle_no_wallets_available(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handles case when all wallets are used."""
    await update.message.reply_text(
        "🚫 All test wallets are currently assigned.\n\n"
        "We're at capacity for the Hyperion Testnet phase. "
        "Please check back later or contact support for updates."
    )

# --- Configuration Management Functions ---

def load_config():
    """Loads the main trading configuration file."""
    if not os.path.exists(CONFIG_PATH):
        return {"trading_pairs": []}
    try:
        with open(CONFIG_PATH, "r") as f:
            return json.load(f)
    except (json.JSONDecodeError, FileNotFoundError):
        return {"trading_pairs": []}

def round_to_one_decimal(value):
    """Round value to 2 decimal places"""
    return round(value, 2)

def save_config_entry(user_id, config_data):
    """Saves a new or updated configuration entry for a user."""
    os.makedirs(CONFIG_PATH.parent, exist_ok=True)
    config = load_config()

    # Standardize userID to string for comparison
    user_id_str = str(user_id)

    # Remove existing config for the same user/pair to prevent duplicates
    config["trading_pairs"] = [
        entry for entry in config["trading_pairs"]
        if not (str(entry.get("userID")) == user_id_str and 
                entry.get("symbol1") == config_data["symbol1"] and 
                entry.get("symbol2") == config_data["symbol2"])
    ]

    # Add the new configuration
    config["trading_pairs"].append(config_data)

    with open(CONFIG_PATH, "w") as f:
        json.dump(config, f, indent=2)

def delete_config_entry(user_id, symbol1, symbol2):
    """Deletes a specific configuration entry for a user and pair."""
    config = load_config()
    initial_count = len(config.get("trading_pairs", []))
    
    # Filter out the entry to be deleted, comparing userID as a string
    config["trading_pairs"] = [
        entry for entry in config.get("trading_pairs", [])
        if not (str(entry.get("userID")) == str(user_id) and 
                entry.get("symbol1") == symbol1 and 
                entry.get("symbol2") == symbol2)
    ]
    
    if len(config["trading_pairs"]) < initial_count:
        with open(CONFIG_PATH, "w") as f:
            json.dump(config, f, indent=2)
        return True  # Deletion successful
    return False  # Entry not found

def get_available_trading_pairs():
    """Get available trading pairs from tokens.json dynamically"""
    tokens = load_tokens()
    pairs = []
    
    available_pairs = [
        ("tgMetis", "tgUSDC", "🟢 tgMetis-tgUSDC", "pair_tgmetis_tgusdc"),
        ("tgETH", "tgUSDC", "🟢 tgETH-tgUSDC", "pair_tgeth_tgusdc"),
        ("Metis", "USDC", "🔒 Metis-USDC", "pair_metis_usdc"),
        ("ETH", "USDC", "🔒 ETH-USDC", "pair_eth_usdc")
    ]
    
    for base, quote, display_name, callback_data in available_pairs:
        if base in tokens and quote in tokens:
            pairs.append((display_name, callback_data, base, quote, True))
        else:
            pairs.append((display_name, callback_data, base, quote, False))
    
    return pairs


# --- Visualization Function ---
def chartTrades(log_dir, username):
    """
    Analyzes trade and price data for a given user, calculates their total PnL,
    and generates a combined chart showing price action and buy/sell trades
    for all available cryptocurrency pairs.
    
    Args:
        log_dir (Path): The directory path where the log CSV files are located.
        username (str): The user ID to filter the trade data by.
    """
    all_price_data = []
    all_trades_data = []

    # Dynamically find all trade log files for the specific user
    trade_files = list(log_dir.glob(f"*{username}*_trades.csv"))
    
    if not trade_files:
        print(f"No trade log files found for user {username} in {log_dir}")
        return None

    # Load data for each pair
    for trade_file_path in trade_files:
        try:
            # Extract the pair name from the filename (e.g., 'tgETH_tgUSDC')
            file_prefix = trade_file_path.stem.replace(f"_{username}_trades", '')
            price_file_path = log_dir / f"{file_prefix}_{username}.csv"

            # Load trade and price data for the current pair
            price_df = pd.read_csv(price_file_path)
            trades_df = pd.read_csv(trade_file_path)
            
            # Add a 'pair' column for later plotting and filtering
            price_df['pair'] = file_prefix
            trades_df['pair'] = file_prefix
            
            all_price_data.append(price_df)
            all_trades_data.append(trades_df)
        except FileNotFoundError as e:
            print(f"Warning: Corresponding price file for {trade_file_path.name} not found. {e}")
            continue
        except Exception as e:
            print(f"Error loading file {trade_file_path.name}: {e}")
            continue

    if not all_trades_data:
        print(f"No valid trade data found for user: {username}")
        return None

    # Combine all data into single dataframes
    combined_price_df = pd.concat(all_price_data, ignore_index=True)
    combined_trades_df = pd.concat(all_trades_data, ignore_index=True)
    
    # Filter trades by the specified username (this is redundant now but kept for safety)
    user_trades = combined_trades_df[combined_trades_df['UserID'] == username].copy()

    if user_trades.empty:
        print(f"No trades found for user: {username}")
        return None

    # --- FIX for ValueError: "time data '...'" doesn't match format ---
    # The error occurs because the combined date and time string sometimes
    # has an unexpected length. We will now ensure both Date and Time columns
    # are padded with leading zeros to their expected length (6 digits each)
    # before concatenation, making the format consistent for parsing.
    for df in [combined_price_df, user_trades]:
        df['Date'] = df['Date'].astype(str).str.zfill(6)
        df['Time'] = df['Time'].astype(str).str.zfill(6)
        df['datetime'] = pd.to_datetime(df['Date'] + df['Time'], format='%y%m%d%H%M%S')
    
    # Sort data by datetime to ensure correct plotting order
    combined_price_df = combined_price_df.sort_values('datetime')
    user_trades = user_trades.sort_values('datetime')

    # --- PnL Calculation ---
    initial_balance_usd = 0
    final_balance_usd = 0
    if not user_trades.empty:
        initial_balance_usd = user_trades.iloc[0]['Total_Balance_USD']
        final_balance_usd = user_trades.iloc[-1]['Total_Balance_USD']

    pnl_percentage = 0
    if initial_balance_usd > 0:
        pnl_percentage = ((final_balance_usd - initial_balance_usd) / initial_balance_usd) * 100

    # --- Plotting ---
    unique_pairs = user_trades['pair'].unique()
    fig, axes = plt.subplots(nrows=len(unique_pairs), ncols=1, figsize=(15, 6 * len(unique_pairs)), sharex=True)
    
    # Handle case with only one subplot
    if len(unique_pairs) == 1:
        axes = [axes]

    fig.suptitle(f'Trade History for {username}\nOverall PnL: {pnl_percentage:.2f}%', fontsize=16, fontweight='bold')
    
    for ax, pair_name in zip(axes, unique_pairs):
        pair_price_df = combined_price_df[combined_price_df['pair'] == pair_name]
        pair_trades_df = user_trades[user_trades['pair'] == pair_name]
        
        # Plot price action
        ax.plot(pair_price_df['datetime'], pair_price_df['Price'], label=f'{pair_name} Price')
        ax.set_ylabel('Price')
        ax.set_title(f'{pair_name} Price and Trades')
        ax.grid(True, linestyle='--', alpha=0.6)

        # Plot buy/sell trades if they exist for this pair
        if not pair_trades_df.empty:
            buy_trades = pair_trades_df[pair_trades_df['Action'] == 'BUY']
            sell_trades = pair_trades_df[pair_trades_df['Action'] == 'SELL']
            
            ax.scatter(buy_trades['datetime'], buy_trades['Price'], color='green', marker='o', s=100, label='Buy', zorder=5)
            ax.scatter(sell_trades['datetime'], sell_trades['Price'], color='red', marker='o', s=100, label='Sell', zorder=5)
        
        ax.legend()
        if not pair_price_df.empty:
            min_price = pair_price_df['Price'].min()
            max_price = pair_price_df['Price'].max()
            padding = (max_price - min_price) * 0.1
            ax.set_ylim(min_price - padding, max_price + padding)

    axes[-1].set_xlabel('Date')
    fig.autofmt_xdate()
    date_format = mdates.DateFormatter('%Y-%m-%d %H:%M')
    axes[-1].xaxis.set_major_formatter(date_format)

    output_filename = f'trades_chart_{username}.png'
    plt.tight_layout(rect=[0, 0.03, 1, 0.95])
    plt.savefig(output_filename)
    plt.close(fig)
    return output_filename

# --- Command Handlers ---

async def chart_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handles the /chart command to generate and send a user's trade history chart."""
    chat_id = str(update.effective_user.id)
    users = load_users()["users"]
    
    if chat_id not in users:
        await update.message.reply_text("Please register with /start before trying to view your trade history.")
        return

    # Use the username as the primary identifier for the log file, fall back to user ID
    user_identifier = users[chat_id].get('username') or chat_id
    
    await update.message.reply_text("🔄 Generating your trade history chart. This may take a moment...")

    # The chartTrades function will now return the filename
    chart_filename = chartTrades(LOGS_DIR, user_identifier)
    
    if chart_filename:
        # Send the generated chart and then delete the file
        try:
            with open(chart_filename, 'rb') as f:
                await update.message.reply_photo(photo=f, caption="📊 Your Trade History Chart")
            os.remove(chart_filename)
        except FileNotFoundError:
            await update.message.reply_text("❌ Error: Could not find the generated chart file.")
    else:
        await update.message.reply_text("❌ No trade data found for your user. Please ensure you have made trades.")


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = str(update.effective_user.id)
    username = update.effective_user.username or ""
    data = load_users()

    # Check if already registered
    if chat_id in data["users"]:
        await update.message.reply_text(
            "👋 *Welcome back to LazaiTrader!* 🎉\n\n"
            "� *Hyperion Testnet Phase* (until Aug 21, 2025)\n"
            "💼 Wallet funded with: 100 TESTgUSDC + 10 000 000 TESTgMetis + 0.1 TESTgETH. Find your wallet address: /wallet \n\n"
            "🔧 Configure your trading strategy: /config\n"
            "   • Set trade %, trigger %, multiplier & max/min amounts\n\n"
            "🤖 Our AI monitors prices, executes trades & sends real-time summaries\n\n"
            "🏆 Top 3 testers share $100 in rewards ($50 / $25 / $25)\n\n"
            "💰 Check balances: /balance\n"
            "💸 Withdraw funds: /withdraw\n"
            "📈 View your trade chart: /chart",
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
        "🚀 *Hyperion Testnet Phase* (until Aug 21, 2025)\n"
        "💼 Wallet funded with: 100 TESTgUSDC + 10 000 000 TESTgMetis + 0.1 TESTgETH. Find your wallet address: /wallet \n\n"
        "the fluctuation depends on gMetis price on Metis Andromeda - Hercules DEX\n\n"
        "💬 In @LazaiTrader group you can talk with our Alith-powered agent and explore all commands, LazaiTrader trading strategy tips, Metis & Hyperion insights!\n\n"
        "🔧 Configure your trading strategy: /config\n"
        "   • Set trade %, trigger %, multiplier & max/min amounts\n\n"
        "🤖 Our AI Agent monitors prices, executes trades & sends real-time summaries\n\n"
        "🏆 Top 3 testers (highest USD value at the end of testing) share $100 in rewards ($50 / $25 / $25)\n\n"
        "💰 Check balances: /balance\n"
        "💸 Withdraw funds: /withdraw\n"
        "📈 View your trade chart: /chart",
        parse_mode='Markdown'
    )

async def wallet(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = str(update.effective_user.id)
    user = load_users()["users"].get(chat_id)
    if not user:
        await update.message.reply_text("You're not registered. Please send /start first.")
        return
    await update.message.reply_text(f"Your assigned wallet: `{user['wallet_address']}`", parse_mode='Markdown')

async def balance(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = str(update.effective_user.id)
    user = load_users()["users"].get(chat_id)
    if not user:
        await update.message.reply_text("You're not registered. Please send /start first.")
        return

    await update.message.reply_text("🔄 Fetching your wallet balances...")
    balances = get_wallet_balances(user['wallet_address'])
    
    if balances is None:
        await update.message.reply_text("❌ Failed to fetch balances. Please try again later.")
        return
    
    balance_text = f"💰 *Wallet Balances*\n\n📍 Address: `{user['wallet_address']}`\n\n"
    for symbol, info in balances.items():
        balance_text += f"💎 {symbol}: {info.get('balance', 0.0):.2f}\n"
    
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


# --- /config Conversation Handlers ---

async def config_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = str(update.effective_user.id)
    if chat_id not in load_users()["users"]:
        await update.message.reply_text("Please register with /start before configuring a strategy.")
        return ConversationHandler.END

    context.user_data["minimum_amount"] = 0.0
    context.user_data["multiplier"] = 1.5

    pairs = get_available_trading_pairs()
    keyboard = [[InlineKeyboardButton(name, callback_data=cb)] for name, cb, _, _, _ in pairs]
    reply_markup = InlineKeyboardMarkup(keyboard)
    await update.message.reply_text(
        "🔄 *Select Trading Pair*\n\nChoose the pair you want to trade:",
        reply_markup=reply_markup,
        parse_mode='Markdown'
    )
    return PAIR_SELECT

async def handle_pair_selection(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    
    pair_mapping = {
        "pair_tgmetis_tgusdc": ("tgMetis", "tgUSDC", True),
        "pair_tgeth_tgusdc": ("tgETH", "tgUSDC", True),
        "pair_metis_usdc": ("Metis", "USDC", False),
        "pair_eth_usdc": ("ETH", "USDC", False)
    }
    
    symbol1, symbol2, available = pair_mapping.get(query.data, (None, None, False))
    
    if not available:
        await query.edit_message_text("🔒 This pair isn't available on the testnet. Please use /config to select an available pair.")
        return ConversationHandler.END
        
    context.user_data["symbol1"], context.user_data["symbol2"] = symbol1, symbol2
    
    keyboard = [
        [InlineKeyboardButton("🛡️ Conservative (Lower Risk)", callback_data="low_risk")],
        [InlineKeyboardButton("⚡ Aggressive (Higher Risk)", callback_data="high_risk")]
    ]
    await query.edit_message_text(
        f"⚖️ *Choose Your Risk Level for {symbol1}-{symbol2}*",
        reply_markup=InlineKeyboardMarkup(keyboard),
        parse_mode='Markdown'
    )
    return RISK

async def handle_risk(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()

    if query.data == "low_risk":
        context.user_data["trade_percentage"] = 0.05
        context.user_data["trigger_percentage"] = 0.05
        context.user_data["max_amount"] = 20.0
    else:
        context.user_data["trade_percentage"] = 0.20
        context.user_data["trigger_percentage"] = 0.15
        context.user_data["max_amount"] = 100.0

    trade_pct = context.user_data["trade_percentage"]
    keyboard = [
        [InlineKeyboardButton("✅ Yes, I agree", callback_data="trade_agree")],
        [InlineKeyboardButton("📉 Less (-20%)", callback_data="trade_less")],
        [InlineKeyboardButton("📈 More (+20%)", callback_data="trade_more")]
    ]
    await query.edit_message_text(
        f"📊 *Confirm Trade Size*\n\nYour trade percentage is *{trade_pct*100:.1f}%*.\nDo you agree?",
        reply_markup=InlineKeyboardMarkup(keyboard),
        parse_mode='Markdown'
    )
    return TRADE_PERCENTAGE_CONFIRM

# Note: The following handlers for trade, trigger, and max amount are simplified for brevity.
# The original file's logic for adjustments is preserved.
async def handle_trade_percentage(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()

    if query.data != "trade_agree":
        current = context.user_data["trade_percentage"]
        factor = 0.8 if query.data == "trade_less" else 1.2
        new_trade_percentage = round_to_one_decimal(max(0.01, min(1.0, current * factor)))

        # Only edit the message if the value has changed
        if new_trade_percentage != current:
            context.user_data["trade_percentage"] = new_trade_percentage
            trade_pct = context.user_data["trade_percentage"]
            keyboard = [
                [InlineKeyboardButton("✅ Yes, I agree", callback_data="trade_agree")],
                [InlineKeyboardButton("📉 Less (-20%)", callback_data="trade_less")],
                [InlineKeyboardButton("📈 More (+20%)", callback_data="trade_more")]
            ]
            await query.edit_message_text(
                f"📊 *Updated Trade Size*\n\n"
                f"Trade percentage is now *{trade_pct*100:.1f}%* which means:\n\n"
                f"💡 For each trade, we will use up to *{trade_pct*100:.1f}%* of your available funds.\n\n"
                f"Example: If you have $1000 in available funds, each trade will be up to a maximum of *${1000*trade_pct:.1f}*.\n\n"
                f"Do you agree with this trade size?",
                reply_markup=InlineKeyboardMarkup(keyboard),
                parse_mode='Markdown'
            )
        return TRADE_PERCENTAGE_CONFIRM
    
    trigger_pct = context.user_data["trigger_percentage"]
    keyboard = [[InlineKeyboardButton("✅ Yes, I agree", callback_data="trigger_agree")], [InlineKeyboardButton("📉 Less (-20%)", callback_data="trigger_less")], [InlineKeyboardButton("📈 More (+20%)", callback_data="trigger_more")]]
    await query.edit_message_text(
        f"🎯 *Trigger Sensitivity Setting*\n\n"
        f"Trigger percentage set to *{trigger_pct*100:.1f}%* which means:\n\n"
        f"💡 A trade will be executed when the asset's price changes by *{trigger_pct*100:.1f}%* or more.\n\n"
        f"Example: If the asset is $100 and drops to ${100*(1-trigger_pct):.2f} (-{trigger_pct*100:.1f}%), we will execute a buy trade.\n\n"
        f"Do you agree with this trigger sensitivity?", 
        reply_markup=InlineKeyboardMarkup(keyboard), 
        parse_mode='Markdown'
    )
    return TRIGGER_PERCENTAGE_CONFIRM

async def handle_trigger_percentage(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()

    if query.data != "trigger_agree":
        current = context.user_data["trigger_percentage"]
        factor = 0.8 if query.data == "trigger_less" else 1.2
        new_trigger_percentage = round_to_one_decimal(max(0.001, min(0.3, current * factor)))

        # Only edit the message if the value has changed
        if new_trigger_percentage != current:
            context.user_data["trigger_percentage"] = new_trigger_percentage
            trigger_pct = context.user_data["trigger_percentage"]
            keyboard = [[InlineKeyboardButton("✅ Yes, I agree", callback_data="trigger_agree")], [InlineKeyboardButton("📉 Less (-20%)", callback_data="trigger_less")], [InlineKeyboardButton("📈 More (+20%)", callback_data="trigger_more")]]
            await query.edit_message_text(
                f"🎯 *Updated Trigger Sensitivity*\n\n"
                f"Trigger is now *{trigger_pct*100:.1f}%* which means:\n\n"
                f"💡 A trade will be executed when the asset's price changes by *{trigger_pct*100:.1f}%* or more.\n\n"
                f"Example: If the asset is $100 and drops to ${100*(1-trigger_pct):.2f} (-{trigger_pct*100:.1f}%), we will execute a buy trade.\n\n"
                f"Do you agree with this trigger sensitivity?", 
                reply_markup=InlineKeyboardMarkup(keyboard), 
                parse_mode='Markdown'
            )
        return TRIGGER_PERCENTAGE_CONFIRM

    max_amount = context.user_data["max_amount"]
    keyboard = [[InlineKeyboardButton("✅ Yes, I agree", callback_data="max_agree")], [InlineKeyboardButton("📉 Less (-20%)", callback_data="max_less")], [InlineKeyboardButton("📈 More (+20%)", callback_data="max_more")]]
    await query.edit_message_text(
        f"💰 *Maximum Trade Amount Setting*\n\n"
        f"Maximum trade amount set to *${max_amount:.1f}* which means:\n\n"
        f"💡 No single trade will exceed *${max_amount:.1f}* in value, even if your trade percentage would suggest a larger trade.\n\n"
        f"This protects you from very large trades when you have significant balances.\n\n"
        f"Do you agree with this safety limit?", 
        reply_markup=InlineKeyboardMarkup(keyboard), 
        parse_mode='Markdown'
    )
    return MAX_AMOUNT_CONFIRM

async def handle_max_amount(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()

    if query.data != "max_agree":
        current = context.user_data["max_amount"]
        factor = 0.8 if query.data == "max_less" else 1.2
        # Calculate the new value
        new_max_amount = round_to_one_decimal(max(1.0, min(1000.0, current * factor)))
        
        # Check if the value has actually changed before editing the message
        if new_max_amount != current:
            context.user_data["max_amount"] = new_max_amount
            max_amount = context.user_data["max_amount"]
            keyboard = [[InlineKeyboardButton("✅ Yes, I agree", callback_data="max_agree")], [InlineKeyboardButton("📉 Less (-20%)", callback_data="max_less")], [InlineKeyboardButton("📈 More (+20%)", callback_data="max_more")]]
            await query.edit_message_text(
                f"💰 *Updated Maximum Trade Amount*\n\n"
                f"Maximum trade amount is now *${max_amount:.1f}* which means:\n\n"
                f"💡 No single trade will exceed *${max_amount:.1f}* in value, even if your trade percentage would suggest a larger trade.\n\n"
                f"This protects you from very large trades when you have significant balances.\n\n"
                f"Do you agree with this safety limit?", 
                reply_markup=InlineKeyboardMarkup(keyboard), 
                parse_mode='Markdown'
            )
        return MAX_AMOUNT_CONFIRM
    
    config_summary = (
        f"🎉 *Your Strategy is Ready!*\n\n"
        f"📊 *Pair:* {context.user_data['symbol1']}-{context.user_data['symbol2']}\n"
        f"📈 *Trade %:* {context.user_data['trade_percentage']*100:.1f}%\n"
        f"🎯 *Trigger %:* {context.user_data['trigger_percentage']*100:.1f}%\n"
        f"💰 *Max Amount:* ${context.user_data['max_amount']:.1f}\n\n"
        "Click confirm to activate your strategy!"
    )
    keyboard = [[InlineKeyboardButton("✅ Confirm & Save Strategy", callback_data="final_confirm")]]
    await query.edit_message_text(config_summary, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='Markdown')
    return FINALIZE

async def finalize_config(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()

    final_config = {
        "userID": str(update.effective_user.id),
        "symbol1": context.user_data["symbol1"],
        "symbol2": context.user_data["symbol2"],
        "trade_percentage": context.user_data["trade_percentage"],
        "trigger_percentage": context.user_data["trigger_percentage"],
        "max_amount": context.user_data["max_amount"],
        "minimum_amount": context.user_data["minimum_amount"],
        "multiplier": context.user_data["multiplier"]
    }

    save_config_entry(final_config["userID"], final_config)

    await query.edit_message_text(
        f"✅ *Strategy Activated Successfully for {final_config['symbol1']}-{final_config['symbol2']}!*\n\n"
        "Your bot is now active. Use /myconfig to review or /deleteconfig to remove.",
        parse_mode='Markdown'
    )
    context.user_data.clear()
    return ConversationHandler.END

async def my_config(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = str(update.effective_user.id)
    if user_id not in load_users()["users"]:
        await update.message.reply_text("Please register with /start first.")
        return

    user_configs = [entry for entry in load_config().get("trading_pairs", []) if str(entry.get("userID")) == user_id]

    if not user_configs:
        await update.message.reply_text("❌ You haven't configured any strategies. Use /config to get started.")
        return

    for entry in user_configs:
        config_text = (
            f"📊 *Active Configuration*\n\n"
            f"🔄 Pair: {entry['symbol1']}-{entry['symbol2']}\n"
            f"📈 Trade %: {entry['trade_percentage']*100:.1f}%\n"
            f"🎯 Trigger %: {entry['trigger_percentage']*100:.1f}%\n"
            f"💰 Max Amount: ${entry['max_amount']:.1f}\n"
        )
        await update.message.reply_text(config_text, parse_mode='Markdown')

# --- /deleteconfig Conversation Handlers ---

async def delete_config_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Starts the process of deleting a trading configuration."""
    user_id = str(update.effective_user.id)
    if user_id not in load_users()["users"]:
        await update.message.reply_text("You need to register with /start first.")
        return ConversationHandler.END

    user_configs = [entry for entry in load_config().get("trading_pairs", []) if str(entry.get("userID")) == user_id]

    if not user_configs:
        await update.message.reply_text("❌ You have no active configurations to delete.")
        return ConversationHandler.END

    keyboard = []
    for cfg in user_configs:
        button_text = f"Delete {cfg['symbol1']}-{cfg['symbol2']}"
        callback_data = f"del_{cfg['symbol1']}_{cfg['symbol2']}"
        keyboard.append([InlineKeyboardButton(button_text, callback_data=callback_data)])
    
    await update.message.reply_text(
        "🗑️ *Select a Configuration to Delete*\n\n"
        "Choose which strategy you want to remove:",
        reply_markup=InlineKeyboardMarkup(keyboard),
        parse_mode='Markdown'
    )
    return SELECT_CONFIG_TO_DELETE

async def handle_config_deletion_selection(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handles the user's selection of which config to delete."""
    query = update.callback_query
    await query.answer()
    
    try:
        _, symbol1, symbol2 = query.data.split('_')
    except ValueError:
        await query.edit_message_text("❌ Invalid selection. Please start over with /deleteconfig.")
        return ConversationHandler.END
        
    context.user_data['config_to_delete'] = {'symbol1': symbol1, 'symbol2': symbol2}
    
    keyboard = [[
        InlineKeyboardButton("✅ Yes, Delete", callback_data="confirm_delete"),
        InlineKeyboardButton("❌ No, Cancel", callback_data="cancel_delete")
    ]]
    
    await query.edit_message_text(
        f"⚠️ *Are you sure?*\n\n"
        f"This will permanently delete your **{symbol1}-{symbol2}** configuration.",
        reply_markup=InlineKeyboardMarkup(keyboard),
        parse_mode='Markdown'
    )
    return CONFIRM_DELETE

async def handle_final_delete_confirmation(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handles the final 'yes' or 'no' for deleting a config."""
    query = update.callback_query
    await query.answer()
    
    if query.data == "confirm_delete":
        config_to_delete = context.user_data.get('config_to_delete')
        if not config_to_delete:
            await query.edit_message_text("❌ Error. Please start over with /deleteconfig.")
        else:
            symbol1, symbol2 = config_to_delete['symbol1'], config_to_delete['symbol2']
            success = delete_config_entry(str(update.effective_user.id), symbol1, symbol2)
            if success:
                await query.edit_message_text(f"✅ *Configuration Deleted*\n\nYour strategy for **{symbol1}-{symbol2}** has been removed.", parse_mode='Markdown')
            else:
                await query.edit_message_text(f"❌ *Deletion Failed*\n\nCould not find the configuration.", parse_mode='Markdown')
    else: # cancel_delete
        await query.edit_message_text("👍 Deletion cancelled. Your configuration is safe.")
        
    context.user_data.clear()
    return ConversationHandler.END

# --- Bot Setup and Main Loop ---

async def cancel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Generic command to cancel any ongoing conversation."""
    await update.message.reply_text("Action cancelled. You can start a new command.")
    context.user_data.clear()
    return ConversationHandler.END



# DATA CONTRUBUTION AND ANALYSIS - SUGGESTION HANDLER


# async def contribute_onchain_data(filepath: str):

#     #print(platform.system())
#     if platform.system() == "Windows":
#         gpg_bin = r"C:\Program Files (x86)\GnuPG\bin"
#         os.environ["PATH"] = gpg_bin + os.pathsep + os.environ.get("PATH", "")
    
#     client = Client()
#     ipfs = PinataIPFS()
#     # Read the file content and use the filename for the title
#     try:
#         with open(filepath, 'r', encoding='utf-8') as f:
#             privacy_data = f.read()
#         data_file_name = Path(filepath).name
#     except FileNotFoundError:
#         print(f"Error: File not found at {filepath}")
#         return
#     except Exception as e:
#         print(f"An error occurred while reading the file: {e}")
#         return
    
#     try:
#         # 1. Prepare your privacy data and encrypt it
#         #data_file_name = file_name
#         #privacy_data = "Your Privacy Data"
#         encryption_seed = "Sign to retrieve your encryption key"
#         message = encode_defunct(text=encryption_seed)
#         password = client.wallet.sign_message(message).signature.hex()
#         encrypted_data = encrypt(privacy_data.encode(), password)
#         # 2. Upload the privacy data to IPFS and get the shared url
#         # Load .env from project root (one level above 'plugins')
#         env_path = Path(__file__).parent.parent / ".env"
#         load_dotenv(dotenv_path=env_path)

#         token = getenv("IPFS_JWT", "")


#         try:
#             file_meta = await ipfs.upload(
#                 UploadOptions(name=data_file_name, data=encrypted_data, token=token)
#             )
#         except Exception as e:
#             import traceback
#             traceback.print_exc()
#             # If it's a ValidationError, inspect the raw data
#             from pprint import pprint
#             pprint(e.__dict__)
#             raise




#         file_meta = await ipfs.upload(
#             UploadOptions(name=data_file_name, data=encrypted_data, token=token)
#         )
#         url = await ipfs.get_share_link(
#             GetShareLinkOptions(token=token, id=file_meta.id)
#         )
#         print("File uploaded to IPFS:", url)
#         # 3. Upload the privacy url to LazAI
#         file_id = client.get_file_id_by_url(url)
#         if file_id == 0:
#             file_id = client.add_file(url)
#         # 4. Request proof in the verified computing node
#         client.request_proof(file_id, 100)
#         job_id = client.file_job_ids(file_id)[-1]
#         job = client.get_job(job_id)
#         node_info = client.get_node(job[-1])
#         node_url: str = node_info[1]
#         print(node_url)
#         pub_key = node_info[-1]
#         encryption_key = rsa.encrypt(
#             password.encode(),
#             rsa.PublicKey.load_pkcs1(pub_key.strip().encode(), format="PEM"),
#         ).hex()
#         response = requests.post(
#             f"{node_url}/proof",
#             json=ProofRequest(
#                 job_id=job_id,
#                 file_id=file_id,
#                 file_url=url,
#                 encryption_key=encryption_key,
#                 encryption_seed=encryption_seed,
#                 proof_url=None,
#             ).model_dump(),
#         )
#         if response.status_code == 200:
#             print("Proof request sent successfully")
#         else:
#             print("Failed to send proof request:", response.json())
#         # 5. Request DAT reward
#         client.request_reward(file_id)
#         print("Reward requested for file id", file_id)
#     except StorageError as e:
#         print(f"Error: {e}")
#     except Exception as e:
#         raise e
#     finally:
#         await ipfs.close()

# async def data_contribution(update: Update, context: ContextTypes.DEFAULT_TYPE):
#     """
#     Checks if 24 hours have passed, gathers user trade logs and config, combines into a JSON,
#     saves it to /ipfs, and updates user data.
#     """
#     user_id = str(update.effective_user.id)
#     users_data = load_users()
#     user_info = users_data.get("users", {}).get(user_id)
    
#     if not user_info:
#         await update.message.reply_text("You are not a registered user. Please use the /start command.")
#         return
    
#     last_contribution_str = user_info.get("last_contribution")
#     # Full hours and full minutes (round it)
#     if last_contribution_str:
#         last_contribution_time = datetime.datetime.fromisoformat(last_contribution_str)
#         time_since_last = datetime.datetime.now() - last_contribution_time
#         if time_since_last < datetime.timedelta(hours=24):
#             # Calculate total seconds remaining
#             seconds_left = 24 * 3600 - time_since_last.total_seconds()
            
#             # Calculate hours and minutes
#             hours_left = int(seconds_left // 3600)
#             minutes_left = int((seconds_left % 3600) // 60)
            
#             # Construct the reply message
#             reply_text = "You've already contributed data. Please wait"
#             if hours_left > 0:
#                 reply_text += f" {hours_left} hour{'s' if hours_left > 1 else ''}"
#             if minutes_left > 0:
#                 # Add a comma and a space if there are also hours
#                 if hours_left > 0:
#                     reply_text += ","
#                 reply_text += f" {minutes_left} minute{'s' if minutes_left > 1 else ''}"
#             reply_text += " more."
            
#             await update.message.reply_text(reply_text)
#             return
    
#     # Determine what identifier to look for in filenames
#     username = user_info.get("username")
    
#     # Find log files that contain the user's identifier and end with _trades.csv
#     trade_data = {}
#     all_csv_files = glob.glob(str(LOGS_DIR / "*_trades.csv"))
    
#     for file_path in all_csv_files:
#         file_name = os.path.basename(file_path)
        
#         # Check if the user identifier is in the filename
#         filename_match = False
#         if username and username in file_name:
#             filename_match = True
#         elif not username and user_id in file_name:
#             filename_match = True
        
#         if filename_match:
#             try:
#                 df = pd.read_csv(file_path)
                
#                 # Filter to only include trades for this specific user
#                 if 'UserID' in df.columns:
#                     user_trades = df[df['UserID'] == username] if username else df[df['UserID'] == user_id]
#                 else:
#                     user_trades = df
                
#                 if not user_trades.empty:
#                     trade_data[file_name] = user_trades.to_dict('records')
                    
#             except Exception as e:
#                 await update.message.reply_text(f"Error reading log file {file_name}: {e}")
#                 continue
    
#     # If no trade data found, try alternative matching by reading all trade files
#     if not trade_data:
#         for file_path in all_csv_files:
#             file_name = os.path.basename(file_path)
#             try:
#                 df = pd.read_csv(file_path)
#                 if 'UserID' in df.columns:
#                     possible_identifiers = [username, user_id] if username else [user_id]
#                     matching_trades = df[df['UserID'].isin(possible_identifiers)]
#                     if not matching_trades.empty:
#                         trade_data[file_name] = matching_trades.to_dict('records')
#             except Exception as e:
#                 continue
    
#     # Get user config data
#     config_data = load_config()
#     user_configs = [c for c in config_data.get("trading_pairs", []) if c.get("userID") == user_id]
    
#     # Combine all data
#     combined_data = {
#         "user_id": user_id,
#         "username": user_info.get("username"),
#         "wallet_address": user_info.get("wallet_address"),
#         "configs": user_configs,
#         "trade_logs": trade_data
#     }
    
#     print(f"Combined data prepared for user {user_id}")
    

#     # ... (rest of your existing code remains the same)
#     # ... (after combining the data and before saving the new file)

#     # Save to /ipfs folder
#     os.makedirs(IPFS_DIR, exist_ok=True)
    
#     # 📌 Check for and remove any previous contributions from this user
#     # ------------------------------------------------------------------
#     previous_files = glob.glob(str(IPFS_DIR / f"{user_id}_*.json"))
#     for file_to_remove in previous_files:
#         try:
#             os.remove(file_to_remove)
#             print(f"Removed previous file for user {user_id}: {file_to_remove}")
#         except OSError as e:
#             print(f"Error removing file {file_to_remove}: {e}")
            
#     # ------------------------------------------------------------------
    
#     # Save to /ipfs folder
#     filename = f"{user_id}_{datetime.datetime.now().isoformat().replace(':', '-')}.json"
#     file_path = IPFS_DIR / filename
#     with open(file_path, "w") as f:
#         json.dump(combined_data, f, indent=2)
    
#     contribute_onchain_data(str(file_path))


#     # Update users.json
#     user_info["data"] = str(file_path)
#     user_info["last_contribution"] = datetime.datetime.now().isoformat()
#     save_users(users_data)
    
#     await update.message.reply_text(
#         "✅ **Data contribution successful!**\n\n"
#         "🔒 Your trading data has been securely processed and stored."
#         "All data remains private and encrypted on Lazai.\n\n"
#         "⏰ Next contribution will be available in 24 hours.\n\n"
#         "💡 Use /suggestion to receive personalized trading insights based on collective market intelligence."
#     )
    
#     return str(file_path)

async def contribute_onchain_data(filepath: str):
    #print(platform.system())
    if platform.system() == "Windows":
        gpg_bin = r"C:\Program Files (x86)\GnuPG\bin"
        os.environ["PATH"] = gpg_bin + os.pathsep + os.environ.get("PATH", "")
    
    client = Client()
    ipfs = PinataIPFS()
    # Read the file content and use the filename for the title
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            privacy_data = f.read()
        data_file_name = Path(filepath).name
    except FileNotFoundError:
        print(f"Error: File not found at {filepath}")
        return None
    except Exception as e:
        print(f"An error occurred while reading the file: {e}")
        return None
    
    try:
        # 1. Prepare your privacy data and encrypt it
        #data_file_name = file_name
        #privacy_data = "Your Privacy Data"
        encryption_seed = "Sign to retrieve your encryption key"
        message = encode_defunct(text=encryption_seed)
        password = client.wallet.sign_message(message).signature.hex()
        encrypted_data = encrypt(privacy_data.encode(), password)
        # 2. Upload the privacy data to IPFS and get the shared url
        # Load .env from project root (one level above 'plugins')
        env_path = Path(__file__).parent.parent / ".env"
        load_dotenv(dotenv_path=env_path)

        token = getenv("IPFS_JWT", "")

        try:
            file_meta = await ipfs.upload(
                UploadOptions(name=data_file_name, data=encrypted_data, token=token)
            )
        except Exception as e:
            import traceback
            traceback.print_exc()
            # If it's a ValidationError, inspect the raw data
            from pprint import pprint
            pprint(e.__dict__)
            raise

        file_meta = await ipfs.upload(
            UploadOptions(name=data_file_name, data=encrypted_data, token=token)
        )
        url = await ipfs.get_share_link(
            GetShareLinkOptions(token=token, id=file_meta.id)
        )
        print("File uploaded to IPFS:", url)
        # 3. Upload the privacy url to LazAI
        file_id = client.get_file_id_by_url(url)
        if file_id == 0:
            file_id = client.add_file(url)
        # 4. Request proof in the verified computing node
        client.request_proof(file_id, 100)
        job_id = client.file_job_ids(file_id)[-1]
        job = client.get_job(job_id)
        node_info = client.get_node(job[-1])
        node_url: str = node_info[1]
        print(node_url)
        pub_key = node_info[-1]
        encryption_key = rsa.encrypt(
            password.encode(),
            rsa.PublicKey.load_pkcs1(pub_key.strip().encode(), format="PEM"),
        ).hex()
        response = requests.post(
            f"{node_url}/proof",
            json=ProofRequest(
                job_id=job_id,
                file_id=file_id,
                file_url=url,
                encryption_key=encryption_key,
                encryption_seed=encryption_seed,
                proof_url=None,
            ).model_dump(),
        )
        if response.status_code == 200:
            print("Proof request sent successfully")
        else:
            print("Failed to send proof request:", response.json())
        # 5. Request DAT reward
        client.request_reward(file_id)
        print("Reward requested for file id", file_id)
        
        # Return the file_id for storage in users.json
        return file_id
        
    except StorageError as e:
        print(f"Error: {e}")
        return None
    except Exception as e:
        print(f"Unexpected error in contribute_onchain_data: {e}")
        return None
    finally:
        await ipfs.close()

async def data_contribution(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    Checks if 24 hours have passed, gathers user trade logs and config, combines into a JSON,
    saves it to /ipfs, and updates user data.
    """
    user_id = str(update.effective_user.id)
    users_data = load_users()
    user_info = users_data.get("users", {}).get(user_id)
    
    if not user_info:
        await update.message.reply_text("You are not a registered user. Please use the /start command.")
        return
    
    last_contribution_str = user_info.get("last_contribution")
    # Full hours and full minutes (round it)
    if last_contribution_str:
        last_contribution_time = datetime.datetime.fromisoformat(last_contribution_str)
        time_since_last = datetime.datetime.now() - last_contribution_time
        if time_since_last < datetime.timedelta(hours=24):
            # Calculate total seconds remaining
            seconds_left = 24 * 3600 - time_since_last.total_seconds()
            
            # Calculate hours and minutes
            hours_left = int(seconds_left // 3600)
            minutes_left = int((seconds_left % 3600) // 60)
            
            # Construct the reply message
            reply_text = "You've already contributed data. Please wait"
            if hours_left > 0:
                reply_text += f" {hours_left} hour{'s' if hours_left > 1 else ''}"
            if minutes_left > 0:
                # Add a comma and a space if there are also hours
                if hours_left > 0:
                    reply_text += ","
                reply_text += f" {minutes_left} minute{'s' if minutes_left > 1 else ''}"
            reply_text += " more."
            
            await update.message.reply_text(reply_text)
            return
    
    # Send initial progress message
    progress_message = await update.message.reply_text(
        "🔄 **Data contribution in progress...**\n\n"
        "⏳ Processing your trading data and uploading to secure storage.\n"
        "This may take a few moments. Please wait..."
    )
    
    # Determine what identifier to look for in filenames
    username = user_info.get("username")
    
    # Find log files that contain the user's identifier and end with _trades.csv
    trade_data = {}
    all_csv_files = glob.glob(str(LOGS_DIR / "*_trades.csv"))
    
    for file_path in all_csv_files:
        file_name = os.path.basename(file_path)
        
        # Check if the user identifier is in the filename
        filename_match = False
        if username and username in file_name:
            filename_match = True
        elif not username and user_id in file_name:
            filename_match = True
        
        if filename_match:
            try:
                df = pd.read_csv(file_path)
                
                # Filter to only include trades for this specific user
                if 'UserID' in df.columns:
                    user_trades = df[df['UserID'] == username] if username else df[df['UserID'] == user_id]
                else:
                    user_trades = df
                
                if not user_trades.empty:
                    trade_data[file_name] = user_trades.to_dict('records')
                    
            except Exception as e:
                await progress_message.edit_text(f"❌ Error reading log file {file_name}: {e}")
                return
    
    # If no trade data found, try alternative matching by reading all trade files
    if not trade_data:
        for file_path in all_csv_files:
            file_name = os.path.basename(file_path)
            try:
                df = pd.read_csv(file_path)
                if 'UserID' in df.columns:
                    possible_identifiers = [username, user_id] if username else [user_id]
                    matching_trades = df[df['UserID'].isin(possible_identifiers)]
                    if not matching_trades.empty:
                        trade_data[file_name] = matching_trades.to_dict('records')
            except Exception as e:
                continue
    
    # Get user config data
    config_data = load_config()
    user_configs = [c for c in config_data.get("trading_pairs", []) if c.get("userID") == user_id]
    
    # Combine all data
    combined_data = {
        "user_id": user_id,
        "username": user_info.get("username"),
        "wallet_address": user_info.get("wallet_address"),
        "configs": user_configs,
        "trade_logs": trade_data
    }
    
    print(f"Combined data prepared for user {user_id}")
    
    # Save to /ipfs folder
    os.makedirs(IPFS_DIR, exist_ok=True)
    
    # 📌 Check for and remove any previous contributions from this user
    # ------------------------------------------------------------------
    previous_files = glob.glob(str(IPFS_DIR / f"{user_id}_*.json"))
    for file_to_remove in previous_files:
        try:
            os.remove(file_to_remove)
            print(f"Removed previous file for user {user_id}: {file_to_remove}")
        except OSError as e:
            print(f"Error removing file {file_to_remove}: {e}")
            
    # ------------------------------------------------------------------
    
    # Save to /ipfs folder
    filename = f"{user_id}_{datetime.datetime.now().isoformat().replace(':', '-')}.json"
    file_path = IPFS_DIR / filename
    with open(file_path, "w") as f:
        json.dump(combined_data, f, indent=2)
    
    # Update progress message
    await progress_message.edit_text(
        "🔄 **Data contribution in progress...**\n\n"
        "📁 Data file created successfully.\n"
        "🔐 Encrypting and uploading to blockchain storage..."
    )
    try:
        # Contribute data onchain and get file_id
        file_id = await contribute_onchain_data(str(file_path))
    except Exception as e:
        print(f"Error during onchain contribution: {e}")
        file_id = None
    if file_id is None:
        await progress_message.edit_text(
            "❌ **Data contribution failed!**\n\n"
            "There was an error uploading your data to the blockchain storage.\n"
            "Please try again later or contact support."
        )
        return
    
    # Update users.json with file_id
    user_info["data"] = str(file_path)
    user_info["last_contribution"] = datetime.datetime.now().isoformat()
    user_info["last_file_id"] = file_id  # Store the file_id
    save_users(users_data)
    
    # Send success message with file_id
    await progress_message.edit_text(
        "✅ **Data contribution successful!**\n\n"
        "🔒 Your trading data has been securely processed and stored.\n"
        f"📋 **File ID:** `{file_id}`\n"
        "All data remains private and encrypted on Lazai.\n\n"
        "⏰ Next contribution will be available in 24 hours.\n\n"
        "💡 Use /suggestion to receive personalized trading insights based on collective market intelligence."
    )
    
    return str(file_path)

async def get_suggestion(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    Retrieves user's private data, gathers all other users' data, sends a prompt to DeepSeek API
    to compare and analyze the strategies, and returns a suggested analysis.
    """
    user_id = str(update.effective_user.id)
    users_data = load_users()
    user_info = users_data.get("users", {}).get(user_id)

    if not user_info:
        await update.message.reply_text("You are not a registered user. Please use the /start command.")
        return
    
    # Check 24-hour time limit for suggestions
    last_suggestion_str = user_info.get("last_suggestion")
    if last_suggestion_str:
        last_suggestion_time = datetime.datetime.fromisoformat(last_suggestion_str)
        time_since_last = datetime.datetime.now() - last_suggestion_time
        if time_since_last < datetime.timedelta(hours=24):
            # Calculate total seconds left
            seconds_left = 24 * 3600 - time_since_last.total_seconds()

            # Calculate hours and minutes from the remaining seconds
            hours_left = int(seconds_left // 3600)
            minutes_left = int((seconds_left % 3600) // 60)
            
            # Build the reply message string
            reply_parts = []
            if hours_left > 0:
                reply_parts.append(f"{hours_left} hour{'s' if hours_left > 1 else ''}")
            if minutes_left > 0:
                reply_parts.append(f"{minutes_left} minute{'s' if minutes_left > 1 else ''}")
            
            time_left_str = " and ".join(reply_parts)

            await update.message.reply_text(
                f"⏰ You've already received a suggestion today. "
                f"Please wait {time_left_str} more before requesting another analysis."
            )
            return
    
    user_data_path = user_info.get("data")
    if not user_data_path or not os.path.exists(user_data_path):
        await update.message.reply_text("📊 No trading data found for your account. Please use the /contribute command first to share your data.")
        return

    # Read the user's private data file
    with open(user_data_path, "r") as f:
        user_private_data = json.load(f)

    # Get all other users' data from the /ipfs folder
    all_users_data = []
    for file_path in glob.glob(str(IPFS_DIR / "*.json")):
        if user_id not in file_path:  # Exclude the current user's file
            try:
                with open(file_path, "r") as f:
                    all_users_data.append(json.load(f))
            except Exception as e:
                print(f"Error reading data file {file_path}: {e}")
                continue

    # Prepare prompt for DeepSeek API
    prompt_message = (
        "Analyze the following trading data and provide suggestions for improvement. "
        "Your analysis should compare the user's performance with the collective data of other users. "
        "The suggestions should be actionable, focusing on specific parameters like `trigger_percentage` "
        "and `trade_percentage`. "
        "Here is the user's private data: \n"
        f"User Data: {json.dumps(user_private_data, indent=2)}\n\n"
        "Here is the collective, anonymous data from other users: \n"
        f"Collective Data: {json.dumps(all_users_data, indent=2)}\n\n"
        "Provide your analysis in a clear, concise, and friendly manner, "
        "similar to this example:\n"
        "\"Based on the collective data for tgMetis/tgUSDC, your `trigger_percentage` of 0.1 is slightly high, "
        "leading to fewer trades than the top-performing strategies. Consider lowering it to 0.08 to capture "
        "more frequent movements. Your `trade_percentage` of 0.1426 is solid, but increasing it to 0.18 "
        "could improve returns without significantly raising risk.\"\n"
        "Focus on one or two key suggestions and keep the response brief."
    )

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {DEEPSEEK_API_KEY}"
    }

    payload = {
        "model": "deepseek-chat",  # or "deepseek-reasoner"
        "messages": [
            {"role": "system", "content": "You are a helpful trading strategy analyst."},
            {"role": "user", "content": prompt_message}
        ],
        "stream": False
    }

    try:
        # Send processing message to user
        await update.message.reply_text("🔍 Analyzing your trading data against collective market intelligence... Please wait.")
        
        response = requests.post(DEEPSEEK_API_URL, headers=headers, json=payload)
        response.raise_for_status()  # Raise an exception for bad status codes
        
        suggestion_data = response.json()
        suggestion_text = suggestion_data["choices"][0]["message"]["content"]
        
        # Update last suggestion timestamp
        user_info["last_suggestion"] = datetime.datetime.now().isoformat()
        save_users(users_data)
        
        await update.message.reply_text(f"🔮 **Strategy Suggestion**\n\n{suggestion_text}\n")
        await update.message.reply_text(f"⚙️ Use /config to create or edit your strategy configuration")

    except requests.exceptions.RequestException as e:
        await update.message.reply_text(f"❌ An error occurred while connecting to the analysis service: {e}")
        return
    except (KeyError, IndexError) as e:
        await update.message.reply_text(f"❌ An error occurred while processing the analysis: {e}")
        return





async def setup_commands(app):
    """Set up the bot commands menu"""
    commands = [
        BotCommand("start", "🚀 Start/Register with LazaiTrader"),
        BotCommand("config", "⚙️ Create or edit strategy configuration"),
        BotCommand("myconfig", "📊 View your active strategies"),
        BotCommand("deleteconfig", "🗑️ Delete a strategy"),
        BotCommand("balance", "💰 Check wallet balances"),
        BotCommand("wallet", "📋 Show your wallet address"),
        BotCommand("withdraw", "💸 Withdraw funds (disabled)"),
        BotCommand("chart", "📈 View your trade history chart"),
        BotCommand("contribute", "📈 Share your trading data for analysis"),
        BotCommand("suggestion", "🔮 Get strategy suggestions based on collective data"),
        BotCommand("cancel", "❌ Cancel the current operation")
    ]
    await app.bot.set_my_commands(commands)

async def post_init(app):
    await setup_commands(app)

def main():
    if not bot_token:
        print("Error: TELEGRAM_BOT_TOKEN not found in environment variables")
        return

    app = ApplicationBuilder().token(bot_token).post_init(post_init).build()
    
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
        fallbacks=[CommandHandler("cancel", cancel)],
        per_message=False,
    )

    delete_conv = ConversationHandler(
        entry_points=[CommandHandler("deleteconfig", delete_config_start)],
        states={
            SELECT_CONFIG_TO_DELETE: [CallbackQueryHandler(handle_config_deletion_selection)],
            CONFIRM_DELETE: [CallbackQueryHandler(handle_final_delete_confirmation)],
        },
        fallbacks=[CommandHandler("cancel", cancel)],
        per_message=False,
    )

    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("wallet", wallet))
    app.add_handler(CommandHandler("address", wallet))
    app.add_handler(CommandHandler("balance", balance))
    app.add_handler(CommandHandler("withdraw", withdraw))
    app.add_handler(CommandHandler("myconfig", my_config))
    app.add_handler(CommandHandler("chart", chart_command)) # New chart command handler
    app.add_handler(CommandHandler("contribute", data_contribution))
    app.add_handler(CommandHandler("suggestion", get_suggestion))
    app.add_handler(config_conv)
    app.add_handler(delete_conv)
    
    print("Enhanced LazaiTrader bot is running...")
    app.run_polling()

if __name__ == "__main__":
    main()
