# LazaiTrader User Guide

## What is LazaiTrader?
LazaiTrader is an intelligent trading assistant that works through Telegram. It automatically trades cryptocurrency for you using proven strategies on the Hyperion testnet. Think of it as your personal AI trader that never sleeps!

## 🎯 How It Works (Simple Explanation)
1. **You Get a Wallet**: When you start, you receive a funded test wallet
2. **You Set Your Strategy**: Tell the bot how you want to trade (conservative vs aggressive)
3. **AI Does the Trading**: The bot watches prices and makes trades automatically
4. **You Get Updates**: Receive real-time notifications about your trades
5. **You Can Win Prizes**: Top performers share up to $500 in rewards!
6. **Share & Learn**: Contribute to the Strategy Vault and get AI-powered suggestions

## 🚀 Getting Started

### Step 1: Join the Bot
- Click the LazaiTrader bot link or scan the QR code: https://t.me/LazaiTrader_bot
- Send `/start` to begin
- You'll automatically receive a funded test wallet with:
  - 100 tgUSDC
  - 10,000,000 tgMetis
  - 0.1 testgETH

### Step 2: Configure Your Strategy
- Send `/config` to set up your trading preferences
- Choose between two simple options:
  - **🛡️ Conservative Strategy**: Lower risk, smaller profits (5% trade amount, 5% trigger, $20 max)
  - **⚡ Aggressive Strategy**: Higher risk, larger potential gains (20% trade amount, 15% trigger, $100 max)

### Step 3: Fine-tune Your Settings  
- **Trade Percentage**: How much of your balance to use per trade (adjustable ±20%)
- **Trigger Percentage**: Price change needed to execute trades (adjustable ±20%)
- **Maximum Amount**: Safety limit on individual trade sizes (adjustable ±20%)
- **Multiplier**: Fixed at 1.5x for consecutive trades
- **Minimum Amount**: Fixed at $0

### Step 4: Choose Your Trading Pair
Currently available on testnet:
- **gMetis-USDC**: Trade the popular gMetis meme token from Metis Andromeda
- **ETH-USDC**: Trade Ethereum with different market dynamics

*More pairs will be available on mainnet*

### Step 5: Start Trading!
- Once configured, your AI trader starts working immediately
- You'll receive notifications whenever trades happen
- Check your progress anytime with `/myconfig`

## 💰 Your Test Wallet

**Starting Balance:**
- 100 tgUSDC (like $100 USD)
- 10,000,000 tgMetis (test gMetis tokens)
- 0.1 testgETH (test Ethereum tokens)

**What This Means:**
- These are test tokens on the Hyperion testnet (practice network)
- No real money is at risk during testing
- Your wallet address: Use `/wallet` or `/address` to see it anytime

## 🤖 The Trading Strategy Explained

