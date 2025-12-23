# Getting Started

This guide will walk you through setting up LazaiTrader and making your first automated trade.

---

## Prerequisites

Before you begin, you'll need:

- **Telegram Account** - The bot operates entirely through Telegram
- **Ethereum Wallet** - A wallet address (MetaMask, Trust Wallet, etc.)
- **Some Crypto** - Tokens to deposit (ETH, USDC, METIS, etc.)

:::info
You don't need to install any apps or create new accounts beyond what you already have.
:::

---

## Step 1: Start the Bot

1. Open Telegram
2. Search for **@LazaiTrader_bot** or [click here](https://t.me/LazaiTrader_bot)
3. Send the `/start` command

The bot will greet you and ask for your wallet address.

---

## Step 2: Register Your Wallet

When prompted, send your Ethereum wallet address:

```
0x742d35Cc6634C0532925a3b844Bc9e7595f...
```

:::warning
**Important:** This address will be the ONLY address that can receive withdrawals from your trading wallet. Choose carefully and make sure you control this address!
:::

The bot will confirm your registration:

```
✅ Registration Complete!

Your wallet: 0x742d35Cc...
You can now use /deposit to get your trading wallet address.
```

---

## Step 3: Get Your Deposit Address

Send `/deposit` to the bot.

The bot will deploy your Smart Contract Wallet (this may take a moment) and show your deposit address:

```
📥 Your Deposit Address

Send tokens to this address on any supported chain:

0x1234567890abcdef1234567890abcdef12345678

Supported chains:
✅ Metis Andromeda

This is YOUR wallet - same address on all chains!
```

:::tip
**Copy this address carefully!** This is where you'll send funds for trading.
:::

---

## Step 4: Fund Your Wallet

Send tokens to your SCW deposit address:

1. Open your personal wallet (MetaMask, Trust Wallet, etc.)
2. Select the token you want to trade (e.g., USDC, ETH)
3. Send to your SCW address
4. Wait for confirmation

**Recommended First Deposit:**
- Start with a small amount to test
- Make sure you're on the correct network (Metis Andromeda)

---

## Step 5: Check Your Balance

Send `/balance` to verify your deposit arrived:

```
💰 Your Balances

Metis Andromeda:
• 100.00 USDC ($100.00)
• 0.05 WETH ($150.00)

Total: $250.00
```

---

## Step 6: Configure Your First Strategy

Send `/config` and follow the prompts:

### 6.1 Select Chain
```
Select a chain:
[Metis Andromeda]
```

### 6.2 Select Trading Pair
```
Select a trading pair:
[WETH-USDC] [METIS-USDC]
```

### 6.3 Set Strategy Parameters

The bot will ask for:

| Parameter | Description | Example |
|-----------|-------------|---------|
| Trigger % | Price change to trigger trade | 10 |
| Trade % | Portion of balance to trade | 25 |
| Min Amount | Minimum trade in USD | 10 |
| Max Amount | Maximum trade in USD | 500 |
| Multiplier | Position scaling factor | 1.5 |

**Example Configuration:**
```
Strategy Saved! ✅

Pair: WETH-USDC on Metis
Trigger: 10%
Trade Size: 25% of balance
Min: $10 | Max: $500
Multiplier: 1.5x
```

---

## Step 7: You're Live!

That's it! Your strategy is now active. The bot will:

- Monitor prices every minute
- Execute trades when your trigger is hit
- Send you notifications for each trade
- Track your performance

---

## What's Next?

### Monitor Your Trades
- `/chart` - View your trading history and PnL

### Manage Strategies
- `/myconfig` - View your active strategies
- `/deleteconfig` - Remove a strategy

### Withdraw Anytime
- `/withdraw` - Send funds back to your personal wallet

---

## Quick Tips

:::tip
**Start Small:** Test with a small amount first to understand how the system works.
:::

:::tip
**Conservative Settings:** Begin with higher trigger percentages (10-15%) to avoid frequent small trades.
:::

:::tip
**Check Regularly:** Use `/balance` and `/chart` to monitor your portfolio.
:::

---

## Need Help?

- `/help` - Show all available commands
- Review this documentation
- Check the [Commands Reference](../user-guide/commands-reference)
