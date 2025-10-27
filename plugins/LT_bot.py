'''
version 0.2 SCW enbaled non-custodial wallet management system
'''

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
    ContextTypes,
    MessageHandler,
    filters
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
from eth_account import Account
from os import getenv
import asyncio
import rsa
import os, sys
import platform

# Load environment variables
BASE_PATH = pathlib.Path(__file__).parent.parent
load_dotenv(dotenv_path=BASE_PATH / ".env")

# Get bot token and blockchain config
bot_token = os.getenv("TELEGRAM_BOT_TOKEN")
RPC_URL = os.getenv('RPC_URL', "https://hyperion-testnet.metisdevops.link")
CHAIN_ID = int(os.getenv('CHAIN_ID', 133717))

# SCW Configuration
BOT_WALLET = os.getenv('BOT_WALLET')
BOT_WALLET_PRIVATE_KEY = os.getenv('BOT_WALLET_PRIVATE_KEY')
FACTORY_CONTRACT_ADDRESS = os.getenv('FACTORY_CONTRACT_ADDRESS')

# API Keys
DEEPSEEK_API_URL = os.getenv("DEEPSEEK_API_URL", "https://api.deepseek.com/v1/chat/completions")
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY")

# File paths
PROJECT_ROOT = pathlib.Path(__file__).resolve().parent.parent
USERS_FILE = PROJECT_ROOT / "config" / "users.json"
CONFIG_PATH = PROJECT_ROOT / "config" / "config.json"
TOKENS_FILE = PROJECT_ROOT / "config" / "tokens.json"
LOGS_DIR = PROJECT_ROOT / "logs"
IPFS_DIR = PROJECT_ROOT / "ipfs"
PLUGIN_DIR = pathlib.Path(__file__).resolve().parent
DEX_ADDRESSES_FILE = PLUGIN_DIR / "dex_addresses.json"

# Conversation states
PAIR_SELECT, RISK, TRADE_PERCENTAGE_CONFIRM, TRIGGER_PERCENTAGE_CONFIRM, MAX_AMOUNT_CONFIRM, FINALIZE = range(6)
SELECT_CONFIG_TO_DELETE, CONFIRM_DELETE = range(6, 8)
WAITING_FOR_WALLET = 100

# ABIs
ERC20_ABI = json.loads("""[
  {"constant":false,"inputs":[{"name":"spender","type":"address"},{"name":"amount","type":"uint256"}],
   "name":"approve","outputs":[{"name":"","type":"bool"}],"type":"function"},
  {"constant":true,"inputs":[{"name":"account","type":"address"}],
   "name":"balanceOf","outputs":[{"name":"","type":"uint256"}],"type":"function"},
  {"constant":true,"inputs":[],"name":"decimals",
   "outputs":[{"name":"","type":"uint8"}],"type":"function"},
  {"constant":true,"inputs":[],"name":"symbol",
   "outputs":[{"name":"","type":"string"}],"type":"function"}
]""")

FACTORY_ABI = json.loads("""[
  {"inputs":[{"name":"_owner","type":"address"}],"name":"createWallet","outputs":[{"name":"wallet","type":"address"}],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"name":"_user","type":"address"}],"name":"userWallets","outputs":[{"name":"","type":"address"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"name":"_user","type":"address"}],"name":"hasWallet","outputs":[{"name":"","type":"bool"}],"stateMutability":"view","type":"function"}
]""")

SCW_ABI = json.loads("""[
  {"inputs":[],"name":"owner","outputs":[{"name":"","type":"address"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"botOperator","outputs":[{"name":"","type":"address"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"name":"_token","type":"address"}],"name":"getTokenBalance","outputs":[{"name":"balance","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"getNativeBalance","outputs":[{"name":"balance","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"name":"_token","type":"address"}],"name":"withdrawAllTokens","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[],"name":"withdrawAllNative","outputs":[],"stateMutability":"nonpayable","type":"function"}
]""")

# --- Utility Functions ---

def load_users():
    """Load users data from JSON file"""
    if not os.path.exists(USERS_FILE):
        return {"users": {}}
    with open(USERS_FILE, "r") as f:
        return json.load(f)

def save_users(data):
    """Save users data to JSON file"""
    os.makedirs(os.path.dirname(USERS_FILE), exist_ok=True)
    with open(USERS_FILE, "w") as f:
        json.dump(data, f, indent=2)

def load_tokens():
    """Load token information from tokens.json"""
    if not os.path.exists(TOKENS_FILE):
        return {}
    with open(TOKENS_FILE, "r") as f:
        data = json.load(f)
        return data.get("tokens", {})

def load_config():
    """Load trading configuration"""
    if not os.path.exists(CONFIG_PATH):
        return {"trading_pairs": []}
    try:
        with open(CONFIG_PATH, "r") as f:
            return json.load(f)
    except (json.JSONDecodeError, FileNotFoundError):
        return {"trading_pairs": []}

def save_config_entry(user_id, config_data):
    """Save trading configuration for user"""
    os.makedirs(CONFIG_PATH.parent, exist_ok=True)
    config = load_config()
    user_id_str = str(user_id)

    # Remove existing config for same pair
    config["trading_pairs"] = [
        entry for entry in config["trading_pairs"]
        if not (str(entry.get("userID")) == user_id_str and 
                entry.get("symbol1") == config_data["symbol1"] and 
                entry.get("symbol2") == config_data["symbol2"])
    ]

    config["trading_pairs"].append(config_data)

    with open(CONFIG_PATH, "w") as f:
        json.dump(config, f, indent=2)

