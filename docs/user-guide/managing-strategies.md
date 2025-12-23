# Managing Strategies

View your active strategies and remove ones you no longer need.

---

## Viewing Active Strategies

### Using /myconfig

Send `/myconfig` to see all your active configurations:

```
/myconfig
```

Response:

```
📊 Your Active Strategies

Strategy 1: WETH-m.USDC on Metis
┌────────────────────┬─────────────┐
│ Trigger            │ 10%         │
│ Trade Size         │ 25%         │
│ Min/Max            │ $10 / $500  │
│ Multiplier         │ 1.5x        │
│ Status             │ ✅ Active    │
│ Created            │ Jan 15, │
└────────────────────┴─────────────┘

Strategy 2: WMetis-m.USDC on Metis
┌────────────────────┬─────────────┐
│ Trigger            │ 15%         │
│ Trade Size         │ 20%         │
│ Min/Max            │ $25 / $300  │
│ Multiplier         │ 1.2x        │
│ Status             │ ✅ Active    │
│ Created            │ Jan 18, │
└────────────────────┴─────────────┘

Total: 2 active strategies
```

---

## Strategy Details Explained

| Field | Description |
|-------|-------------|
| **Trigger** | Price change percentage that triggers trades |
| **Trade Size** | Percentage of balance used per trade |
| **Min/Max** | USD bounds for trade amounts |
| **Multiplier** | Scaling factor for consecutive trades |
| **Status** | Active = monitoring and trading |
| **Created** | When the strategy was set up |

---

## Deleting a Strategy

### Using /deleteconfig

Send `/deleteconfig` to remove a strategy:

```
/deleteconfig
```

Response:

```
🗑️ Delete Strategy

Select a strategy to delete:

[WETH-m.USDC (Metis)]
[WMetis-m.USDC (Metis)]
[Cancel]
```

### Confirmation

After selecting a strategy:

```
⚠️ Confirm Deletion

Are you sure you want to delete this strategy?

Pair: WETH-m.USDC
Chain: Metis Andromeda

This will stop all automated trading for this pair.
Your funds will NOT be affected.

[Yes, Delete] [Cancel]
```

### After Deletion

```
✅ Strategy Deleted

WETH-m.USDC strategy has been removed.

• Automated trading stopped for this pair
• Your balance is unchanged
• You can recreate with /config anytime

Active strategies remaining: 1
```

---

## What Happens When You Delete

| Aspect | Effect |
|--------|--------|
| **Trading** | Stops immediately for that pair |
| **Funds** | Remain in your SCW (unchanged) |
| **History** | Trade history is preserved |
| **Pending Trades** | Cancelled if not yet executed |

{% hint style="info" %}
Deleting a strategy does NOT withdraw your funds. Your tokens stay in your SCW until you explicitly withdraw them.
{% endhint %}

---

## Modifying vs Deleting

### To Modify a Strategy

You don't need to delete first:
1. Run `/config`
2. Select the same trading pair
3. Enter new parameters
4. Old config is replaced automatically

### To Pause Trading

Currently, there's no pause function. Options:
- **Delete the strategy** (you can recreate later)
- **Set very high trigger %** (e.g., 99%) - trades won't trigger

---

## Strategy Limits

| Limit | Value |
|-------|-------|
| Strategies per user | Unlimited |
| Strategies per pair | 1 (one per trading pair) |
| Active chains | As supported |

---

## Common Questions

### Can I have multiple strategies for the same pair?

No. Each trading pair can have only one strategy. If you want different parameters, modify the existing one.

### What if I delete all strategies?

Your funds remain in your SCW. You can:
- Create new strategies anytime
- Withdraw funds with `/withdraw`
- Leave funds for future trading

### Does deleting affect my trade history?

No. All past trades are preserved in your history and visible in `/chart`.

---

## Next Steps

- [Configure a New Strategy](configuring-strategies.md)
- [Withdraw Funds](withdrawing-funds.md)
- [View Performance](viewing-performance.md)
