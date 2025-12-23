# Viewing Performance

Track your trading results, view charts, and understand your profit and loss.

---

## Using /chart

Send `/chart` to view your trading performance:

```
/chart
```

The bot generates a visual chart and statistics:

```
📈 Your Trading Performance

[Chart Image]

📊 Statistics:
┌────────────────────┬─────────────┐
│ Total Trades       │ 25          │
│ Buy Orders         │ 15          │
│ Sell Orders        │ 10          │
│ First Trade        │ Jan 1,  │
│ Last Trade         │ Jan 20, │
└────────────────────┴─────────────┘

💰 Portfolio:
┌────────────────────┬─────────────┐
│ Total Deposited    │ $1,000.00   │
│ Total Withdrawn    │ $200.00     │
│ Current Value      │ $1,150.00   │
│ PnL                │ +$350.00    │
│ PnL %              │ +35.00%     │
└────────────────────┴─────────────┘

Tokens Traded: ETH, METIS
```

---

## Understanding the Chart

### Price Lines

Each token you've traded shows as a colored line:
- **ETH** - Blue line
- **BTC** - Orange line
- **METIS** - Green line

### Trade Markers

- **Green dots** - Buy orders (positioned at buy price)
- **Red dots** - Sell orders (positioned at sell price)

### Time Axis

Shows the date range from your first to last trade.

---

## PnL Calculation

Your Profit and Loss (PnL) is calculated using this formula:

```
PnL = Current Portfolio Value + Total Withdrawals - Total Deposits
```

### Example

```
Deposited: $1,000
Withdrawn: $200
Current Holdings: $1,150

PnL = $1,150 + $200 - $1,000 = $350 (35% profit)
```

### Why This Formula?

This properly accounts for:
- **Deposits** as money you put in (cost basis)
- **Withdrawals** as money you took out (realized gains)
- **Current holdings** as unrealized value

---

## Statistics Breakdown

| Metric | Description |
|--------|-------------|
| **Total Trades** | Number of executed trades |
| **Buy Orders** | Trades where you bought tokens |
| **Sell Orders** | Trades where you sold tokens |
| **First Trade** | Date of your earliest trade |
| **Last Trade** | Date of your most recent trade |
| **Tokens Traded** | All tokens you've traded |

---

## Portfolio Metrics

| Metric | Description |
|--------|-------------|
| **Total Deposited** | Sum of all deposits in USD |
| **Total Withdrawn** | Sum of all withdrawals in USD |
| **Current Value** | Present USD value of holdings |
| **PnL** | Absolute profit/loss in USD |
| **PnL %** | Percentage return on deposits |

---

## Token Normalization

The chart combines tokens across chains:

| Displayed | Includes |
|-----------|----------|
| ETH | WETH, ETH |
| USDC | m.USDC, USDC |
| METIS | WMetis, METIS |

This gives you a cleaner view of your overall exposure per asset.

---

## Reading Your Performance

### Positive Indicators

- **Green PnL** - You're in profit
- **More sells at higher prices** - Good timing
- **Upward portfolio trend** - Growing value

### Warning Signs

- **Negative PnL** - Currently at a loss
- **Many small trades** - May be over-trading (adjust trigger %)
- **Large consecutive trades** - High multiplier risk

---

## No Trading History

If you haven't traded yet:

```
📈 Trading Performance

No trading history found.

Set up a strategy with /config to start trading!
```

---

## Performance Tips

### Review Regularly

Check `/chart` weekly to:
- Understand your strategy's performance
- Identify if parameters need adjustment
- Track progress toward goals

### Compare to Market

Your PnL should be compared to:
- Simply holding the tokens (no trading)
- Market benchmarks
- Your investment goals

### Adjust Based on Results

If results aren't meeting expectations:
- **Too many trades?** → Increase trigger %
- **Missing moves?** → Decrease trigger %
- **Positions too small?** → Increase trade %
- **Too much risk?** → Decrease multiplier

---

## Data Privacy

Your trading data is:
- Stored securely in our database
- Used only for your performance tracking
- Not shared with third parties
- Available only to you via Telegram

---

## Next Steps

- [Adjust Your Strategy](configuring-strategies.md) - Fine-tune parameters
- [Check Balances](checking-balances.md) - See current holdings
- [Commands Reference](commands-reference.md) - All available commands