def delete_config_entry(user_id, symbol1, symbol2):
    """Delete trading configuration"""
    config = load_config()
    initial_count = len(config.get("trading_pairs", []))
    
    config["trading_pairs"] = [
        entry for entry in config.get("trading_pairs", [])
        if not (str(entry.get("userID")) == str(user_id) and 
                entry.get("symbol1") == symbol1 and 
                entry.get("symbol2") == symbol2)
    ]
    
    if len(config["trading_pairs"]) < initial_count:
        with open(CONFIG_PATH, "w") as f:
            json.dump(config, f, indent=2)
        return True
    return False

def is_valid_eth_address(address: str) -> bool:
    """Validate Ethereum address format"""
    try:
        return Web3.is_address(address)
    except:
        return False

def round_to_one_decimal(value):
    """Round value to 2 decimal places"""
    return round(value, 2)

def get_available_trading_pairs():
    """Get available trading pairs"""
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

# --- Blockchain Functions ---

async def deploy_scw_for_user(user_wallet_address: str) -> str:
    """Deploy Smart Contract Wallet for user"""
    try:
        w3 = Web3(Web3.HTTPProvider(RPC_URL))
        if not w3.is_connected():
            raise Exception("Failed to connect to blockchain")
        
        if not BOT_WALLET_PRIVATE_KEY:
            raise Exception("Bot wallet private key not found")
        
        bot_account = Account.from_key(BOT_WALLET_PRIVATE_KEY)
        
        factory_contract = w3.eth.contract(
            address=Web3.to_checksum_address(FACTORY_CONTRACT_ADDRESS),
            abi=FACTORY_ABI
        )
        
        # Check if wallet exists
        existing_wallet = factory_contract.functions.userWallets(
            Web3.to_checksum_address(user_wallet_address)
        ).call()
        
        if existing_wallet != '0x0000000000000000000000000000000000000000':
            return existing_wallet
        
        # Create wallet
        nonce = w3.eth.get_transaction_count(bot_account.address)
        
        txn = factory_contract.functions.createWallet(
            Web3.to_checksum_address(user_wallet_address)
        ).build_transaction({
            'from': bot_account.address,
            'nonce': nonce,
            'gas': 2000000,
            'gasPrice': w3.eth.gas_price,
            'chainId': CHAIN_ID
        })
        
        signed_txn = bot_account.sign_transaction(txn)
        tx_hash = w3.eth.send_raw_transaction(signed_txn.raw_transaction)
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
        
        if receipt['status'] == 1:
            scw_address = factory_contract.functions.userWallets(
                Web3.to_checksum_address(user_wallet_address)
            ).call()
            return scw_address
        else:
            raise Exception("Transaction failed")
            
    except Exception as e:
        print(f"Error deploying SCW: {e}")
        raise

def get_wallet_balances(wallet_address):
    """Get token balances from wallet"""
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

async def withdraw_from_scw(scw_address: str, token_address: str = None):
    """Bot withdraws funds from SCW to owner"""
    try:
        w3 = Web3(Web3.HTTPProvider(RPC_URL))
        if not w3.is_connected():
            raise Exception("Failed to connect to blockchain")
        
        if not BOT_WALLET_PRIVATE_KEY:
            raise Exception("Bot wallet private key not found")
        
        bot_account = Account.from_key(BOT_WALLET_PRIVATE_KEY)
        
        scw_contract = w3.eth.contract(
            address=Web3.to_checksum_address(scw_address),
            abi=SCW_ABI
        )
        
        nonce = w3.eth.get_transaction_count(bot_account.address)
        
        if token_address:
            # Withdraw tokens
            txn = scw_contract.functions.withdrawAllTokens(
                Web3.to_checksum_address(token_address)
            ).build_transaction({
                'from': bot_account.address,
                'nonce': nonce,
                'gas': 300000,
                'gasPrice': w3.eth.gas_price,
                'chainId': CHAIN_ID
            })
        else:
            # Withdraw native
            txn = scw_contract.functions.withdrawAllNative().build_transaction({
                'from': bot_account.address,
                'nonce': nonce,
                'gas': 200000,
                'gasPrice': w3.eth.gas_price,
                'chainId': CHAIN_ID
            })
        
        signed_txn = bot_account.sign_transaction(txn)
        tx_hash = w3.eth.send_raw_transaction(signed_txn.raw_transaction)
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
        
        return receipt['status'] == 1, tx_hash.hex()
        
    except Exception as e:
        print(f"Error withdrawing from SCW: {e}")
        return False, None

# --- Chart Generation ---

