# How It Works

LazaiTrader combines several components to provide secure, automated trading. Here's the complete flow from registration to trade execution.

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER (Telegram)                          │
│                                                                  │
│   /start  /deposit  /balance  /config  /withdraw  /chart        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      LazaiTrader Bot                             │
│                   (Cloudflare Workers)                           │
│                                                                  │
│  • Handles user commands                                         │
│  • Monitors prices every minute                                  │
│  • Checks trigger conditions                                     │
│  • Executes trades when conditions met                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Smart Contract Wallet (SCW)                    │
│                      (On Blockchain)                             │
│                                                                  │
│  • Holds your tokens                                             │
│  • Executes trades on whitelisted DEXs                          │
│  • Withdrawals ONLY to your personal wallet                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Whitelisted DEXs                              │
│                                                                  │
│  • HerculesDEX (Metis)                                          │
│  • LazaiSwap (Testnet)                                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## User Journey

### 1. Registration

When you send `/start` to the bot:

1. Bot asks for your Ethereum wallet address (EOA)
2. You provide your MetaMask/Trust Wallet address
3. Bot registers you in the system
4. Your EOA becomes the **only address** that can receive withdrawals

:::info
Your EOA (Externally Owned Account) is your personal wallet address - the one you control with a private key or seed phrase.
:::

### 2. Wallet Deployment

When you send `/deposit`:

1. Bot deploys a Smart Contract Wallet (SCW) for you
2. SCW is deployed on all active chains automatically
3. You receive the **same SCW address** on every chain
4. Bot shows you where to send funds

### 3. Funding Your Wallet

1. Copy your SCW deposit address
2. Send supported tokens (ETH, USDC, etc.) from any wallet
3. Bot detects deposits automatically
4. Use `/balance` to verify your funds arrived

### 4. Strategy Configuration

When you send `/config`:

1. Select a trading pair (e.g., ETH-USDC)
2. Set your trigger percentage (e.g., 10% price movement)
3. Set your trade percentage (e.g., 25% of balance per trade)
4. Set min/max trade amounts
5. Set multiplier for consecutive trades

### 5. Automated Trading

Once configured, the system works automatically:

```
Every 1 Minute:
┌─────────────────────────────────────────────────────────────┐
│ 1. Fetch current prices from multiple sources               │
│ 2. Compare to your last trade price                         │
│ 3. Check if trigger conditions are met                      │
│                                                             │
│ If price moved by your trigger percentage:                  │
│ ├─ Price UP → Execute SELL                                  │
│ └─ Price DOWN → Execute BUY                                 │
│                                                             │
│ 4. Calculate trade amount based on your settings            │
│ 5. Execute trade on whitelisted DEX                         │
│ 6. Record trade and notify you via Telegram                 │
└─────────────────────────────────────────────────────────────┘
```

### 6. Withdrawals

When you send `/withdraw`:

1. Select the chain to withdraw from
2. Select the token to withdraw
3. Bot executes withdrawal from your SCW
4. Funds are sent **directly to your EOA** (your personal wallet)

:::warning
Withdrawals can ONLY go to the wallet address you registered with. This is a security feature - even if someone gains access to the bot, they cannot redirect your funds.
:::

---

## Trading Logic Explained

### Trigger Conditions

The bot uses **percentage-based triggers** to decide when to trade:

| Scenario | Condition | Action |
|----------|-----------|--------|
| Price rises | Current price > Last trade price + Trigger% | **SELL** |
| Price drops | Current price < Last trade price - Trigger% | **BUY** |

**Example:**
- Last trade at $3,000
- Trigger percentage: 10%
- Current price: $3,400 (13.3% increase)
- Result: **SELL triggered** (13.3% > 10%)

### Trade Amount Calculation

```
Trade Amount = Balance × Trade Percentage × (Multiplier ^ Consecutive Count)
```

**Example:**
- Balance: 1 ETH
- Trade Percentage: 25%
- Multiplier: 1.5
- Consecutive sells: 2

```
Amount = 1 ETH × 0.25 × (1.5²) = 0.5625 ETH
```

This increases position size on consecutive moves in the same direction.

---

## What Happens to Your Funds

| State | Where Are Funds? | Who Controls? |
|-------|------------------|---------------|
| Before deposit | Your personal wallet | You |
| After deposit | Your Smart Contract Wallet | You (via bot or direct) |
| During trade | Moving through DEX | Smart contract logic |
| After trade | Back in your SCW | You |
| After withdrawal | Your personal wallet | You |

:::tip
**Key Point:** Your funds are always in wallets you control. LazaiTrader never has custody of your assets.
:::

---

## Next Steps

Ready to start? Head to [Getting Started](getting-started) for step-by-step instructions.
