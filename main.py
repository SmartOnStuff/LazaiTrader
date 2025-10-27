'''
version 0.2 - Smart Contract Wallet enabled Non-custodial wallet management 
'''
import csv, os, time, json, requests
import logging
from datetime import datetime
from web3 import Web3
from dotenv import load_dotenv
from functools import wraps

# Load environment variables from .env file
load_dotenv()

# ─── CONFIGURATION ────────────────────────────────────────────────────────
RPC_URL = os.getenv('RPC_URL', "https://hyperion-testnet.metisdevops.link")
CHAIN_ID = int(os.getenv('CHAIN_ID', 133717))
ORACLE_OWNER_PK = os.getenv('ORACLE_OWNER_PK')
TELEGRAM_BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN')
PRODUCTION = os.getenv('PRODUCTION', '0') == '1'
BOT_PRIVATE_KEY = os.getenv('BOT_WALLET_PRIVATE_KEY')

# API endpoints
DEXSCREENER_API = os.getenv('DEXSCREENER_API', "https://api.dexscreener.com/latest/dex/pairs/metis/0xb7af89d7fe88d4fa3c9b338a0063359196245eaa")
COINGECKO_API = os.getenv('COINGECKO_API', "https://api.coingecko.com/api/v3/simple/price")

# Configuration files (moved to 'config' directory)
CONFIG_FILE = 'config/config.json'
TOKENS_FILE = 'config/tokens.json'
#WALLETS_FILE = 'config/wallets.json' ||| depricated
USERS_FILE = 'config/users.json'

# Create logs directory
os.makedirs('logs', exist_ok=True)

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

DEX_ABI = json.loads("""[
  {"inputs":[{"name":"_gmetisToUSDC","type":"uint256"},{"name":"_usdcTogMetis","type":"uint256"}],
   "name":"setPrices","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"name":"tokenInAddr","type":"address"},{"name":"amountIn","type":"uint256"}],
   "name":"swap","outputs":[],"stateMutability":"nonpayable","type":"function"}
]""")