def chartTrades(log_dir, username):
    """Generate trade history chart"""
    all_price_data = []
    all_trades_data = []

    trade_files = list(log_dir.glob(f"*{username}*_trades.csv"))
    
    if not trade_files:
        return None

    for trade_file_path in trade_files:
        try:
            file_prefix = trade_file_path.stem.replace(f"_{username}_trades", '')
            price_file_path = log_dir / f"{file_prefix}_{username}.csv"

            price_df = pd.read_csv(price_file_path)
            trades_df = pd.read_csv(trade_file_path)
            
            price_df['pair'] = file_prefix
            trades_df['pair'] = file_prefix
            
            all_price_data.append(price_df)
            all_trades_data.append(trades_df)
        except:
            continue

    if not all_trades_data:
        return None

    combined_price_df = pd.concat(all_price_data, ignore_index=True)
    combined_trades_df = pd.concat(all_trades_data, ignore_index=True)
    
    user_trades = combined_trades_df[combined_trades_df['UserID'] == username].copy()

    if user_trades.empty:
        return None

    for df in [combined_price_df, user_trades]:
        df['Date'] = df['Date'].astype(str).str.zfill(6)
        df['Time'] = df['Time'].astype(str).str.zfill(6)
        df['datetime'] = pd.to_datetime(df['Date'] + df['Time'], format='%y%m%d%H%M%S')
    
    combined_price_df = combined_price_df.sort_values('datetime')
    user_trades = user_trades.sort_values('datetime')

    initial_balance_usd = user_trades.iloc[0]['Total_Balance_USD'] if not user_trades.empty else 0
    final_balance_usd = user_trades.iloc[-1]['Total_Balance_USD'] if not user_trades.empty else 0
    pnl_percentage = ((final_balance_usd - initial_balance_usd) / initial_balance_usd * 100) if initial_balance_usd > 0 else 0

    unique_pairs = user_trades['pair'].unique()
    fig, axes = plt.subplots(nrows=len(unique_pairs), ncols=1, figsize=(15, 6 * len(unique_pairs)), sharex=True)
    
    if len(unique_pairs) == 1:
        axes = [axes]

    fig.suptitle(f'Trade History for {username}\nOverall PnL: {pnl_percentage:.2f}%', fontsize=16, fontweight='bold')
    
    for ax, pair_name in zip(axes, unique_pairs):
        pair_price_df = combined_price_df[combined_price_df['pair'] == pair_name]
        pair_trades_df = user_trades[user_trades['pair'] == pair_name]
        
        ax.plot(pair_price_df['datetime'], pair_price_df['Price'], label=f'{pair_name} Price')
        ax.set_ylabel('Price')
        ax.set_title(f'{pair_name} Price and Trades')
        ax.grid(True, linestyle='--', alpha=0.6)

        if not pair_trades_df.empty:
            buy_trades = pair_trades_df[pair_trades_df['Action'] == 'BUY']
            sell_trades = pair_trades_df[pair_trades_df['Action'] == 'SELL']
            
            ax.scatter(buy_trades['datetime'], buy_trades['Price'], color='green', marker='o', s=100, label='Buy', zorder=5)
            ax.scatter(sell_trades['datetime'], sell_trades['Price'], color='red', marker='o', s=100, label='Sell', zorder=5)
        
        ax.legend()

    axes[-1].set_xlabel('Date')
    fig.autofmt_xdate()

    output_filename = f'trades_chart_{username}.png'
    plt.tight_layout(rect=[0, 0.03, 1, 0.95])
    plt.savefig(output_filename)
    plt.close(fig)
    return output_filename

# --- Command Handlers ---

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Start command - register or welcome back"""
    chat_id = str(update.effective_user.id)
    username = update.effective_user.username or ""
    data = load_users()

    if chat_id in data["users"]:
        user_info = data["users"][chat_id]
        await update.message.reply_text(
            f"👋 *Welcome back, trader!*\n\n"
            f"Your trading system is active and ready!\n\n"
            f"📊 *Quick Status:*\n"
            f"💼 Your Wallet: `{user_info['user_wallet']}`\n"
            f"🔐 Trading Wallet: `{user_info['scw_address']}`\n\n"
            f"*What would you like to do?*\n\n"
            f"💰 /balance - Check your funds\n"
            f"📈 /chart - See your performance\n"
            f"⚙️ /config - Update your strategy\n"
            f"💸 /withdraw - Cash out profits\n"
            f"📋 /myconfig - Review active strategies\n\n"
            f"💡 *Tip:* Markets never sleep, and neither does your AI! "
            f"It's trading 24/7 based on your settings.",
            parse_mode='Markdown'
        )
        return

    await update.message.reply_text(
        f"👋 *Welcome to LazaiTrader, @{username}!* 🎉\n\n"
        f"Get ready to experience AI-powered automated trading while keeping full control of your funds!\n\n"
        f"🔐 *How it works:*\n"
        f"1️⃣ You provide your wallet address\n"
        f"2️⃣ We deploy a secure Smart Contract Wallet (SCW)\n"
        f"3️⃣ You fund it and set your strategy\n"
        f"4️⃣ Our AI trades 24/7 based on your rules\n\n"
        f"✨ *Your funds stay yours:*\n"
        f"• You own the wallet, not us\n"
        f"• Only YOU can withdraw\n"
        f"• Bot can only trade on approved exchanges\n\n"
        f"📝 *Let's start!* Send your Ethereum wallet address (starts with 0x...):",
        parse_mode='Markdown'
    )
    return WAITING_FOR_WALLET

async def handle_wallet_address(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle wallet address input"""
    chat_id = str(update.effective_user.id)
    username = update.effective_user.username or chat_id
    wallet_address = update.message.text.strip()
    
    if not is_valid_eth_address(wallet_address):
        await update.message.reply_text(
            "⚠️ *Hmm, that doesn't look right...*\n\n"
            "We need a valid Ethereum address that:\n"
            "• Starts with 0x\n"
            "• Has 42 characters total\n"
            "• Contains only numbers and letters A-F\n\n"
            "Example: `0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb`\n\n"
            "💡 Copy it from MetaMask or your wallet app and try again:",
            parse_mode='Markdown'
        )
        return WAITING_FOR_WALLET
    
    # Check if already registered
    data = load_users()
    for user_id, user_data in data["users"].items():
        if user_data.get("user_wallet", "").lower() == wallet_address.lower():
            await update.message.reply_text(
                "🔒 *This wallet is already in use!*\n\n"
                "Someone has already registered with this address. Each wallet can only have one LazaiTrader account.\n\n"
                "*Options:*\n"
                "• Use a different wallet address\n"
                "• If this is your wallet, contact support\n\n"
                "Send a different address:"
            )
            return WAITING_FOR_WALLET
    
    processing_msg = await update.message.reply_text(
        "⏳ *Setting up your account...*\n\n"
        "🔧 Creating your Smart Contract Wallet on the blockchain\n"
        "⚡ This takes 10-30 seconds\n\n"
        "*What's happening:*\n"
        "• Deploying your personal trading wallet\n"
        "• Configuring security settings\n"
        "• Connecting to approved exchanges\n\n"
        "Please wait, magic in progress... ✨",
        parse_mode='Markdown'
    )
    
    try:
        scw_address = await deploy_scw_for_user(wallet_address)
        
        data["users"][chat_id] = {
            "user_wallet": wallet_address,
            "scw_address": scw_address,
            "telegram_chat_id": chat_id,
            "username": username,
            "registered_at": datetime.datetime.now().isoformat()
        }
        save_users(data)
        
        await processing_msg.edit_text(
            f"🎉 *You're all set up!*\n\n"
            f"Your personal trading system is ready to go!\n\n"
            f"📋 *Your Addresses:*\n"
            f"💼 Your Wallet (EOA): `{wallet_address}`\n"
            f"🔐 Trading Wallet (SCW): `{scw_address}`\n\n"
            f"🚀 *Quick Start Guide:*\n\n"
            f"*Step 1: Fund your Trading Wallet* 💰\n"
            f"Send tokens to: `{scw_address}`\n"
            f"(This is where trading happens)\n\n"
            f"*Step 2: Set Your Strategy* ⚙️\n"
            f"Use /config to tell the AI how to trade\n\n"
            f"*Step 3: Monitor & Profit* 📈\n"
            f"/balance - Check your funds\n"
            f"/chart - See your trades\n"
            f"/withdraw - Get your profits\n\n"
            f"Ready to configure your first strategy? Use /config",
            parse_mode='Markdown'
        )
        
        return ConversationHandler.END
        
    except Exception as e:
        await processing_msg.edit_text(
            f"❌ *Registration Failed*\n\n"
            f"Error: {str(e)}\n\n"
            f"Please try again or contact support.",
            parse_mode='Markdown'
        )
        return ConversationHandler.END

