# Configuring Strategies

Set up automated trading strategies that execute based on price movements.

---

## Starting Configuration

Send `/config` to begin:

```
/config
```

The bot will guide you through the setup process.

---

## Configuration Steps

### Step 1: Select Chain

```
⚙️ Strategy Configuration

Select a chain:
[Metis Andromeda]
```

Choose the blockchain network for this strategy.

### Step 2: Select Trading Pair

```
Select a trading pair:

[WETH-m.USDC] [WMetis-m.USDC]
```

Choose which token pair you want to trade.

### Step 3: Set Trigger Percentage

```
📊 Trigger Percentage

How much should the price move to trigger a trade?

Enter a number between 1 and 50:
(Example: 10 means trade when price moves 10%)
```

This determines when trades execute. A **10%** trigger means:
- Price rises 10% → SELL
- Price drops 10% → BUY

### Step 4: Set Trade Percentage

```
💰 Trade Percentage

What portion of your balance should be traded?

Enter a number between 1 and 100:
(Example: 25 means trade 25% of your balance)
```

This controls position sizing. **25%** means each trade uses 25% of your relevant token balance.

### Step 5: Set Minimum Amount

```
⬇️ Minimum Trade Amount

What's the smallest trade you want to execute? (in USD)

Enter a number:
(Example: 10 means skip trades under $10)
```

Trades below this threshold are skipped to avoid small, unprofitable trades.

### Step 6: Set Maximum Amount

```
⬆️ Maximum Trade Amount

What's the largest trade you want to execute? (in USD)

Enter a number:
(Example: 500 means cap trades at $500)
```

Protects against oversized positions.

### Step 7: Set Multiplier

```
📈 Consecutive Trade Multiplier

Increase position size on consecutive moves?

Enter a number between 1.0 and 3.0:
(Example: 1.5 means each consecutive trade is 50% larger)
```

This amplifies position sizes when the market moves repeatedly in one direction.

---

## Configuration Complete

```
✅ Strategy Saved!

Your Configuration:
┌────────────────────┬─────────────┐
│ Setting            │ Value       │
├────────────────────┼─────────────┤
│ Pair               │ WETH-m.USDC │
│ Chain              │ Metis       │
│ Trigger            │ 10%         │
│ Trade Size         │ 25%         │
│ Min Amount         │ $10         │
│ Max Amount         │ $500        │
│ Multiplier         │ 1.5x        │
└────────────────────┴─────────────┘

Your strategy is now ACTIVE! 🚀

The bot will monitor prices and execute trades
when your conditions are met.
```

---

## Understanding the Parameters

### Trigger Percentage

| Value | Meaning | Best For |
|-------|---------|----------|
| 5% | Trade on small moves | Active trading, high volume |
| 10% | Moderate movements | Balanced approach |
| 15%+ | Large swings only | Conservative, fewer trades |

{% hint style="tip" %}
Start with **10-15%** to avoid excessive trading fees.
{% endhint %}

### Trade Percentage

| Value | Risk Level | Description |
|-------|------------|-------------|
| 10-20% | Low | Small positions, more trades to move balance |
| 25-35% | Medium | Balanced approach |
| 40%+ | High | Large positions, faster rebalancing |

### Multiplier Effect

The multiplier increases position size on **consecutive** trades in the same direction:

```
Trade 1 (BUY): 25% of balance
Trade 2 (BUY): 25% × 1.5 = 37.5% of balance
Trade 3 (BUY): 25% × 1.5² = 56.25% of balance
```

When direction changes (BUY → SELL), the consecutive count resets to 0.

{% hint style="warning" %}
High multipliers can lead to large positions quickly. Use with caution.
{% endhint %}

---

## Example Scenarios

### Scenario 1: Price Rises

```
Initial: 1 ETH @ $3,000
Trigger: 10%
Trade %: 25%

Price rises to $3,400 (13% up)
→ SELL triggered
→ Sell 0.25 ETH
→ Receive ~$850 USDC
```

### Scenario 2: Consecutive Drops

```
Starting: 1000 USDC
Trigger: 10%
Trade %: 25%
Multiplier: 1.5x

Price drops 10%:
→ BUY 1: $250 worth of ETH

Price drops another 10%:
→ BUY 2: $375 worth of ETH (250 × 1.5)

Price drops another 10%:
→ BUY 3: $562.50 worth of ETH (250 × 1.5²)
```

---

## Multiple Strategies

You can have one strategy per trading pair. To add another pair:

1. Run `/config` again
2. Select a different pair
3. Configure parameters

---

## Modifying a Strategy

To change an existing strategy:

1. Run `/config`
2. Select the same pair
3. Enter new values
4. The old configuration is replaced

---

## Recommended Settings for Beginners

| Parameter | Recommended | Why |
|-----------|-------------|-----|
| Trigger % | 10-15% | Avoids over-trading |
| Trade % | 20-25% | Balanced exposure |
| Min Amount | $10-25 | Skips dust trades |
| Max Amount | $200-500 | Limits risk per trade |
| Multiplier | 1.2-1.5 | Gentle scaling |

---

## Next Steps

- [Managing Strategies](managing-strategies.md) - View and delete configurations
- [Viewing Performance](viewing-performance.md) - Track your results