SCW_ABI = [
    {
        "inputs": [
            {"name": "_dex", "type": "address"},
            {"name": "_data", "type": "bytes"}
        ],
        "name": "executeTrade",
        "outputs": [
            {"name": "success", "type": "bool"},
            {"name": "returnData", "type": "bytes"}
        ],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {"name": "_token", "type": "address"},
            {"name": "_dex", "type": "address"},
            {"name": "_amount", "type": "uint256"}
        ],
        "name": "approveToken",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{"name": "_token", "type": "address"}],
        "name": "getTokenBalance",
        "outputs": [{"name": "balance", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "getNativeBalance",
        "outputs": [{"name": "balance", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "owner",
        "outputs": [{"name": "", "type": "address"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "botOperator",
        "outputs": [{"name": "", "type": "address"}],
        "stateMutability": "view",
        "type": "function"
    }
]
# Global caches to avoid repeated lookups
token_contracts_cache = {}
user_data_cache = {}
price_cache = {}
tokens_config_cache = None

global_price_data = {}

class PriceCache:
    def __init__(self, ttl_seconds=60):
        self.cache = {}
        self.ttl = ttl_seconds
    
    def get_price(self, symbol):
        now = time.time()
        if symbol in self.cache:
            price, timestamp = self.cache[symbol]
            if now - timestamp < self.ttl:
                return price
        return None
    
    def set_price(self, symbol, price):
        self.cache[symbol] = (price, time.time())

price_cache_instance = PriceCache()

def rate_limit(calls_per_second=5):
    """Rate limiting decorator to prevent RPC abuse."""
    min_interval = 1.0 / calls_per_second
    last_called = [0.0]
    
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            elapsed = time.time() - last_called[0]
            left_to_wait = min_interval - elapsed
            if left_to_wait > 0:
                time.sleep(left_to_wait)
            ret = func(*args, **kwargs)
            last_called[0] = time.time()
            return ret
        return wrapper
    return decorator

def get_bot_account(w3):
    """
    Load bot operator account (singleton across all users)
    Call this once during initialization or cache it
    """
    if not BOT_PRIVATE_KEY:
        raise Exception("BOT_PRIVATE_KEY not configured!")
    
    bot_account = w3.eth.account.from_key(BOT_PRIVATE_KEY)
    return bot_account

def setup_logging():
    """Setup logging for main operations and errors."""
    # Main log for successful operations
    main_logger = logging.getLogger('main')
    main_logger.setLevel(logging.INFO)
    main_handler = logging.FileHandler('logs/trading_main.log')
    main_formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
    main_handler.setFormatter(main_formatter)
    main_logger.addHandler(main_handler)
    
    # Error log for failures
    error_logger = logging.getLogger('errors')
    error_logger.setLevel(logging.ERROR)
    error_handler = logging.FileHandler('logs/trading_errors.log')
    error_formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
    error_handler.setFormatter(error_formatter)
    error_logger.addHandler(error_handler)
    
    return main_logger, error_logger

def load_json_file(filepath):
    """Load and validate JSON configuration files."""
    try:
        with open(filepath, 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        error_logger.error(f"Configuration file {filepath} not found")
        return None
    except json.JSONDecodeError as e:
        error_logger.error(f"Invalid JSON in {filepath}: {e}")
        return None

def load_tokens_config():
    """Load tokens configuration with caching."""
    global tokens_config_cache
    if tokens_config_cache is None:
        tokens_config_cache = load_json_file(TOKENS_FILE)
    return tokens_config_cache

def get_token_info(symbol):
    """Get token address and decimals from tokens.json with caching and checksum conversion."""
    if symbol in token_contracts_cache:
        return token_contracts_cache[symbol]
    
    tokens_data = load_tokens_config()
    if not tokens_data or symbol not in tokens_data.get('tokens', {}):
        error_logger.error(f"Token {symbol} not found in tokens.json")
        return None
    
    token_info = tokens_data['tokens'][symbol].copy()  # Create a copy to avoid modifying original
    
    # Convert address to checksum format
    try:
        token_info['address'] = Web3.to_checksum_address(token_info['address'])
    except Exception as e:
        error_logger.error(f"Invalid address format for token {symbol}: {e}")
        return None
    
    token_contracts_cache[symbol] = token_info
    return token_info

def get_pair_info(symbol1, symbol2):
    """Get trading pair information from tokens.json."""
    tokens_data = load_tokens_config()
    if not tokens_data or 'pairs' not in tokens_data:
        error_logger.error("No pairs configuration found in tokens.json")
        return None
    
    pair_key = f"{symbol1}-{symbol2}"
    if pair_key in tokens_data['pairs']:
        pair_info = tokens_data['pairs'][pair_key].copy()
        # Convert DEX address to checksum format
        try:
            pair_info['dex_address'] = Web3.to_checksum_address(pair_info['dex_address'])
        except Exception as e:
            error_logger.error(f"Invalid DEX address format for pair {pair_key}: {e}")
            return None
        return pair_info
    
    error_logger.error(f"Pair {pair_key} not found in tokens.json")
    return None

def get_user_data(user_id):
    """Get user SCW address and EOA from users.json with caching and checksum conversion."""
    if user_id in user_data_cache:
        return user_data_cache[user_id]
    
    # Load user mapping
    users_data = load_json_file(USERS_FILE)
    if not users_data or user_id not in users_data['users']:
        error_logger.error(f"User {user_id} not found in users.json")
        return None
    
    user_info = users_data['users'][user_id]
    
    # Get SCW address
    scw_address = user_info.get('scw_address')
    if not scw_address:
        error_logger.error(f"No SCW address found for user {user_id}")
        return None
    
    # Get user's EOA (owner address)
    user_wallet = user_info.get('user_wallet')
    if not user_wallet:
        error_logger.error(f"No user_wallet found for user {user_id}")
        return None
    
    # Convert addresses to checksum format
    try:
        scw_address = Web3.to_checksum_address(scw_address)
        user_wallet = Web3.to_checksum_address(user_wallet)
    except Exception as e:
        error_logger.error(f"Invalid address format for user {user_id}: {e}")
        return None
    
    # Structure with SCW data
    user_data = {
        'scw_address': scw_address,           # User's Smart Contract Wallet
        'user_wallet': user_wallet,           # User's EOA (owner)
        'username': user_info.get('username', 'unknown'),
        'telegram_chat_id': user_info.get('telegram_chat_id', '')
    }
    
    user_data_cache[user_id] = user_data
    return user_data

def send_telegram_message(message, chat_id):
    """Send message to specific Telegram chat."""
    if not TELEGRAM_BOT_TOKEN or not chat_id:
        # Silently skip if credentials not configured
        return False
    
    try:
        url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
        data = {
            'chat_id': chat_id,
            'text': message,
            'parse_mode': 'HTML'
        }
        response = requests.post(url, data=data, timeout=10)
        response.raise_for_status()
        return True
    except Exception as e:
        # Silently handle Telegram failures without logging to error log
        # You could optionally log to main log if you want some record:
        main_logger.warning(f"Telegram notification failed (non-critical): {e}")
        return False

@rate_limit(calls_per_second=3)
def fetch_prices_from_dexscreener(pair_key):
    """Fetch current prices from DexScreener API and calculate contract prices."""
    global global_price_data
    
    # Return cached data if available
    if pair_key in global_price_data:
        return global_price_data[pair_key]
    
    pair_info = get_pair_info(*pair_key.split('-'))
    if not pair_info or pair_info.get('price_source') != 'dexscreener':
        error_logger.error(f"DexScreener not configured for pair {pair_key}")
        return None, None, None
    
    try:
        res = requests.get(pair_info['price_api'], timeout=10)
        res.raise_for_status()
        data = res.json()
        price_usdc = float(data['pair']['priceUsd'])
        
        # Both tokens are 18 decimals, contract expects 1e18 scaling for price ratios
        price_base_to_quote = int(price_usdc * 1e18)  # Contract expects 1e18 scaling
        price_quote_to_base = int((1 / price_usdc) * 1e18)  # Contract expects 1e18 scaling

        main_logger.info(f"Fetched price from DexScreener for {pair_key}: ${price_usdc:.10f}")
        
        # Cache the result globally
        global_price_data[pair_key] = (price_base_to_quote, price_quote_to_base, price_usdc)
        return global_price_data[pair_key]
        
    except Exception as e:
        error_logger.error(f"Failed to fetch prices from DexScreener for {pair_key}: {e}")
        return None, None, None

@rate_limit(calls_per_second=3)
def fetch_prices_from_coingecko(pair_key):
    """Fetch current prices from CoinGecko API."""
    global global_price_data
    
    # Return cached data if available
    if pair_key in global_price_data:
        return global_price_data[pair_key]
    
    pair_info = get_pair_info(*pair_key.split('-'))
    if not pair_info or pair_info.get('price_source') != 'coingecko':
        error_logger.error(f"CoinGecko not configured for pair {pair_key}")
        return None, None, None
    
    try:
        # For ETH-USDC, fetch ETH price in USD
        res = requests.get(pair_info['price_api'], timeout=10)
        res.raise_for_status()
        data = res.json()
        price_usdc = float(data['ethereum']['usd'])
        
        # Both tokens are 18 decimals, contract expects 1e18 scaling for price ratios
        price_base_to_quote = int(price_usdc * 1e18)
        price_quote_to_base = int((1 / price_usdc) * 1e18)

        main_logger.info(f"Fetched price from CoinGecko for {pair_key}: ${price_usdc:.10f}")
        
        # Cache the result globally
        global_price_data[pair_key] = (price_base_to_quote, price_quote_to_base, price_usdc)
        return global_price_data[pair_key]
        
    except Exception as e:
        error_logger.error(f"Failed to fetch prices from CoinGecko for {pair_key}: {e}")
        return None, None, None

def reset_price_cache():
    """Reset global price cache for new script run."""
    global global_price_data
    global_price_data = {}

@rate_limit(calls_per_second=3)
def update_oracle_prices(w3, base_asset, quote_asset, price_base_to_quote, price_quote_to_base):
    """Update DEX oracle prices using owner account with checksum address handling."""
    try:
        owner = w3.eth.account.from_key(ORACLE_OWNER_PK)
        
        # Get DEX address for this specific pair
        pair_info = get_pair_info(base_asset, quote_asset)
        if not pair_info:
            error_logger.error(f"No DEX configuration found for {base_asset}-{quote_asset}")
            return False
        
        dex_address = pair_info['dex_address']
        dex = w3.eth.contract(address=dex_address, abi=DEX_ABI)
        
        nonce = w3.eth.get_transaction_count(owner.address)
        tx = dex.functions.setPrices(price_base_to_quote, price_quote_to_base).build_transaction({
            "chainId": CHAIN_ID,
            "from": owner.address,
            "nonce": nonce,
            "gas": 200_000,
            "gasPrice": w3.to_wei("5", "gwei")
        })
        
        if PRODUCTION:
            signed = owner.sign_transaction(tx)
            tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
            receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
            main_logger.info(f"Oracle prices updated for {base_asset}-{quote_asset}: {receipt.transactionHash.hex()}")
        else:
            main_logger.info(f"SIMULATION: Oracle prices would be updated for {base_asset}-{quote_asset}")
        
        return True
    except Exception as e:
        error_logger.error(f"Failed to update oracle prices for {base_asset}-{quote_asset}: {e}")
        return False

def get_pair_symbol(base_asset, quote_asset):
    """Construct trading pair symbol from base and quote assets."""
    return f"{base_asset}_{quote_asset}"

def get_price(base_asset, quote_asset):
    """Return (date_str, time_str, price) for given trading pair."""
    try:
        symbol = get_pair_symbol(base_asset, quote_asset)
        
        # Check cache first
        cached_price = price_cache_instance.get_price(symbol)
        if cached_price is not None:
            return time.strftime("%y%m%d"), time.strftime("%H%M%S"), cached_price
        
        # Get pair configuration
        pair_key = f"{base_asset}-{quote_asset}"
        pair_info = get_pair_info(base_asset, quote_asset)
        if not pair_info:
            raise Exception(f"No configuration found for pair {pair_key}")
        
        # Fetch price based on configured source
        if pair_info['price_source'] == 'dexscreener':
            _, _, price_usd = fetch_prices_from_dexscreener(pair_key)
        elif pair_info['price_source'] == 'coingecko':
            _, _, price_usd = fetch_prices_from_coingecko(pair_key)
        else:
            raise Exception(f"Unsupported price source: {pair_info['price_source']}")
        
        if price_usd is None:
            raise Exception(f"Failed to fetch price from {pair_info['price_source']}")
        
        # Return price based on direction
        if base_asset in ["tgMetis", "tgETH"]:
            price = price_usd  # Base asset price in USD (treating quote as USD)
        else:
            price = 1.0 / price_usd  # Quote asset price in base terms
        
        price_cache_instance.set_price(symbol, price)
        return time.strftime("%y%m%d"), time.strftime("%H%M%S"), price
            
    except Exception as e:
        raise Exception(f"Failed to get price for {base_asset}/{quote_asset}: {e}")


@rate_limit(calls_per_second=5)
def get_balances(w3, base_asset, quote_asset, scw_address):
    """Get token balances from user's SCW."""
    try:
        base_token_info = get_token_info(base_asset)
        quote_token_info = get_token_info(quote_asset)
        
        # Load SCW contract
        scw_contract = w3.eth.contract(
            address=Web3.to_checksum_address(scw_address),
            abi=SCW_ABI
        )
        
        # Get balances from SCW
        base_balance_raw = scw_contract.functions.getTokenBalance(
            Web3.to_checksum_address(base_token_info['address'])
        ).call()
        
        quote_balance_raw = scw_contract.functions.getTokenBalance(
            Web3.to_checksum_address(quote_token_info['address'])
        ).call()
        
        base_balance = base_balance_raw / (10 ** base_token_info['decimals'])
        quote_balance = quote_balance_raw / (10 ** quote_token_info['decimals'])
        
        return base_balance, quote_balance
        
    except Exception as e:
        error_logger.error(f"Failed to get SCW balances: {e}")
        return 0, 0


def calculate_total_balance_usd(base_asset, quote_asset, base_balance, quote_balance, current_price):
    """Calculate total balance in USD using token decimals from configuration."""
    try:
        if base_asset in ["tgMetis", "tgETH"] and quote_asset == "tgUSDC":
            # Base asset value in USD (current_price is base price in USD)
            base_value_usd = base_balance * current_price
            # tgUSDC is pegged to USD (1:1)
            quote_value_usd = quote_balance
            # Return individual USD prices for logging
            return base_value_usd + quote_value_usd, current_price, 1.0
        elif base_asset == "tgUSDC" and quote_asset in ["tgMetis", "tgETH"]:
            # tgUSDC is pegged to USD (1:1)  
            base_value_usd = base_balance
            # Quote asset value in USD (1/current_price since current_price is tgUSDC/quote)
            quote_value_usd = quote_balance * (1.0 / current_price)
            return base_value_usd + quote_value_usd, 1.0, (1.0 / current_price)
        else:
            # For other pairs, implement appropriate conversion
            base_value_usd = 0.0
            quote_value_usd = 0.0
            return base_value_usd + quote_value_usd, 0.0, 0.0
    except Exception as e:
        error_logger.error(f"Error calculating total balance for {base_asset}/{quote_asset}: {e}")
        return 0.0, 0.0, 0.0

def get_last_id(file_path):
    """Return next ID (1-based) by scanning existing CSV, zero-pad to 6 digits."""
    if not os.path.isfile(file_path):
        return 1
    try:
        with open(file_path, "r", newline="") as f:
            rows = list(csv.reader(f))
        if len(rows) < 2:
            return 1
        return int(rows[-1][0]) + 1
    except (ValueError, IndexError):
        return 1

def store_price(base_asset, quote_asset, date_str, time_str, price, base_flag, user_id):
    """Append to BASE_QUOTE_USERID.csv: ID,Date,Time,Price,Base."""
    fn = f"logs/{base_asset}_{quote_asset}_{user_id}.csv"
    row_id = get_last_id(fn)
    row = [f"{row_id:06d}", date_str, time_str, f"{price:.10f}", base_flag]
    is_new = not os.path.isfile(fn)

    with open(fn, "a", newline="") as f:
        w = csv.writer(f)
        if is_new:
            w.writerow(["ID", "Date", "Time", "Price", "Base"])
        w.writerow(row)

def get_base_price(base_asset, quote_asset, user_id):
    """Return the last logged Base price, or None if none yet."""
    fn = f"logs/{base_asset}_{quote_asset}_{user_id}.csv"
    if not os.path.isfile(fn):
        return None

    try:
        with open(fn, "r", newline="") as f:
            rows = list(csv.reader(f))
        base_rows = [r for r in rows[1:] if len(r) > 4 and r[4] == "1"]
        if not base_rows:
            return None
        return float(base_rows[-1][3])
    except (ValueError, IndexError):
        return None

def get_last_trade_action(base_asset, quote_asset, user_id):
    """Get the last trade action and consecutive count for multiplier calculation."""
    fn = f"logs/{base_asset}_{quote_asset}_{user_id}_trades.csv"
    if not os.path.isfile(fn):
        return None, 0
    
    try:
        with open(fn, "r", newline="") as f:
            rows = list(csv.reader(f))
        
        if len(rows) < 2:
            return None, 0
        
        last_row = rows[-1]
        if len(last_row) < 17:  # Updated for new format with tx_hash
            return last_row[4] if len(last_row) > 4 else None, 0
        
        last_action = last_row[4]
        consecutive_count = int(last_row[15])
        
        return last_action, consecutive_count
        
    except (ValueError, IndexError) as e:
        error_logger.error(f"Error reading last trade for {base_asset}/{quote_asset}/{user_id}: {e}")
        return None, 0

def calculate_multiplied_trade_percentage(base_percentage, multiplier, current_action, last_action, last_consecutive_count):
    """Calculate trade percentage with multiplier for consecutive same-direction trades."""
    if last_action == current_action:
        consecutive_count = last_consecutive_count + 1
        multiplied_percentage = base_percentage * (multiplier ** consecutive_count)
        actual_percentage = min(multiplied_percentage, 0.5)  # Cap at 50%
        return actual_percentage, consecutive_count
    else:
        return base_percentage, 0

def log_trade(base_asset, quote_asset, user_id, action, date_str, time_str, price, qty, 
              base_balance, quote_balance, total_balance_usd, base_usd_price, quote_usd_price,
              consecutive_count, actual_trade_percentage, tx_hash="SIMULATION"):
    """Append to BASE_QUOTE_USERID_trades.csv with all trade details including tx_hash."""
    fn = f"logs/{base_asset}_{quote_asset}_{user_id}_trades.csv"
    row_id = get_last_id(fn)
    
    base_value_usd = base_balance * base_usd_price
    quote_value_usd = quote_balance * quote_usd_price
    trade_value_usd = qty * price * quote_usd_price if action == "SELL" else qty * base_usd_price
    
    row = [
        f"{row_id:06d}",
        date_str, time_str, user_id,
        action,
        f"{price:.10f}",
        f"{qty:.10f}",
        f"{base_balance:.10f}",
        f"{quote_balance:.10f}",
        f"{base_usd_price:.10f}",
        f"{quote_usd_price:.10f}",
        f"{base_value_usd:.2f}",
        f"{quote_value_usd:.2f}",
        f"{trade_value_usd:.2f}",
        f"{total_balance_usd:.2f}",
        f"{consecutive_count}",
        f"{actual_trade_percentage:.10f}",
        tx_hash
    ]
    is_new = not os.path.isfile(fn)

    with open(fn, "a", newline="") as f:
        w = csv.writer(f)
        if is_new:
            w.writerow([
                "ID", "Date", "Time", "UserID", "Action",
                "Price", "Quantity",
                f"{base_asset}_Balance", f"{quote_asset}_Balance",
                f"{base_asset}_USD_Price", f"{quote_asset}_USD_Price",
                f"{base_asset}_USD_Value", f"{quote_asset}_USD_Value",
                "Trade_USD_Value", "Total_Balance_USD",
                "Consecutive_Count", "Actual_Trade_Percentage", "TX_Hash"
            ])
        w.writerow(row)

@rate_limit(calls_per_second=2)
def execute_dex_trade(w3, base_asset, quote_asset, action, quantity, user_data):
    """
    Execute trade on DEX through user's SCW using bot operator wallet.
    
    Changes from original:
    - Uses user_data['scw_address'] instead of private_key
    - Bot wallet signs all transactions
    - Calls SCW's executeTrade() and approveToken() functions
    - Gas paid by bot operator
    """
    try:
        base_token_info = get_token_info(base_asset)
        quote_token_info = get_token_info(quote_asset)
        
        # Get bot account (signs all transactions)
        bot_account = get_bot_account(w3)
        
        # Get user's SCW address
        scw_address = user_data.get('scw_address')
        if not scw_address:
            raise Exception(f"No SCW address found for user {user_data.get('telegram_chat_id')}")
        
        # Load SCW contract
        scw_contract = w3.eth.contract(
            address=Web3.to_checksum_address(scw_address),
            abi=SCW_ABI
        )
        
        # Get DEX address for this specific pair
        pair_info = get_pair_info(base_asset, quote_asset)
        if not pair_info:
            raise Exception(f"No DEX configuration found for {base_asset}-{quote_asset}")
        
        dex_address = pair_info['dex_address']
        
        # Determine swap direction and amounts
        if action == "BUY":
            # Buying base asset with quote asset
            _, _, current_price = get_price(base_asset, quote_asset)
            quote_amount_needed = quantity * current_price
            
            token_in_info = quote_token_info
            token_out_info = base_token_info
            amount_in = int(quote_amount_needed * (10 ** quote_token_info['decimals']))
        else:  # SELL
            # Selling base asset for quote asset
            token_in_info = base_token_info
            token_out_info = quote_token_info
            amount_in = int(quantity * (10 ** base_token_info['decimals']))
        
        # Load DEX contract (for encoding swap call)
        dex_contract = w3.eth.contract(address=dex_address, abi=DEX_ABI)
        
        if not PRODUCTION:
            return {
                "status": "SIMULATION",
                "action": action,
                "quantity": quantity,
                "token_in": token_in_info['symbol'],
                "token_out": token_out_info['symbol'],
                "scw_address": scw_address,
                "tx_hash": "SIMULATION"
            }
        
        # ===== STEP 1: Approve token via SCW =====
        main_logger.info(f"Approving {token_in_info['symbol']} for DEX via SCW...")
        
        nonce = w3.eth.get_transaction_count(bot_account.address)
        
        approve_tx = scw_contract.functions.approveToken(
            Web3.to_checksum_address(token_in_info['address']),
            Web3.to_checksum_address(dex_address),
            amount_in  # Approve exact amount (or use max: 2**256-1)
        ).build_transaction({
            "chainId": CHAIN_ID,
            "from": bot_account.address,
            "nonce": nonce,
            "gas": 200_000,
            "gasPrice": w3.to_wei("5", "gwei")
        })
        
        signed_approve = bot_account.sign_transaction(approve_tx)
        approve_hash = w3.eth.send_raw_transaction(signed_approve.raw_transaction)
        approve_receipt = w3.eth.wait_for_transaction_receipt(approve_hash)
        
        if approve_receipt['status'] != 1:
            raise Exception(f"Approval transaction failed: {approve_hash.hex()}")
        
        main_logger.info(f"Approval successful: {approve_hash.hex()}")
        
        # ===== STEP 2: Execute swap via SCW =====
        main_logger.info(f"Executing swap via SCW...")
        
        # Encode the swap function call
        swap_function = dex_contract.functions.swap(
            Web3.to_checksum_address(token_in_info['address']),
            amount_in
        )
        swap_data = swap_function._encode_transaction_data()
        
        # Execute trade through SCW
        nonce = w3.eth.get_transaction_count(bot_account.address)
        
        execute_tx = scw_contract.functions.executeTrade(
            Web3.to_checksum_address(dex_address),
            bytes.fromhex(swap_data[2:])  # Remove '0x' prefix
        ).build_transaction({
            "chainId": CHAIN_ID,
            "from": bot_account.address,
            "nonce": nonce,
            "gas": 500_000,
            "gasPrice": w3.to_wei("5", "gwei")
        })
        
        signed_swap = bot_account.sign_transaction(execute_tx)
        swap_hash = w3.eth.send_raw_transaction(signed_swap.raw_transaction)
        receipt = w3.eth.wait_for_transaction_receipt(swap_hash)
        
        if receipt['status'] != 1:
            raise Exception(f"Swap transaction failed: {swap_hash.hex()}")
        
        tx_hash_hex = receipt.transactionHash.hex()
        main_logger.info(f"DEX trade executed via SCW: {tx_hash_hex}")
        
        return {
            "status": "SUCCESS",
            "tx_hash": tx_hash_hex,
            "scw_address": scw_address,
            "action": action,
            "token_in": token_in_info['symbol'],
            "token_out": token_out_info['symbol']
        }
        
    except Exception as e:
        error_logger.error(f"Failed to execute DEX trade via SCW: {e}")
        raise


# ==================== ADDITIONAL HELPER FUNCTIONS ====================

def get_scw_balance(w3, scw_address, token_address):
    """
    Get token balance from SCW
    Useful for checking balances before trading
    """
    try:
        scw_contract = w3.eth.contract(
            address=Web3.to_checksum_address(scw_address),
            abi=SCW_ABI
        )
        
        balance = scw_contract.functions.getTokenBalance(
            Web3.to_checksum_address(token_address)
        ).call()
        
        return balance
        
    except Exception as e:
        error_logger.error(f"Failed to get SCW balance: {e}")
        return 0


def get_scw_native_balance(w3, scw_address):
    """
    Get native token balance from SCW
    """
    try:
        scw_contract = w3.eth.contract(
            address=Web3.to_checksum_address(scw_address),
            abi=SCW_ABI
        )
        
        balance = scw_contract.functions.getNativeBalance().call()
        return balance
        
    except Exception as e:
        error_logger.error(f"Failed to get SCW native balance: {e}")
        return 0


def verify_scw_setup(w3, scw_address, expected_bot_operator):
    """
    Verify SCW is properly configured
    Call this during user onboarding or system startup
    """
    try:
        scw_contract = w3.eth.contract(
            address=Web3.to_checksum_address(scw_address),
            abi=SCW_ABI
        )
        
        # Verify bot operator
        bot_operator = scw_contract.functions.botOperator().call()
        
        if bot_operator.lower() != expected_bot_operator.lower():
            raise Exception(
                f"SCW bot operator mismatch! "
                f"Expected: {expected_bot_operator}, Got: {bot_operator}"
            )
        
        main_logger.info(f"✅ SCW verified: {scw_address}")
        return True
        
    except Exception as e:
        error_logger.error(f"Failed to verify SCW: {e}")
        return False
    
def calculate_trade_amounts(action, base_balance, quote_balance, price, trade_percentage, 
                          max_amount, minimum_amount, base_usd_price, quote_usd_price):
    """Calculate trade quantity and value, applying limits."""
    if action == "SELL":
        # Selling base asset: quantity is amount of base asset to sell
        qty_from_percentage = base_balance * trade_percentage
        max_qty_allowed = (max_amount / base_usd_price) if max_amount > 0 else float('inf')
        qty = min(qty_from_percentage, max_qty_allowed)
        trade_value_usd = qty * base_usd_price
    else:  # BUY
        # Buying base asset: calculate how much quote asset we can spend, then convert to base quantity
        quote_to_trade = quote_balance * trade_percentage
        quote_max_allowed = (max_amount / quote_usd_price) if max_amount > 0 else float('inf')
        quote_to_trade = min(quote_to_trade, quote_max_allowed)
        
        # Convert quote amount to base quantity using current price
        qty = quote_to_trade / price  # This is the amount of base asset we'll receive
        trade_value_usd = quote_to_trade * quote_usd_price
    
    meets_minimum = trade_value_usd >= minimum_amount
    return qty, trade_value_usd, meets_minimum

def calculate_new_balances(action, base_balance, quote_balance, qty, price):
    """Calculate balances after trade execution."""
    if action == "SELL":
        new_base_balance = base_balance - qty
        new_quote_balance = quote_balance + (qty * price)
    else:  # BUY
        new_base_balance = base_balance + qty
        new_quote_balance = quote_balance - (qty * price)
    
    return new_base_balance, new_quote_balance

def send_trade_notification(user_data, base_asset, quote_asset, action, qty, trade_value_usd, 
                           base_price, current_price, move_pct, new_base_balance, new_quote_balance, 
                           total_balance_usd, date_str, consecutive_count, actual_trade_percentage, tx_hash="SIMULATION"):
    """Send Telegram notification for executed trade."""
    mode_text = "🔴 PRODUCTION" if PRODUCTION else "🟡 SIMULATION"
    direction_emoji = "📉" if action == "BUY" else "📈"
    
    # Add multiplier info if consecutive trades
    multiplier_text = ""
    if consecutive_count > 0:
        multiplier_text = f"\n<b>🔥 Consecutive #{consecutive_count + 1}:</b> {actual_trade_percentage*100:.2f}% trade size"
    
    # Add transaction hash info
    tx_info = f"\n<b>🔗 TX Hash:</b> <code>{tx_hash}</code>" if tx_hash != "SIMULATION" else ""
    
    message = f"""
        {mode_text} TRADE EXECUTED {direction_emoji}

        <b>Pair:</b> {base_asset}/{quote_asset}
        <b>Action:</b> {action} {base_asset}
        <b>Amount:</b> {qty:.10f} {base_asset}
        <b>Trade Value:</b> ${trade_value_usd:.2f}{multiplier_text}{tx_info}

        <b>Base Price:</b> {base_price:.10f} {quote_asset} ({date_str})
        <b>Current Price:</b> {current_price:.10f} {quote_asset}
        <b>Price Change:</b> {move_pct*100:+.2f}%

        <b>Current Balances:</b>
        • {base_asset}: {new_base_balance:.10f}
        • {quote_asset}: {new_quote_balance:.10f}
        • <b>Total USD: ${total_balance_usd:.2f}</b>
        """
    
    chat_id = user_data.get('telegram_chat_id')
    if chat_id:
        send_telegram_message(message, chat_id)

def process_trade_signal(w3, base_asset, quote_asset, user_data, action, date_str, time_str, price, 
                         base_balance, quote_balance, base_trade_percentage, multiplier, max_amount, 
                         minimum_amount, decimal_places, base_price, move_pct, base_usd_price, quote_usd_price):
    """Process a trade signal (BUY or SELL) with multiplier logic and fund checks."""
    
    user_id = user_data.get('username', 'unknown')
    
    # Get last trade info for multiplier calculation
    last_action, last_consecutive_count = get_last_trade_action(base_asset, quote_asset, user_id)
    
    # Calculate actual trade percentage with multiplier
    actual_trade_percentage, consecutive_count = calculate_multiplied_trade_percentage(
        base_trade_percentage, multiplier, action, last_action, last_consecutive_count
    )
    
    # Calculate trade amounts using the multiplied percentage
    qty, trade_value_usd, meets_minimum = calculate_trade_amounts(
        action, base_balance, quote_balance, price, actual_trade_percentage, max_amount, minimum_amount,
        base_usd_price, quote_usd_price
    )

    if not meets_minimum or qty == 0:
        store_price(base_asset, quote_asset, date_str, time_str, price, base_flag=1, user_id=user_id)
        if not meets_minimum:
            reason = f"Trade too small (${trade_value_usd:.2f} < ${minimum_amount})"
        else: # qty is 0, which means balance was 0
            reason = "Insufficient funds in wallet to execute trade"

        message = f"""
        ⚠️ <b>TRIGGER HIT - NO TRADE EXECUTED</b> ⚠️

        <b>Pair:</b> {base_asset}/{quote_asset}
        <b>Action:</b> {action} {base_asset}
        <b>Reason:</b> {reason}
        
        <b>Base Price:</b> {base_price:.10f} {quote_asset} ({date_str})
        <b>Current Price:</b> {price:.10f} {quote_asset}
        <b>Price Change:</b> {move_pct*100:+.2f}%

        <b>Current Balances:</b>
        • {base_asset}: {base_balance:.10f}
        • {quote_asset}: {quote_balance:.10f}
        """
        send_telegram_message(message, user_data.get('telegram_chat_id'))
        main_logger.warning(f"[{base_asset}/{quote_asset}/{user_id}] Trigger hit for {action} but no trade executed due to {reason}.")
        return True # Still return True to indicate processing was successful
    
    # The rest of the function remains the same.
    # If the code reaches this point, a trade will be attempted.

    # Calculate new balances
    new_base_balance, new_quote_balance = calculate_new_balances(action, base_balance, quote_balance, qty, price)
    total_balance_usd, _, _ = calculate_total_balance_usd(base_asset, quote_asset, new_base_balance, new_quote_balance, price)

    # Execute trade
    try:
        order = execute_dex_trade(w3, base_asset, quote_asset, action, qty, user_data)
        tx_hash = order.get("tx_hash", "SIMULATION")
        
        # Log trade with multiplier info and tx_hash, then update base price
        log_trade(base_asset, quote_asset, user_id, action, date_str, time_str, price, qty, 
                  new_base_balance, new_quote_balance, total_balance_usd, base_usd_price, quote_usd_price,
                  consecutive_count, actual_trade_percentage, tx_hash)
        store_price(base_asset, quote_asset, date_str, time_str, price, base_flag=1, user_id=user_id)
        
        # Send notification with multiplier info and tx_hash
        send_trade_notification(user_data, base_asset, quote_asset, action, qty, trade_value_usd, base_price, price, move_pct,
                                new_base_balance, new_quote_balance, total_balance_usd, date_str, consecutive_count, actual_trade_percentage, tx_hash)
        
        action_text = f"{'SOLD' if action == 'SELL' else 'BOUGHT'}" if PRODUCTION else f"SIMULATED {action}"
        multiplier_info = f" (consecutive #{consecutive_count + 1}, {actual_trade_percentage*100:.2f}%)" if consecutive_count > 0 else ""
        main_logger.info(f"[{base_asset}/{quote_asset}/{user_id}] {action_text} {qty:.10f} for ${trade_value_usd:.2f} at {price:.10f}{multiplier_info} -> new base, TX: {tx_hash}")

        return True
        
    except Exception as e:
        error_logger.error(f"[{base_asset}/{quote_asset}/{user_id}] Failed to execute {action} trade: {e}")
        return False


def process_trading_pair(w3, pair_config):
    """Process a single trading pair based on its configuration."""
    base_asset = pair_config['symbol1']
    quote_asset = pair_config['symbol2']
    base_trade_percentage = pair_config['trade_percentage']
    multiplier = pair_config.get('multiplier', 1.1)
    trigger_percentage = pair_config['trigger_percentage']
    max_amount = pair_config.get('max_amount', 0)
    minimum_amount = pair_config.get('minimum_amount', 0)
    decimal_places = pair_config.get('decimal', 6)
    user_id = pair_config['userID']
    
    # Get user data
    user_data = get_user_data(user_id)
    if not user_data:
        error_logger.error(f"Failed to get user data for {user_id}")
        return False
    
    try:
        # Get price data first
        pair_key = f"{base_asset}-{quote_asset}"
        pair_info = get_pair_info(base_asset, quote_asset)
        if not pair_info:
            error_logger.error(f"No pair configuration found for {pair_key}")
            return False
        
        # Fetch prices based on configured source
        if pair_info['price_source'] == 'dexscreener':
            price_base_to_quote, price_quote_to_base, price_usd = fetch_prices_from_dexscreener(pair_key)
        elif pair_info['price_source'] == 'coingecko':
            price_base_to_quote, price_quote_to_base, price_usd = fetch_prices_from_coingecko(pair_key)
        else:
            error_logger.error(f"Unsupported price source: {pair_info['price_source']}")
            return False
        
        if price_base_to_quote is None:
            error_logger.error(f"Failed to fetch prices for {pair_key}")
            return False
        
        date_str, time_str, price = get_price(base_asset, quote_asset)
        base_price = get_base_price(base_asset, quote_asset, user_data.get('username', 'unknown'))

        # If no base yet → set it, no trade
        if base_price is None:
            store_price(base_asset, quote_asset, date_str, time_str, price, base_flag=1, user_id=user_data.get('username', 'unknown'))
            main_logger.info(f"[{base_asset}/{quote_asset}/{user_id}] Base price initialized to {price:.10f}")
            return True

        move_pct = (price - base_price) / base_price
        base_balance, quote_balance = get_balances(w3, base_asset, quote_asset, user_data['scw_address'])
        
        # Calculate USD values
        total_balance_usd, base_usd_price, quote_usd_price = calculate_total_balance_usd(
            base_asset, quote_asset, base_balance, quote_balance, price
        )

        # Check for trade signals - ONLY UPDATE ORACLE IF TRIGGER IS HIT
        if move_pct >= trigger_percentage:
            # Price increased → SELL base asset
            # Update oracle before trade
            update_oracle_prices(w3, base_asset, quote_asset, price_base_to_quote, price_quote_to_base)
            return process_trade_signal(w3, base_asset, quote_asset, user_data, "SELL", date_str, time_str, price, 
                                      base_balance, quote_balance, base_trade_percentage, multiplier, max_amount, minimum_amount, 
                                      decimal_places, base_price, move_pct, base_usd_price, quote_usd_price)
            
        elif move_pct <= -trigger_percentage:
            # Price decreased → BUY base asset
            # Update oracle before trade
            update_oracle_prices(w3, base_asset, quote_asset, price_base_to_quote, price_quote_to_base)
            return process_trade_signal(w3, base_asset, quote_asset, user_data, "BUY", date_str, time_str, price, 
                                      base_balance, quote_balance, base_trade_percentage, multiplier, max_amount, minimum_amount, 
                                      decimal_places, base_price, move_pct, base_usd_price, quote_usd_price)
        else:
            # No trade (within trigger range) - NO ORACLE UPDATE
            store_price(base_asset, quote_asset, date_str, time_str, price, base_flag=0, user_id=user_data.get('username', 'unknown'))
            main_logger.info(f"[{base_asset}/{quote_asset}/{user_id}] No trade. Price logged at {price:.10f}")
            return True

    except Exception as e:
        error_logger.error(f"[{base_asset}/{quote_asset}/{user_id}] Error processing trading pair: {str(e)}")
        return False


def verify_scw_setup(w3, user_data):
    """Verify SCW is properly configured with correct bot operator."""
    try:
        scw_contract = w3.eth.contract(
            address=Web3.to_checksum_address(user_data['scw_address']),
            abi=SCW_ABI
        )
        
        # Get bot operator from SCW
        scw_bot_operator = scw_contract.functions.botOperator().call()
        
        # Get expected bot operator
        bot_account = get_bot_account(w3)
        
        if scw_bot_operator.lower() != bot_account.address.lower():
            error_logger.error(
                f"SCW bot operator mismatch for user {user_data.get('username')}! "
                f"Expected: {bot_account.address}, Got: {scw_bot_operator}"
            )
            return False
        
        main_logger.info(f"✅ SCW verified for user {user_data.get('username')}: {user_data['scw_address']}")
        return True
        
    except Exception as e:
        error_logger.error(f"Failed to verify SCW: {e}")
        return False


def get_scw_token_balance(w3, scw_address, token_address):
    """
    Get specific token balance from SCW.
    Useful for additional balance checks.
    """
    try:
        scw_contract = w3.eth.contract(
            address=Web3.to_checksum_address(scw_address),
            abi=SCW_ABI
        )
        
        balance = scw_contract.functions.getTokenBalance(
            Web3.to_checksum_address(token_address)
        ).call()
        
        return balance
        
    except Exception as e:
        error_logger.error(f"Failed to get SCW token balance: {e}")
        return 0


def get_scw_native_balance(w3, scw_address):
    """Get native token balance from SCW."""
    try:
        scw_contract = w3.eth.contract(
            address=Web3.to_checksum_address(scw_address),
            abi=SCW_ABI
        )
        
        balance = scw_contract.functions.getNativeBalance().call()
        return balance
        
    except Exception as e:
        error_logger.error(f"Failed to get SCW native balance: {e}")
        return 0
    
def validate_trading_pair(pair_config):
    """Validate a trading pair configuration before processing."""
    required_fields = ['symbol1', 'symbol2', 'trade_percentage', 'trigger_percentage', 'userID']
    for field in required_fields:
        if field not in pair_config:
            error_logger.error(f"Missing required field '{field}' in trading pair config")
            return False
    
    # Validate percentage values
    if not (0 < pair_config['trade_percentage'] <= 1):
        error_logger.error(f"Invalid trade_percentage: {pair_config['trade_percentage']}. Must be between 0 and 1")
        return False
    
    if not (0 < pair_config['trigger_percentage'] <= 1):
        error_logger.error(f"Invalid trigger_percentage: {pair_config['trigger_percentage']}. Must be between 0 and 1")
        return False
    
    return True

def load_config():
    """Load trading pairs configuration from JSON file."""
    config_data = load_json_file(CONFIG_FILE)
    if not config_data or 'trading_pairs' not in config_data:
        error_logger.error("No trading pairs found in configuration")
        return []
    
    main_logger.info(f"Loaded configuration for {len(config_data['trading_pairs'])} trading pairs")
    return config_data['trading_pairs']


def validate_and_fix_addresses():
    """Validate and convert all addresses to checksum format at startup."""
    # Validate tokens.json addresses
    tokens_data = load_tokens_config()
    if tokens_data and 'tokens' in tokens_data:
        for symbol, token_info in tokens_data['tokens'].items():
            try:
                checksum_addr = Web3.to_checksum_address(token_info['address'])
                main_logger.info(f"Token {symbol} address validated: {checksum_addr}")
            except Exception as e:
                error_logger.error(f"Invalid address for token {symbol}: {token_info['address']}, error: {e}")
                return False
    
    # Validate pair DEX addresses
    if tokens_data and 'pairs' in tokens_data:
        for pair_key, pair_info in tokens_data['pairs'].items():
            try:
                checksum_addr = Web3.to_checksum_address(pair_info['dex_address'])
                main_logger.info(f"Pair {pair_key} DEX address validated: {checksum_addr}")
            except Exception as e:
                error_logger.error(f"Invalid DEX address for pair {pair_key}: {pair_info['dex_address']}, error: {e}")
                return False
    
    # Validate SCW and user wallet addresses
    users_data = load_json_file(USERS_FILE)
    if users_data and 'users' in users_data:
        for user_id, user_info in users_data['users'].items():
            try:
                # Validate SCW address
                scw_addr = Web3.to_checksum_address(user_info['scw_address'])
                main_logger.info(f"User {user_id} SCW address validated: {scw_addr}")
                
                # Validate user wallet (EOA)
                user_wallet = Web3.to_checksum_address(user_info['user_wallet'])
                main_logger.info(f"User {user_id} user wallet validated: {user_wallet}")
            except Exception as e:
                error_logger.error(f"Invalid addresses for user {user_id}: {e}")
                return False
    
    return True


def main():
    """Main function to process all trading pairs."""
    global main_logger, error_logger
    main_logger, error_logger = setup_logging()
    
    # Reset price cache for this run
    reset_price_cache()
    
    # Validate environment variables
    if not RPC_URL:
        error_logger.error("Missing RPC_URL environment variable")
        print("ERROR: Please set RPC_URL environment variable")
        return

    # Validate and fix all addresses first
    if not validate_and_fix_addresses():
        error_logger.error("Address validation failed")
        print("ERROR: Invalid addresses found in configuration")
        return

    # Initialize Web3 connection
    try:
        w3 = Web3(Web3.HTTPProvider(RPC_URL))
        if not w3.is_connected():
            raise Exception("Failed to connect to RPC")
        main_logger.info(f"Successfully connected to Web3 RPC: {RPC_URL}")
    except Exception as e:
        error_logger.error(f"Failed to connect to Web3: {e}")
        print(f"ERROR: Cannot connect to Web3: {e}")
        return

    # Load configuration
    trading_pairs = load_config()
    if not trading_pairs:
        error_logger.error("No trading pairs loaded from configuration")
        print("ERROR: No trading pairs found in configuration")
        return

    # Validate all trading pairs before processing
    valid_pairs = []
    for pair_config in trading_pairs:
        if validate_trading_pair(pair_config):
            valid_pairs.append(pair_config)
        else:
            error_logger.error(f"Invalid configuration for pair: {pair_config}")

    if not valid_pairs:
        error_logger.error("No valid trading pairs found")
        print("ERROR: No valid trading pairs found")
        return

    mode_text = "PRODUCTION" if PRODUCTION else "SIMULATION"
    main_logger.info(f"Starting DEX trading session in {mode_text} mode with {len(valid_pairs)} pairs")
    
    successful_pairs = 0
    failed_pairs = 0

    # Process each valid trading pair
    for pair_config in valid_pairs:
        base_asset = pair_config.get('symbol1', 'UNKNOWN')
        quote_asset = pair_config.get('symbol2', 'UNKNOWN')
        user_id = pair_config.get('userID', 'UNKNOWN')
        main_logger.info(f"Processing {base_asset}/{quote_asset} for user {user_id}...")
        
        try:
            if process_trading_pair(w3, pair_config):
                successful_pairs += 1
                main_logger.info(f"[{base_asset}/{quote_asset}/{user_id}] Successfully processed")
            else:
                failed_pairs += 1
                error_logger.error(f"[{base_asset}/{quote_asset}/{user_id}] Processing failed")
        except Exception as e:
            failed_pairs += 1
            error_logger.error(f"[{base_asset}/{quote_asset}/{user_id}] Unexpected error: {e}")
        
        # Add delay between pairs to respect rate limits
        time.sleep(1)

    # Summary
    main_logger.info(f"DEX trading session completed: {successful_pairs} successful, {failed_pairs} failed")
    
    if failed_pairs > 0:
        print(f"Check trading_errors.log for details on {failed_pairs} failed pairs")
    
    print(f"DEX trading session completed successfully. {successful_pairs} pairs processed, {failed_pairs} failed.")


if __name__ == "__main__":
    main()