async def wallet(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show wallet addresses"""
    chat_id = str(update.effective_user.id)
    user = load_users()["users"].get(chat_id)
    if not user:
        await update.message.reply_text("You're not registered. Please send /start first.")
        return
    
    await update.message.reply_text(
        f"💼 *Your Wallet Dashboard*\n\n"
        f"🏦 *Your Personal Wallet (EOA)*\n"
        f"`{user['user_wallet']}`\n"
        f"This is your main wallet - you control the private keys\n\n"
        f"🤖 *Your Trading Wallet (SCW)*\n"
        f"`{user['scw_address']}`\n"
        f"This is where the magic happens!\n\n"
        f"*How it works:*\n"
        f"✅ You fund the Trading Wallet\n"
        f"✅ AI trades automatically based on your strategy\n"
        f"✅ Only YOU can withdraw - bot can't steal!\n"
        f"✅ Bot only trades on verified DEXs\n\n"
        f"*Quick Actions:*\n"
        f"💰 /balance - Check funds\n"
        f"💸 /withdraw - Get your money",
        parse_mode='Markdown'
    )

async def balance(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show SCW balances"""
    chat_id = str(update.effective_user.id)
    user = load_users()["users"].get(chat_id)
    if not user:
        await update.message.reply_text("You're not registered. Please send /start first.")
        return

    await update.message.reply_text(
        "🔍 *Checking your funds...*\n\n"
        "Scanning the blockchain for your token balances\n"
        "⏱️ Just a moment..."
    )
    
    scw_balances = get_wallet_balances(user['scw_address'])
    
    if scw_balances is None:
        await update.message.reply_text(
            "⚠️ *Oops! Connection issue*\n\n"
            "We couldn't fetch your balances right now. This usually means:\n\n"
            "• Blockchain node is busy\n"
            "• Network congestion\n"
            "• Temporary connection issue\n\n"
            "*What to do:*\n"
            "✅ Wait 10-30 seconds and try again\n"
            "✅ Use /wallet to verify your addresses\n"
            "✅ Contact support if it persists\n\n"
            "Try /balance again in a moment!",
            parse_mode='Markdown'
        )
        return
    
    # Check if wallet is empty
    has_balance = any(info.get('balance', 0) > 0 for info in scw_balances.values())
    
    if not has_balance:
        await update.message.reply_text(
            f"💰 *Your Trading Wallet*\n\n"
            f"📍 Wallet: `{user['scw_address']}`\n\n"
            f"📊 *Current Balance:*\n"
            f"━━━━━━━━━━━━━━━━\n"
            f"💎 All tokens: 0\n"
            f"━━━━━━━━━━━━━━━━\n\n"
            f"⚠️ *Your wallet is empty!*\n\n"
            f"*To start trading:*\n"
            f"1️⃣ Send tokens to your Trading Wallet\n"
            f"2️⃣ Configure your strategy with /config\n"
            f"3️⃣ Let the AI do the rest!\n\n"
            f"*Send tokens here:*\n"
            f"`{user['scw_address']}`\n\n"
            f"*Testnet Tokens Available:*\n"
            f"• tgMetis / tgUSDC (Active)\n"
            f"• tgETH / tgUSDC (Active)\n\n"
            f"💡 Get testnet tokens from the faucet in our Telegram group!",
            parse_mode='Markdown'
        )
        return
    
    balance_text = (
        f"💰 *Your Trading Wallet Balance*\n\n"
        f"📍 Wallet: `{user['scw_address']}`\n\n"
        f"📊 *Token Balances:*\n"
        f"━━━━━━━━━━━━━━━━\n"
    )
    
    total_value = 0
    for symbol, info in scw_balances.items():
        balance = info.get('balance', 0.0)
        if balance > 0:
            balance_text += f"💎 {symbol}: {balance:.4f}\n"
    
    balance_text += f"━━━━━━━━━━━━━━━━\n\n"
    balance_text += f"💵 Total Value: ~${total_value:.2f} USD\n\n"
    balance_text += f"📈 Performance: Check /chart for details\n\n"
    balance_text += f"*Need to add funds?*\n"
    balance_text += f"Send tokens to: `{user['scw_address']}`\n\n"
    balance_text += f"*Ready to withdraw?*\n"
    balance_text += f"Use /withdraw to send profits to your wallet"
    
    await update.message.reply_text(balance_text, parse_mode='Markdown')

async def withdraw(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Withdraw all funds from SCW to owner"""
    chat_id = str(update.effective_user.id)
    user = load_users()["users"].get(chat_id)
    
    if not user:
        await update.message.reply_text("You're not registered. Please send /start first.")
        return

    scw_address = user['scw_address']
    user_wallet = user['user_wallet']
    
    await update.message.reply_text(
        f"💸 *Processing Your Withdrawal*\n\n"
        f"Transferring ALL funds:\n"
        f"🔐 From: Trading Wallet\n"
        f"`{scw_address}`\n\n"
        f"📍 To: Your Personal Wallet\n"
        f"`{user_wallet}`\n\n"
        f"⏳ Please wait 20-60 seconds...\n\n"
        f"We're withdrawing all your tokens and ETH to your wallet. "
        f"The blockchain is processing multiple transactions.",
        parse_mode='Markdown'
    )
    
    tokens = load_tokens()
    withdrawals_done = []
    
    try:
        # Withdraw each token
        for symbol, token_info in tokens.items():
            token_address = token_info['address']
            
            # Check balance
            scw_balances = get_wallet_balances(scw_address)
            if scw_balances and scw_balances.get(symbol, {}).get('balance', 0) > 0:
                success, tx_hash = await withdraw_from_scw(scw_address, token_address)
                if success:
                    balance = scw_balances.get(symbol, {}).get('balance', 0)
                    withdrawals_done.append({
                        'symbol': symbol,
                        'amount': balance,
                        'tx_hash': tx_hash
                    })
        
        # Withdraw native
        success, tx_hash = await withdraw_from_scw(scw_address, None)
        if success:
            withdrawals_done.append({
                'symbol': 'Native ETH',
                'amount': 0.05,
                'tx_hash': tx_hash
            })
        
        if withdrawals_done:
            result_text = (
                f"🎉 *Withdrawal Successful!*\n\n"
                f"All your funds are on the way to your wallet!\n\n"
                f"📍 Destination: `{user_wallet}`\n\n"
                f"✅ *Completed Transactions:*\n"
                f"━━━━━━━━━━━━━━━━\n"
            )
            
            for withdrawal in withdrawals_done:
                result_text += f"💎 {withdrawal['symbol']}: {withdrawal['amount']:.2f}\n"
                result_text += f"   `{withdrawal['tx_hash'][:20]}...`\n\n"
            
            result_text += (
                f"━━━━━━━━━━━━━━━━\n\n"
                f"⏱️ *Delivery Time:* 1-5 minutes\n\n"
                f"*Check your wallet:*\n"
                f"Your funds should appear shortly. You can verify on the blockchain explorer.\n\n"
                f"*What's next?*\n"
                f"• Fund again to keep trading: Send to `{scw_address}`\n"
                f"• Check performance: /chart\n"
                f"• Update strategy: /config"
            )
        else:
            result_text = (
                f"🤷 *Nothing to withdraw!*\n\n"
                f"Your Trading Wallet is currently empty.\n\n"
                f"Current Balance: 0 tokens\n\n"
                f"*This means:*\n"
                f"• All funds already withdrawn, OR\n"
                f"• No funds deposited yet, OR\n"
                f"• All funds currently in open positions\n\n"
                f"*What to do:*\n"
                f"💰 Check balance: /balance\n"
                f"📈 View trades: /chart\n"
                f"💸 Fund wallet: Send to `{scw_address}`"
            )
        
        await update.message.reply_text(result_text, parse_mode='Markdown')
        
    except Exception as e:
        await update.message.reply_text(
            f"⚠️ *Withdrawal Failed*\n\n"
            f"Something went wrong during the withdrawal process.\n\n"
            f"*Error Details:*\n"
            f"`{str(e)}`\n\n"
            f"*Common causes:*\n"
            f"• Insufficient gas fees\n"
            f"• Network congestion\n"
            f"• Transaction timeout\n\n"
            f"*What to do:*\n"
            f"✅ Try again in 1-2 minutes\n"
            f"✅ Check your balance: /balance\n"
            f"✅ Verify wallet address: /wallet\n"
            f"✅ Contact support if it keeps failing\n\n"
            f"Your funds are safe! Nothing was withdrawn.",
            parse_mode='Markdown'
        )

async def chart_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Generate and send trade history chart"""
    chat_id = str(update.effective_user.id)
    users = load_users()["users"]
    
    if chat_id not in users:
        await update.message.reply_text("Please register with /start before trying to view your trade history.")
        return

    user_identifier = users[chat_id].get('username') or chat_id
    
    await update.message.reply_text(
        "📊 *Creating Your Performance Chart...*\n\n"
        "Analyzing your trades and generating visual report\n\n"
        "⏱️ This takes 10-20 seconds\n\n"
        "*What you'll see:*\n"
        "• Price movements over time\n"
        "• Your buy/sell points\n"
        "• Overall profit/loss\n"
        "• Win rate statistics\n\n"
        "Hang tight, crunching the numbers... 🔢",
        parse_mode='Markdown'
    )

    chart_filename = chartTrades(LOGS_DIR, user_identifier)
    
    if chart_filename:
        try:
            with open(chart_filename, 'rb') as f:
                await update.message.reply_photo(photo=f, caption="📊 Your Trade History Chart")
            os.remove(chart_filename)
        except FileNotFoundError:
            await update.message.reply_text("❌ Error: Could not find the generated chart file.")
    else:
        await update.message.reply_text(
            "📊 *No Trade History Yet*\n\n"
            "Looks like your bot hasn't made any trades yet!\n\n"
            "*This could mean:*\n"
            "• Bot just started (needs time)\n"
            "• Price hasn't hit your trigger points\n"
            "• Wallet not funded\n\n"
            "*What to check:*\n"
            "✅ Balance: /balance\n"
            "✅ Strategy: /myconfig\n"
            "✅ Fund wallet if needed\n\n"
            "Be patient! First trades usually happen within 24 hours. 📈",
            parse_mode='Markdown'
        )

# --- Config Conversation Handlers ---

async def config_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Start configuration"""
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
        "⚙️ *Let's Set Up Your Trading Strategy!*\n\n"
        "First, choose which crypto pair you want to trade.\n\n"
        "*Available on Testnet:*\n"
        "🟢 = Active and ready\n"
        "🔒 = Coming soon\n\n"
        "Select a trading pair:",
        reply_markup=reply_markup,
        parse_mode='Markdown'
    )
    return PAIR_SELECT

async def handle_pair_selection(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle pair selection"""
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
        await query.edit_message_text("🔒 This pair isn't available on testnet. Use /config to select available pair.")
        return ConversationHandler.END
        
    context.user_data["symbol1"], context.user_data["symbol2"] = symbol1, symbol2
    
    keyboard = [
        [InlineKeyboardButton("🛡️ Conservative (Lower Risk)", callback_data="low_risk")],
        [InlineKeyboardButton("⚡ Aggressive (Higher Risk)", callback_data="high_risk")]
    ]
    await query.edit_message_text(
        f"⚖️ *Choose Your Risk Level*\n\n"
        f"Trading Pair: *{symbol1}-{symbol2}*\n\n"
        f"🛡️ *Conservative:*\n"
        f"• Smaller trades (5% per trade)\n"
        f"• Lower risk, steady growth\n"
        f"• Best for beginners\n"
        f"• Max trade: $20\n\n"
        f"⚡ *Aggressive:*\n"
        f"• Larger trades (20% per trade)\n"
        f"• Higher risk, bigger profits\n"
        f"• For experienced traders\n"
        f"• Max trade: $100\n\n"
        f"What fits your style?",
        reply_markup=InlineKeyboardMarkup(keyboard),
        parse_mode='Markdown'
    )
    return RISK

async def handle_risk(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle risk selection"""
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
        f"📊 *Trade Size Setting*\n\n"
        f"Current: You'll trade *{trade_pct*100:.1f}%* of your balance each time\n\n"
        f"*What this means:*\n"
        f"• If you have $1,000 → Each trade uses ${1000*trade_pct:.0f}\n"
        f"• If you have $500 → Each trade uses ${500*trade_pct:.0f}\n\n"
        f"*Example:*\n"
        f"You have 100 tgUSDC. When price drops 5%, bot buys ${100*trade_pct:.0f} worth of tgMetis.\n\n"
        f"Is *{trade_pct*100:.1f}%* right for you?\n"
        f"✅ Yes = Lock it in\n"
        f"📉 Less = More cautious\n"
        f"📈 More = More aggressive",
        reply_markup=InlineKeyboardMarkup(keyboard),
        parse_mode='Markdown'
    )
    return TRADE_PERCENTAGE_CONFIRM

async def handle_trade_percentage(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle trade percentage adjustment"""
    query = update.callback_query
    await query.answer()

    if query.data != "trade_agree":
        current = context.user_data["trade_percentage"]
        factor = 0.8 if query.data == "trade_less" else 1.2
        new_trade_percentage = round_to_one_decimal(max(0.01, min(1.0, current * factor)))

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
                f"Trade percentage is now *{trade_pct*100:.1f}%*\n\n"
                f"*What this means:*\n"
                f"• If you have $1,000 → Each trade uses ${1000*trade_pct:.0f}\n"
                f"• If you have $500 → Each trade uses ${500*trade_pct:.0f}\n\n"
                f"Is *{trade_pct*100:.1f}%* good for you?",
                reply_markup=InlineKeyboardMarkup(keyboard),
                parse_mode='Markdown'
            )
        return TRADE_PERCENTAGE_CONFIRM
    
    trigger_pct = context.user_data["trigger_percentage"]
    keyboard = [
        [InlineKeyboardButton("✅ Yes, I agree", callback_data="trigger_agree")],
        [InlineKeyboardButton("📉 Less (-20%)", callback_data="trigger_less")],
        [InlineKeyboardButton("📈 More (+20%)", callback_data="trigger_more")]
    ]
    await query.edit_message_text(
        f"🎯 *Price Trigger Setting*\n\n"
        f"Current: Bot trades when price moves *{trigger_pct*100:.1f}%*\n\n"
        f"*What this means:*\n"
        f"• Price drops {trigger_pct*100:.1f}% → Bot BUYS\n"
        f"• Price rises {trigger_pct*100:.1f}% → Bot SELLS\n\n"
        f"*Example:*\n"
        f"tgMetis is $100\n"
        f"• Drops to ${100*(1-trigger_pct):.0f} → Bot buys\n"
        f"• Rises to ${100*(1+trigger_pct):.0f} → Bot sells\n\n"
        f"*Think about it:*\n"
        f"• Lower % = More trades, more active\n"
        f"• Higher % = Fewer trades, bigger moves\n\n"
        f"Is *{trigger_pct*100:.1f}%* good for you?", 
        reply_markup=InlineKeyboardMarkup(keyboard), 
        parse_mode='Markdown'
    )
    return TRIGGER_PERCENTAGE_CONFIRM

async def handle_trigger_percentage(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle trigger percentage adjustment"""
    query = update.callback_query
    await query.answer()

    if query.data != "trigger_agree":
        current = context.user_data["trigger_percentage"]
        factor = 0.8 if query.data == "trigger_less" else 1.2
        new_trigger_percentage = round_to_one_decimal(max(0.001, min(0.3, current * factor)))

        if new_trigger_percentage != current:
            context.user_data["trigger_percentage"] = new_trigger_percentage
            trigger_pct = context.user_data["trigger_percentage"]
            keyboard = [
                [InlineKeyboardButton("✅ Yes, I agree", callback_data="trigger_agree")],
                [InlineKeyboardButton("📉 Less (-20%)", callback_data="trigger_less")],
                [InlineKeyboardButton("📈 More (+20%)", callback_data="trigger_more")]
            ]
            await query.edit_message_text(
                f"🎯 *Updated Trigger*\n\n"
                f"Trigger is now *{trigger_pct*100:.1f}%*\n\n"
                f"*Example:*\n"
                f"tgMetis at $100\n"
                f"• Drops to ${100*(1-trigger_pct):.0f} → Bot buys\n"
                f"• Rises to ${100*(1+trigger_pct):.0f} → Bot sells\n\n"
                f"Is this good?", 
                reply_markup=InlineKeyboardMarkup(keyboard), 
                parse_mode='Markdown'
            )
        return TRIGGER_PERCENTAGE_CONFIRM

    max_amount = context.user_data["max_amount"]
    keyboard = [
        [InlineKeyboardButton("✅ Yes, I agree", callback_data="max_agree")],
        [InlineKeyboardButton("📉 Less (-20%)", callback_data="max_less")],
        [InlineKeyboardButton("📈 More (+20%)", callback_data="max_more")]
    ]
    await query.edit_message_text(
        f"💰 *Safety Limit Setting*\n\n"
        f"Current: No single trade exceeds *${max_amount:.1f}*\n\n"
        f"*This protects you from:*\n"
        f"• Accidentally huge trades\n"
        f"• Strategy errors\n"
        f"• Market manipulation\n\n"
        f"*Example:*\n"
        f"Even if your 5% rule says trade $100, the bot will only trade up to ${max_amount:.1f} max.\n\n"
        f"This is your safety net!\n\n"
        f"Is *${max_amount:.1f}* the right limit?", 
        reply_markup=InlineKeyboardMarkup(keyboard), 
        parse_mode='Markdown'
    )
    return MAX_AMOUNT_CONFIRM

async def handle_max_amount(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle max amount adjustment"""
    query = update.callback_query
    await query.answer()

    if query.data != "max_agree":
        current = context.user_data["max_amount"]
        factor = 0.8 if query.data == "max_less" else 1.2
        new_max_amount = round_to_one_decimal(max(1.0, min(1000.0, current * factor)))
        
        if new_max_amount != current:
            context.user_data["max_amount"] = new_max_amount
            max_amount = context.user_data["max_amount"]
            keyboard = [
                [InlineKeyboardButton("✅ Yes, I agree", callback_data="max_agree")],
                [InlineKeyboardButton("📉 Less (-20%)", callback_data="max_less")],
                [InlineKeyboardButton("📈 More (+20%)", callback_data="max_more")]
            ]
            await query.edit_message_text(
                f"💰 *Updated Max Amount*\n\n"
                f"Max amount is now *${max_amount:.1f}*\n\n"
                f"This is your safety limit per trade.\n\n"
                f"Is this good?", 
                reply_markup=InlineKeyboardMarkup(keyboard), 
                parse_mode='Markdown'
            )
        return MAX_AMOUNT_CONFIRM
    
    config_summary = (
        f"🎉 *Strategy Ready to Launch!*\n\n"
        f"📋 *Your Trading Rules:*\n"
        f"━━━━━━━━━━━━━━━━\n"
        f"💱 Pair: *{context.user_data['symbol1']}-{context.user_data['symbol2']}*\n"
        f"📊 Trade Size: *{context.user_data['trade_percentage']*100:.1f}%* per trade\n"
        f"🎯 Trigger: *±{context.user_data['trigger_percentage']*100:.1f}%* price move\n"
        f"💰 Safety Limit: *${context.user_data['max_amount']:.1f}* max\n"
        f"━━━━━━━━━━━━━━━━\n\n"
        f"*What happens next:*\n"
        f"✅ AI monitors prices 24/7\n"
        f"✅ Trades automatically on your rules\n"
        f"✅ You get notifications on trades\n"
        f"✅ Check anytime with /balance\n\n"
        f"Ready to go live?\n"
        f"Click ✅ Confirm to activate!"
    )
    keyboard = [[InlineKeyboardButton("✅ Confirm & Save Strategy", callback_data="final_confirm")]]
    await query.edit_message_text(config_summary, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='Markdown')
    return FINALIZE

async def finalize_config(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Finalize and save configuration"""
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
        f"🚀 *Strategy Activated!*\n\n"
        f"Your AI trading bot is now LIVE for *{final_config['symbol1']}-{final_config['symbol2']}*!\n\n"
        f"✅ *What's Happening:*\n"
        f"• AI is watching the market 24/7\n"
        f"• Will trade automatically on your rules\n"
        f"• You'll get updates on each trade\n\n"
        f"*Monitor Your Bot:*\n"
        f"💰 /balance - Check funds\n"
        f"📈 /chart - See performance\n"
        f"📋 /myconfig - View settings\n"
        f"🗑️ /deleteconfig - Stop trading\n\n"
        f"💡 *Pro Tip:*\n"
        f"Let it run for at least 24 hours to see results. The best trades often happen when you're sleeping!\n\n"
        f"Good luck, trader! 🎯",
        parse_mode='Markdown'
    )
    context.user_data.clear()
    return ConversationHandler.END

async def my_config(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show user's configurations"""
    user_id = str(update.effective_user.id)
    if user_id not in load_users()["users"]:
        await update.message.reply_text("Please register with /start first.")
        return

    user_configs = [entry for entry in load_config().get("trading_pairs", []) if str(entry.get("userID")) == user_id]

    if not user_configs:
        await update.message.reply_text(
            "🤷 *No Active Strategies*\n\n"
            "You haven't set up any trading bots yet!\n\n"
            "*To start automated trading:*\n"
            "1️⃣ Use /config\n"
            "2️⃣ Choose a trading pair\n"
            "3️⃣ Set your risk level\n"
            "4️⃣ Let AI do the work!\n\n"
            "Why wait? Set up your first strategy now! 🚀\n\n"
            "Use /config to begin",
            parse_mode='Markdown'
        )
        return

    for idx, entry in enumerate(user_configs, 1):
        config_text = (
            f"📊 *Your Active Trading Strategies*\n\n"
            f"*Strategy #{idx}: {entry['symbol1']}-{entry['symbol2']}*\n"
            f"━━━━━━━━━━━━━━━━\n"
            f"📈 Trade Size: *{entry['trade_percentage']*100:.1f}%* per trade\n"
            f"🎯 Price Trigger: *±{entry['trigger_percentage']*100:.1f}%*\n"
            f"💰 Max Trade: *${entry['max_amount']:.1f}*\n"
            f"⚡ Status: ACTIVE 🟢\n"
            f"━━━━━━━━━━━━━━━━\n\n"
            f"*Performance:*\n"
            f"📊 Trades executed: Check /chart\n"
            f"💹 Win rate: Check /chart\n"
            f"📈 Profit: Check /chart\n\n"
            f"*Manage Strategy:*\n"
            f"⚙️ /config - Add another pair\n"
            f"🗑️ /deleteconfig - Remove strategy"
        )
        await update.message.reply_text(config_text, parse_mode='Markdown')

async def delete_config_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Start delete configuration"""
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
        "🗑️ *Select Configuration to Delete*",
        reply_markup=InlineKeyboardMarkup(keyboard),
        parse_mode='Markdown'
    )
    return SELECT_CONFIG_TO_DELETE

async def handle_config_deletion_selection(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle deletion selection"""
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
        f"⚠️ *Are you sure?*\n\nDelete **{symbol1}-{symbol2}** configuration?",
        reply_markup=InlineKeyboardMarkup(keyboard),
        parse_mode='Markdown'
    )
    return CONFIRM_DELETE

async def handle_final_delete_confirmation(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle final delete confirmation"""
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
                await query.edit_message_text(f"✅ Configuration for **{symbol1}-{symbol2}** deleted.", parse_mode='Markdown')
            else:
                await query.edit_message_text(f"❌ Could not find configuration.", parse_mode='Markdown')
    else:
        await query.edit_message_text("👍 Deletion cancelled.")
        
    context.user_data.clear()
    return ConversationHandler.END

async def cancel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Cancel conversation"""
    await update.message.reply_text("Action cancelled.")
    context.user_data.clear()
    return ConversationHandler.END



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




# --- Bot Setup ---

async def setup_commands(app):
    """Set up bot commands"""
    commands = [
        BotCommand("start", "🚀 Register with LazaiTrader"),
        BotCommand("wallet", "📋 Show wallet addresses"),
        BotCommand("balance", "💰 Check balances"),
        BotCommand("withdraw", "💸 Withdraw funds"),
        BotCommand("config", "⚙️ Configure strategy"),
        BotCommand("myconfig", "📊 View strategies"),
        BotCommand("deleteconfig", "🗑️ Delete strategy"),
        BotCommand("chart", "📈 View trade history"),
        BotCommand("contribute", "📈 Share your trading data for analysis"),
        BotCommand("suggestion", "🔮 Get strategy suggestions based on collective data"),
        BotCommand("cancel", "❌ Cancel operation")
    ]
    await app.bot.set_my_commands(commands)

async def post_init(app):
    await setup_commands(app)

def main():
    """Main function"""
    if not bot_token:
        print("Error: TELEGRAM_BOT_TOKEN not found")
        return

    app = ApplicationBuilder().token(bot_token).post_init(post_init).build()
    
    # Registration conversation
    registration_conv = ConversationHandler(
        entry_points=[CommandHandler("start", start)],
        states={
            WAITING_FOR_WALLET: [MessageHandler(filters.TEXT & ~filters.COMMAND, handle_wallet_address)],
        },
        fallbacks=[CommandHandler("cancel", cancel)],
        per_message=False,
    )
    
    # Config conversation
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

    # Delete config conversation
    delete_conv = ConversationHandler(
        entry_points=[CommandHandler("deleteconfig", delete_config_start)],
        states={
            SELECT_CONFIG_TO_DELETE: [CallbackQueryHandler(handle_config_deletion_selection)],
            CONFIRM_DELETE: [CallbackQueryHandler(handle_final_delete_confirmation)],
        },
        fallbacks=[CommandHandler("cancel", cancel)],
        per_message=False,
    )

    # Add handlers
    app.add_handler(registration_conv)
    app.add_handler(config_conv)
    app.add_handler(delete_conv)
    app.add_handler(CommandHandler("wallet", wallet))
    app.add_handler(CommandHandler("balance", balance))
    app.add_handler(CommandHandler("withdraw", withdraw))
    app.add_handler(CommandHandler("myconfig", my_config))
    app.add_handler(CommandHandler("chart", chart_command))
    app.add_handler(CommandHandler("contribute", data_contribution))
    app.add_handler(CommandHandler("suggestion", get_suggestion))
    
    print("✅ LazaiTrader bot (Non-Custodial SCW) is running...")
    app.run_polling()

if __name__ == "__main__":
    main()
