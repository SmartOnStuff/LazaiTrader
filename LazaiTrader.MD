# LazaiTrader User Guide

## What is LazaiTrader?
LazaiTrader is an intelligent trading assistant that works through Telegram. It automatically trades cryptocurrency for you using a proven strategy called "Martingale" on the Metis blockchain network. Think of it as your personal AI trader that never sleeps!

## 🎯 How It Works (Simple Explanation)
1. **You Get a Wallet**: When you start, you receive a funded test wallet
2. **You Set Your Strategy**: Tell the bot how you want to trade (conservative vs aggressive)
3. **AI Does the Trading**: The bot watches prices and makes trades automatically
4. **You Get Updates**: Receive real-time notifications about your trades
5. **You Can Win Prizes**: Top performers share $100 in rewards!

## 🚀 Getting Started

### Step 1: Join the Bot
- Click the LazaiTrader bot link or scan the QR code
- Send `/start` to begin
- You'll automatically receive a funded test wallet with 100 TESTgUSDC + 10,000,000 TESTgMetis

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

### Step 4: Start Trading!
- Once configured, your AI trader starts working immediately
- You'll receive notifications whenever trades happen
- Check your progress anytime with `/myconfig`

## 💰 Your Test Wallet

**Starting Balance:**
- 100 TESTgUSDC (like $100 USD)
- 10,000,000 TESTgMetis (test Metis tokens)

**What This Means:**
- These are test tokens on the Hyperion testnet (practice network)
- No real money is at risk during testing
- Your wallet address: Use `/wallet` or `/address` to see it anytime

## 🤖 The Martingale Strategy Explained

### What is Martingale?
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
- `/withdraw` - Withdrawal info (disabled during testnet)
- `/cancel` - Cancel configuration process

### Getting Help
- Visit @LazaiTrader group to chat with our Alith-powered AI!
- Get trading strategy advice, Metis blockchain information, and project updates

## 📊 Understanding Your Trade Notifications

When the bot makes a trade, you'll receive a message like this:

```
🔴 PRODUCTION TRADE EXECUTED 📉
User: yourUsername
Pair: tgMetis/tgUSDC
Action: BUY tgMetis
Amount: 19,057,242 tgMetis
Trade Value: $34.93
🔥 Consecutive #3: 33.75% trade size
🔗 TX Hash: 0x1a6e7d8c...
Base Price: 0.000002 tgUSDC
Current Price: 0.000002 tgUSDC
Price Change: -8.35%
Current Balances:
• tgMetis: 25,556,242
• tgUSDC: 68.57
• Total USD: $115.41
```

### What This Means:
- **Action**: Whether bot bought or sold
- **Amount**: How many tokens were traded
- **Trade Value**: Dollar value of the trade
- **Consecutive Info**: Shows if this is part of a streak (with 1.5x multiplier)
- **Price Change**: How much the price moved to trigger the trade
- **Current Balances**: Your wallet contents after the trade
- **Total USD**: Your overall wallet value

## 🏆 Testing Phase & Rewards

### Timeline: Until August 7, 2025

### How to Win:
- The bot trades automatically based on your strategy
- Your goal: Have the highest USD value in your wallet at the end
- Success depends on:
  - Your strategy settings
  - Market conditions
  - How well the Martingale strategy performs with tgMetis price fluctuations

### Prizes:
- **1st Place**: $50 USD
- **2nd Place**: $25 USD  
- **3rd Place**: $25 USD

### What You Need to Do:
- Configure your strategy thoughtfully
- Monitor your performance through notifications
- Optionally adjust your strategy if needed using `/config`
- Wait for the testing period to end

## ⚙️ Strategy Tips

### For Conservative Traders:
- Choose "Conservative Strategy" option
- Keep default settings or reduce trade/trigger percentages slightly
- This gives you more frequent trades with lower risk per trade

### For Aggressive Traders:
- Choose "Aggressive Strategy" option
- Consider increasing maximum trade amounts
- This means fewer but potentially more profitable trades

### Understanding Risk:
- **Lower trigger percentage** = More frequent trades (more sensitive to price changes)
- **Higher trade percentage** = Larger individual trades
- **Higher max amount** = Allows for bigger trades when you have large balances
- **1.5x multiplier** = Each consecutive trade in same direction is 50% larger

## 🔐 Safety & Security

### During Testing Phase:
- **No Real Money**: All trading uses test tokens
- **Admin Managed**: Test wallets are controlled by the system
- **Safe Environment**: Hyperion testnet is a practice network
- **Withdrawal Disabled**: Focus is on testing strategies, not moving funds

### For Future Production:
- **Your Own Wallets**: You'll control your own funds
- **Real Trading**: On the actual Metis network
- **Enhanced Security**: Confidential computing and public audit logs

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
