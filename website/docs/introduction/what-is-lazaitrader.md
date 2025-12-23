# What is LazaiTrader?

LazaiTrader is an **automated cryptocurrency trading platform** that operates entirely through Telegram. It enables users to deploy personal Smart Contract Wallets, configure trading strategies, and execute trades automatically based on market conditions.

---

## The Problem We Solve

Traditional automated trading presents several challenges:

| Challenge | Traditional Solutions | LazaiTrader Approach |
|-----------|----------------------|---------------------|
| **Custody Risk** | Centralized exchanges hold your funds | Non-custodial smart contract wallets |
| **Complex Setup** | Requires technical knowledge | Simple Telegram commands |
| **Platform Lock-in** | Funds tied to specific platforms | Your wallet, your keys |
| **Cross-Chain Fragmentation** | Different addresses per chain | Same address everywhere |

---

## Key Features

### Non-Custodial Trading

Your funds are stored in a Smart Contract Wallet (SCW) that only you control. LazaiTrader's bot can execute trades on your behalf, but **withdrawals always go to your personal wallet** - never to us.

### Telegram-Native

No apps to download, no websites to bookmark. Everything happens through Telegram:
- Register with `/start`
- Check balances with `/balance`
- Configure strategies with `/config`
- Withdraw anytime with `/withdraw`

### Automated Strategy Execution

Define your trading parameters once:
- When to buy (price drops by X%)
- When to sell (price rises by X%)
- How much to trade (percentage of balance)
- Position sizing rules

The bot monitors markets 24/7 and executes when your conditions are met.

### Cross-Chain by Design

Deploy your Smart Contract Wallet once and receive the **same address on every supported blockchain**. This means:
- Simpler fund management
- No address confusion
- Easy multi-chain expansion

---

## How is This Possible?

LazaiTrader leverages several blockchain technologies:

1. **Smart Contract Wallets** - Personal contracts that hold your funds and execute trades
2. **CREATE2 Deployment** - Deterministic addresses across all chains
3. **Cloudflare Workers** - Serverless infrastructure for 24/7 operation
4. **Whitelisted DEXs** - Only approved exchanges can interact with your wallet

---

## Who is LazaiTrader For?

- **DeFi Users** who want automated trading without giving up custody
- **Busy Traders** who can't monitor markets 24/7
- **Multi-Chain Users** who want simplified wallet management
- **Telegram Users** who prefer chat-based interfaces

---

## Ready to Start?

Continue to [How It Works](how-it-works) to understand the system flow, or jump straight to [Getting Started](getting-started) to begin trading.
