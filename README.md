# LazaiTrader - Technical Documentation

## Overview

LazaiTrader is a Telegram-based AI trading agent built with the Alith framework by LazaiNetwork. It executes automated Martingale trading strategies on the Hyperion testnet for the TESTgMetis-TESTgUSDC trading pair, with plans to migrate to the Hercules DEX on Metis Andromeda for production.

## Architecture

### System Components

1. **Telegram Bot Interface** (Alith Integration)
   - Built using the Alith AI agent framework
   - Handles user onboarding, strategy configuration, and trade notifications
   - Located in `plugins/LT_bot.py`

2. **Trading Engine** (`main.py`)
   - Monitors TESTgMetis prices from Metis Andromeda via DexScreener API
   - Updates oracle prices on Hyperion testnet
   - Executes Martingale trading strategy
   - Handles wallet whitelisting and trade execution

3. **Smart Contract Integration**
   - Custom DEX contract on Hyperion testnet
   - Integrated price oracle updated with Andromeda price data
   - Supports TESTgMetis-TESTgUSDC trading pair

4. **Configuration System**
   - Modular JSON-based configuration
   - Separate files for users, wallets, tokens, and trading pairs
   - Located in `config/` directory

## Installation & Setup

### Prerequisites

- Python 3.8+
- Web3 connection to Hyperion testnet
- Telegram Bot Token
- DexScreener API access

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd LazaiTrader

# Install dependencies
pip install -r requirements.txt

# Setup environment variables
cp .env.template .env
# Edit .env with your configuration
```

### Configuration Files

Configure the following JSON files in the `config/` directory:

#### `config.json` - Trading Pairs Configuration
```json
{
  "trading_pairs": [
    {
      "symbol1": "tgMetis",
      "symbol2": "tgUSDC", 
      "trade_percentage": 0.1,
      "trigger_percentage": 0.02,
      "max_amount": 50.0,
      "minimum_amount": 20.0,
      "decimal": 3,
      "multiplier": 2,
      "userID": "user1"
    }
  ]
}
```

#### `tokens.json` - Token Contract Addresses
```json
{
  "tokens": {
    "tgMetis": {
      "address": "0x69Dd3C70Ae76256De7Ec9AF5893DEE49356D45fc",
      "decimals": 18,
      "symbol": "tgMetis"
    },
    "tgUSDC": {
      "address": "0x6Eb66c8bBD57FdA71ecCAAc40a56610C2CA8FDb8", 
      "decimals": 18,
      "symbol": "tgUSDC"
    }
  }
}
```

#### `users.json` - User to Wallet Mapping
```json
{
  "users": {
    "user1": {
      "wallet_address": "0x123...",
      "telegram_chat_id": "123456789",
      "username": "username1"
    }
  }
}
```

#### `wallets.json` - Private Key Storage
```json
{
  "wallets": {
    "0x123...": {
      "private_key": "0x456...",
      "wallet_name": "User Wallet"
    }
  }
}
```

### Environment Variables

Create a `.env` file with the following variables:

```bash
# Blockchain Configuration
RPC_URL=https://hyperion-testnet.metisdevops.link
CHAIN_ID=133717
DEX_ADDR=0x4704759E4a426b29615e4841B092357460925eFf
ORACLE_OWNER_PK=your_oracle_owner_private_key

# API Configuration  
DEXSCREENER_API=https://api.dexscreener.com/latest/dex/pairs/metis/0xb7af89d7fe88d4fa3c9b338a0063359196245eaa
TELEGRAM_BOT_TOKEN=your_telegram_bot_token

# Execution Mode
PRODUCTION=0  # Set to 1 for production mode
```

## Usage

### Running in Simulation Mode (Default)
```bash
python main.py
```

### Running in Production Mode
```bash
PRODUCTION=1 python main.py
```

### Running the Telegram Bot
```bash
python plugins/LT_bot.py
```

### Automated Execution (Cron)
```bash
# Every 5 minutes
*/5 * * * * cd /path/to/LazaiTrader && python main.py