### What is the Martingale Strategy?
Martingale is a trading strategy that:
- **Buys more** when prices go down (hoping they'll recover)
- **Sells more** when prices go up (taking profits)
- **Increases trade size** after each consecutive trade in the same direction (1.5x multiplier)

### Example in Action:
1. **Price drops 5%** → Bot buys $10 worth of tgMetis
2. **Price drops another 5%** → Bot buys $15 worth (1.5x previous)
3. **Price drops again** → Bot buys $22.50 worth
4. **Price recovers** → Bot sells everything for profit

### Your Settings Control:
- **Trade Percentage**: How much of your wallet to use per trade
- **Trigger Percentage**: How much price must change to trigger a trade  
- **Multiplier**: Fixed at 1.5x for consecutive trades
- **Max/Min Amounts**: Safety limits on trade sizes

## 📱 Telegram Commands

### Essential Commands
- `/start` - Register and get your wallet
- `/config` - Set up your trading strategy
- `/wallet` or `/address` - See your wallet address
- `/myconfig` - View your current strategy settings
- `/balance` - Check your current token balances

### New Features
- `/contribute` - Add your trading data to the Strategy Vault
- `/suggestion` - Get AI-powered strategy recommendations
- `/chart` - View your trading charts and PnL
- `/deleteconfig` - Delete your current trading configuration
- **Strategy Removal** - Remove strategies that aren't working out

### Other Commands
- `/withdraw` - Withdrawal info (will be enabled on mainnet)
- `/cancel` - Cancel configuration process

### Getting Help
- Visit @LazaiTrader group or chat with our Alith-powered AI: https://t.me/LazaiTrader_alithbot!
- Get trading strategy advice, Metis/LazAI information, and project updates

## 🏦 Strategy Vault - NEW FEATURE!

### What is the Strategy Vault?
The Strategy Vault is a revolutionary feature that allows you to:
- **Contribute** your trading data securely to a collective knowledge base
- **Get AI suggestions** based on anonymous performance data from all users
- **Learn** from the community without revealing private information

### How It Works:
1. **Secure Storage**: Your data is signed with your wallet and stored in a TEE (Trusted Execution Environment)
2. **Privacy Protected**: All data is anonymized - no individual information is revealed
3. **AI Analysis**: TEE-based AI analyzes your performance against collective data
4. **Personalized Suggestions**: Get data-backed recommendations tailored to your strategy

### Using the Strategy Vault:
- Use `/contribute` to add your trading data to the vault
- Use `/suggestion` to get AI-powered strategy recommendations
- Your contributions help improve suggestions for everyone while keeping your data private

## 📊 Understanding Your Trade Notifications

When the bot makes a trade, you'll receive a detailed message showing:

### Key Information:
- **Action**: Whether bot bought or sold
- **Amount**: How many tokens were traded
- **Trade Value**: Dollar value of the trade
- **Consecutive Info**: Shows if this is part of a streak (with 1.5x multiplier)
- **Price Change**: How much the price moved to trigger the trade
- **Current Balances**: Your wallet contents after the trade
- **Total USD**: Your overall wallet value

### New: Trading Charts & PnL
- Use `/chart` to view your private trading charts directly in Telegram
- Track your profit and loss in real-time
- Analyze your strategy performance visually

## 🏆 Spotlight Campaign & Rewards

### Timeline: Until August 21, 2025

### Current Prize Pool: $100
- **1st Place**: $50 USD (highest wallet USD value)
- **2nd Place**: $25 USD  
- **3rd Place**: $25 USD

### Potential Prize Pool: $500*
*If LazaiTrader wins Hyperhack rewards, the prize pool expands to:
- **Core Prizes Doubled**: 1st = $100, 2nd = $50, 3rd = $50
- **Bonus Winners**: +10 extra winners get $30 in ETH/METIS/USDC
- **Distribution**: On Hyperion mainnet (withdrawals enabled!)

### How to Win:
- Configure your strategy thoughtfully
- Monitor your performance through notifications and charts
- Use the Strategy Vault to optimize your approach
- Maintain the highest USD wallet value by August 21

### What You Need to Do:
- Test different strategies on both trading pairs
- Contribute to and learn from the Strategy Vault
- Stay active until the campaign ends
- Join the community for tips and updates

## ⚙️ Strategy Tips

### For Conservative Traders:
- Choose "Conservative Strategy" option
- Consider the ETH-USDC pair for potentially lower volatility
- gMetis-USDC offers meme token volatility opportunities
- Use the Strategy Vault suggestions to refine your approach
- Keep default settings or reduce trade/trigger percentages slightly

### For Aggressive Traders:
- Choose "Aggressive Strategy" option
- Try both trading pairs to see which performs better
- Consider increasing maximum trade amounts
- Use `/suggestion` to get AI recommendations based on top performers

### Understanding Risk:
- **Lower trigger percentage** = More frequent trades (more sensitive to price changes)
- **Higher trade percentage** = Larger individual trades
- **Higher max amount** = Allows for bigger trades when you have large balances
- **Different pairs** = Different volatility patterns and opportunities

### Using the Strategy Vault:
- Contribute your data early to help build the knowledge base
- Check suggestions regularly as more data becomes available
- Compare your performance against anonymous collective data
- Learn from successful strategies without copying them directly

## 🔐 Safety & Security

### During Testing Phase:
- **No Real Money**: All trading uses test tokens
- **Admin Managed**: Test wallets are controlled by the system
- **Safe Environment**: Hyperion testnet is a practice network
- **TEE Security**: Strategy Vault data is stored in Trusted Execution Environments
- **Privacy Protected**: All shared data is anonymized and secure

### For Future Production (Hyperion Mainnet):
- **Your Own Wallets**: You'll control your own funds
- **Real Trading**: On the actual Hyperion mainnet
- **Enhanced Security**: Confidential computing and public audit logs
- **Privacy Features**: First-ever compliant privacy layer in Metis/Hyperion ecosystem

## 🌐 Technical Background (Optional Reading)

### Trading Pairs Available:
Currently on testnet:
- **gMetis-USDC**: Trade the popular gMetis meme token from Metis Andromeda mainnet
- **ETH-USDC**: Trade Ethereum with different market characteristics

*Additional pairs will be available on mainnet launch*

### Networks Used:
- **Hyperion Testnet**: For testing (current phase)
- **Hyperion Mainnet**: Real network (future production)

### Advanced Technology Stack:
- **Custom DEX + Oracle Contract**: 0x4704759E4a426b29615e4841B092357460925eFf
- **tgMetis Token**: 0x69Dd3C70Ae76256De7Ec9AF5893DEE49356D45fc
- **tgUSDC Token**: 0x6Eb66c8bBD57FdA71ecCAAc40a56610C2CA8FDb8
- **TEE-Based AI**: Secure, private analysis for Strategy Vault
- **Agentic DEX Contract**: Smart contract with built-in trading intelligence

### What's Happening Behind the Scenes:
1. Custom oracle provides real-time price data
2. Smart contract monitors price movements against your triggers
3. TEE-based AI analyzes trading patterns securely
4. Automated execution on decentralized exchange
5. Real-time notifications and chart updates

## 🚀 Upcoming Features (Hyperion Mainnet)

### Phase 1: Security & Control
1. **Wallet PK Reveal**: Decouple wallet from Telegram account for safer recovery
2. **Privacy Withdraw**: First-ever compliant privacy layer in Metis/Hyperion ecosystem

### Phase 2: Advanced Trading
3. **Smarter Trading Strategies**: Move beyond martingale to include:
   - **Social Sentiment Signals**: Trade based on market sentiment analysis
   - **User-Set Bull/Bear Triggers**: Custom market condition responses
   - **Auto Strategy Upgrades**: Continuous improvement based on performance

### Additional Features Coming:
- **Signal Access**: Get trading signals even with zero balance
- **Enhanced Strategy Management**: Better control over multiple strategies
- **Community Features**: Expanded social trading capabilities

## ❓ Frequently Asked Questions

**Q: Do I need to know anything about crypto to participate?**
A: No! Just configure your preferences and the AI handles everything. The Strategy Vault even helps you learn from others.

**Q: Can I lose real money during testing?**
A: No, testing uses fake tokens with no real value.

**Q: How does the Strategy Vault protect my privacy?**
A: All data is anonymized and stored in TEE (Trusted Execution Environment), so no individual information is revealed.

**Q: Which trading pair should I choose?**
A: Try both! gMetis-USDC offers meme token volatility (gMetis is a popular meme token from Metis Andromeda), while ETH-USDC may offer more traditional crypto trading patterns.

**Q: How often does the bot trade?**
A: Only when prices move by your trigger percentage, which varies by pair and market conditions.

**Q: Can I change my strategy after starting?**
A: Yes, use `/config` again anytime. You can also use `/deleteconfig` to remove your current configuration and start fresh.

**Q: How do I know if I'm winning?**
A: Use `/chart` to view your trading performance, check `/balance`, and watch your "Total USD" value - higher is better!

**Q: What are the fees on mainnet?**
A: Currently planned: 5-10% of profits only (no fees on losses). Plus incentives for data providers.

**Q: When will withdrawals be enabled?**
A: Withdrawals will be enabled when the project moves to Hyperion mainnet after the campaign.

## 🆘 Getting Help

### If Something Goes Wrong:
1. **Try the command again** - Network issues can cause temporary problems
2. **Check your configuration** - Use `/myconfig` to verify settings
3. **Visit @LazaiTrader group** - Chat with the Alith AI agent for help
4. **Use Strategy Vault** - Get AI suggestions if your strategy isn't performing

### Common Issues:
- **"You're not registered"** → Send `/start` first
- **"No configuration found"** → Use `/config` to set up your strategy
- **Delayed notifications** → Blockchain confirmations take time
- **Strategy not working** → Try `/suggestion` for AI recommendations

### Contact Support:
- Chat with the Alith AI agent in @LazaiTrader group for immediate help
- Ask questions about trading, Strategy Vault, or technical issues
- Get community tips and share experiences

## 🎉 Ready to Start?

1. **Join the bot**: https://t.me/LazaiTrader_bot
2. **Send `/start`** to get your funded wallet
3. **Use `/config`** to set up your strategy
4. **Try both trading pairs** to see which works better
5. **Use `/contribute`** to add your data to Strategy Vault
6. **Get `/suggestion`s** from AI analysis
7. **Watch your charts** and optimize your approach
8. **Join @LazaiTrader group** for community support
9. **ask the our support Alith agent**: https://t.me/LazaiTrader_alithbot

Remember: This is both a competition and a learning experience. Use the Strategy Vault to improve your approach, test different pairs, and help build the collective knowledge base.

The campaign ends August 21 - may the best strategy win! 🚀

---
*LazaiTrader is built by gMetis using the Alith AI framework. Spotlight Campaign runs until August 21, 2025, on Hyperion testnet. Prize pool: $100 guaranteed, potentially $500 if we win Hyperhack!*

## 🌐 Technical Background (Optional Reading)

### Trading Pair:
- **Currently Available**: tgMetis/tgUSDC only
- **Coming Soon**: Metis-USDC, ETH-USDC (after testnet)

### Networks Used:
- **Hyperion Testnet**: For testing (current phase)
- **Metis Andromeda**: Real network (future production)

### What's Happening Behind the Scenes:
1. Bot monitors gMetis price on Metis Andromeda mainnet (Hercules DEX)
2. Updates price information on Hyperion testnet
3. Checks if price moved enough to trigger your strategy
4. Executes trades on the test DEX (decentralized exchange)
5. Records everything and sends you updates

### The Technology:
- **Blockchain**: Metis (Ethereum-compatible)
- **Smart Contracts**: Automated trading logic
- **AI Framework**: Alith by LazaiNetwork
- **Price Data**: Real market prices from gMetis on Metis Andromeda

## ❓ Frequently Asked Questions

**Q: Do I need to know anything about crypto to participate?**
A: No! Just configure your preferences and the AI handles everything.

**Q: Can I lose real money during testing?**
A: No, testing uses fake tokens with no real value.

**Q: How often does the bot trade?**
A: Only when prices move by your trigger percentage (e.g., 5-30% depending on your settings).

**Q: Can I change my strategy after starting?**
A: Yes, use `/config` again to update your preferences anytime.

**Q: What if I don't like the trades the bot is making?**
A: You can reconfigure anytime, but remember the strategy needs time to work.

**Q: How do I know if I'm winning?**
A: Watch your "Total USD" value in trade notifications and use `/balance` - higher is better!

**Q: What happens after the testing phase?**
A: The project will move to mainnet where you can trade with real funds.

**Q: Why can't I withdraw during testing?**
A: Withdrawals are disabled during testnet to focus on strategy testing. This will be enabled for mainnet.

**Q: What's the difference between tgMetis and gMetis?**
A: tgMetis is the testnet version of gMetis tokens used for safe testing.

## 🆘 Getting Help

### If Something Goes Wrong:
1. **Try the command again** - Sometimes network issues cause temporary problems
2. **Check your configuration** - Use `/myconfig` to verify settings
3. **Visit @LazaiTrader group** - Chat with the Alith AI agent for help
4. **Be patient** - Some operations take time on the blockchain

### Common Issues:
- **"You're not registered"** → Send `/start` first
- **"No configuration found"** → Use `/config` to set up your strategy
- **Delayed notifications** → Blockchain confirmations take time
- **"Pair not available"** → Only tgMetis/tgUSDC is supported during testnet

### Contact Support:
- Chat with the Alith AI agent in @LazaiTrader group for immediate help
- Ask questions about trading, Metis, or the project
- The AI understands both technical and basic questions

## 🎉 Ready to Start?

1. **Click the bot link** or scan the QR code
2. **Send `/start`** to get your funded wallet
3. **Use `/config`** to set up your strategy
4. **Watch the magic happen** as your AI trader works!
5. **Join @LazaiTrader group** for community support and AI assistance

Remember: This is a learning and testing experience. The goal is to see how well different strategies perform and help improve the system for future real-money trading.

Good luck, and may the best strategy win! 🚀

---
*LazaiTrader is built by gMetis using the Alith AI framework. This testing phase runs until August 7, 2025, on the Hyperion testnet.*


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