# Every hour  
0 * * * * cd /path/to/LazaiTrader && python main.py
```

## Martingale Trading Strategy

### Algorithm Logic

**Buy Signal**: When TESTgMetis price drops by `trigger_percentage`:
- Buy `trade_percentage` of available TESTgUSDC
- For consecutive drops, multiply trade size by `multiplier`

**Sell Signal**: When TESTgMetis price rises by `trigger_percentage`:
- Sell `trade_percentage` of available TESTgMetis  
- For consecutive rises, multiply trade size by `multiplier`

### Parameters

- `trade_percentage`: Base percentage of wallet to trade (0.1 = 10%)
- `trigger_percentage`: Price change threshold (0.02 = 2%)
- `max_amount`: Maximum trade value in TESTgUSDC
- `minimum_amount`: Minimum trade value in TESTgUSDC
- `multiplier`: Factor for consecutive trade size increases
- `decimal`: Price precision for logging

### Trade Execution Flow

1. **Price Monitoring**: Fetch current TESTgMetis price from Andromeda
2. **Oracle Update**: Update Hyperion oracle with latest price
3. **Trigger Check**: Compare current price vs base price
4. **Trade Calculation**: Calculate trade amount with multiplier logic
5. **Wallet Whitelisting**: Add user wallet to DEX whitelist
6. **Trade Execution**: Execute swap on DEX contract
7. **Logging**: Record trade details and update base price
8. **Notification**: Send Telegram notification to user

## API Integration

### DexScreener API
- **Endpoint**: `https://api.dexscreener.com/latest/dex/pairs/metis/{pair_address}`
- **Purpose**: Fetch real-time TESTgMetis price from Metis Andromeda
- **Rate Limit**: Built-in rate limiting (3-5 calls/second)

### Smart Contract Calls

#### Oracle Price Update
```python
dex.functions.setPrices(price_gmetis_to_usdc, price_usdc_to_gmetis)
```

#### Trade Execution
```python
# 1. Approve token spending
token.functions.approve(dex_address, amount)

# 2. Execute swap
dex.functions.swap(token_in_address, amount_in)
```

## Logging & Monitoring

### Log Files

- `logs/trading_main.log`: Successful operations
- `logs/trading_errors.log`: Error tracking
- `logs/{symbol1}_{symbol2}_{userID}.csv`: Price data per trading pair
- `logs/{symbol1}_{symbol2}_{userID}_trades.csv`: Trade history

### Trade Notification Format

```
🔴 PRODUCTION TRADE EXECUTED 📉
User: username
Pair: tgMetis/tgUSDC
Action: BUY tgMetis
Amount: 19057242.225859 tgMetis
Trade Value: $34.93
🔥 Consecutive #3: 33.75% trade size
🔗 TX Hash: 0x1a6e7d8c...
Base Price: 0.000002 tgUSDC
Current Price: 0.000002 tgUSDC  
Price Change: -8.35%
Current Balances:
• tgMetis: 25556242.225859
• tgUSDC: 68.570075
• Total USD: $115.41
```

## Security Considerations

### Testing Phase Security
- Admin-controlled wallets with pre-funded balances
- Simulation mode for safe testing
- Rate limiting to prevent RPC abuse

### Production Phase Security  
- Confidential Virtual Machine (CVM) with Trusted Execution Environment (TEE)
- User-controlled wallets without admin access
- Infrastructure-as-code deployment
- Public server logs for transparency
- Open-source smart contracts

### Private Key Management
- Store `wallets.json` securely with restricted permissions
- Never commit private keys to version control
- Use environment variables for sensitive configuration

## Development

### File Structure
```
LazaiTrader/
├── main.py                 # Main trading engine
├── requirements.txt        # Python dependencies
├── config/                 # Configuration files
│   ├── config.json        # Trading pairs
│   ├── tokens.json        # Token addresses
│   ├── users.json         # User mappings
│   └── wallets.json       # Private keys
├── logs/                   # Log files
├── plugins/                # Bot and utilities
│   ├── LT_bot.py          # Telegram bot
│   ├── alith.py           # Alith agent integration
│   └── addresses.txt      # Wallet addresses
└── README.md              # This file
```

### Adding New Features

#### New Trading Pairs
1. Add token info to `tokens.json`
2. Update contract ABIs if needed
3. Configure trading pair in `config.json`
4. Test in simulation mode

#### New Users
1. Add wallet to `wallets.json` 
2. Map user in `users.json`
3. Configure trading strategy in `config.json`

### Error Handling

The system includes comprehensive error handling:
- Graceful failure per trading pair
- Detailed error logging
- Continuation of other pairs if one fails
- Optional Telegram error notifications

## Testing

### Hyperion Testnet Phase (Until Aug 7, 2025)

- **Wallet Funding**: 100 TESTgUSDC + 10M TESTgMetis per user
- **Incentive Structure**: $100 rewards split among top 3 performers
- **Evaluation Metric**: Total USD value of wallet contents

### Testing Commands

```bash
# Run in simulation mode
python main.py

# Check logs
tail -f logs/trading_main.log
tail -f logs/trading_errors.log

# Test specific pair
# Edit config.json to include only target pair
python main.py
```

## Production Migration

### Hercules DEX Integration
- Migration from Hyperion testnet to Metis Andromeda mainnet
- Integration with Hercules DEX native capabilities
- Potential replacement of separate oracle with DEX-native pricing

### Deployment Considerations
- Automated infrastructure deployment
- CVM with TEE security implementation
- Public server log accessibility
- User-funded wallet generation without admin access

## API Reference

### Main Functions

#### `process_trading_pair(w3, pair_config)`
Processes a single trading pair based on configuration.

**Parameters:**
- `w3`: Web3 instance
- `pair_config`: Trading pair configuration dict

**Returns:** Boolean indicating success/failure

#### `execute_dex_trade(w3, base_asset, quote_asset, action, quantity, user_data)`
Executes trade on DEX contract.

**Parameters:**
- `w3`: Web3 instance  
- `base_asset`: Base asset symbol
- `quote_asset`: Quote asset symbol
- `action`: "BUY" or "SELL"
- `quantity`: Trade quantity
- `user_data`: User information dict

**Returns:** Dict with transaction details

#### `get_price(base_asset, quote_asset)`
Fetches current price for trading pair.

**Returns:** Tuple of (date_str, time_str, price)

### Rate Limiting

Built-in decorators for API and RPC rate limiting:
- `@rate_limit(calls_per_second=3)` for RPC calls
- `@rate_limit(calls_per_second=5)` for API calls

## Troubleshooting

### Common Issues

**Connection Errors**
- Verify RPC_URL is accessible
- Check network connectivity
- Validate CHAIN_ID matches network

**Transaction Failures**  
- Ensure sufficient gas funds in wallets
- Verify token contract addresses
- Check DEX contract permissions

**Configuration Errors**
- Validate JSON syntax in config files
- Ensure all required fields are present
- Verify address format (checksum)

**Price Feed Issues**
- Check DexScreener API accessibility
- Verify pair address in API URL
- Monitor rate limiting

### Debug Commands

```bash
# Check configuration validity
python -c "import json; print(json.load(open('config/config.json')))"

# Test Web3 connection
python -c "
from web3 import Web3
w3 = Web3(Web3.HTTPProvider('https://hyperion-testnet.metisdevops.link'))
print('Connected:', w3.is_connected())
"

# Validate addresses
python -c "
from web3 import Web3
addr = '0x4704759E4a426b29615e4841B092357460925eFf'
print('Checksum:', Web3.to_checksum_address(addr))
"
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Test changes in simulation mode
4. Submit pull request with detailed description

## License

[License information to be added]

## Support

For technical issues:
- Check logs in `logs/` directory
- Review configuration files for errors
- Verify environment variables
- Test in simulation mode first

For project-related questions:
- Contact LazaiNetwork team
- Join community channels
- Review project documentation