# Checking Balances

Monitor your portfolio value and token holdings with the `/balance` command.

---

## Viewing Your Balances

Send `/balance` to see your current holdings:

```
/balance
```

The bot will respond with your complete portfolio:

```
💰 Your Portfolio

Metis Andromeda:
┌────────────┬───────────┬──────────┐
│ Token      │ Balance   │ Value    │
├────────────┼───────────┼──────────┤
│ WETH       │ 0.5000    │ $1,250.00│
│ m.USDC     │ 500.00    │ $500.00  │
│ WMetis     │ 10.00     │ $450.00  │
└────────────┴───────────┴──────────┘

📊 Total Value: $2,200.00

Last Updated: -01-15 14:30:00 UTC
```

---

## Understanding the Display

### Token Information

| Column | Description |
|--------|-------------|
| **Token** | The token symbol |
| **Balance** | Your holdings in that token |
| **Value** | USD equivalent based on current price |

### Price Sources

Token prices are fetched from multiple sources:
- Binance
- CoinGecko
- DEXScreener
- Coinbase

The system automatically falls back to alternative sources if one is unavailable.

---

## Multi-Chain Balances

When multiple chains are active, balances are shown per chain:

```
💰 Your Portfolio

Metis Andromeda:
• 0.5 WETH ($1,250.00)
• 500 m.USDC ($500.00)

Zircuit: (Coming Soon)
• Chain not yet active

📊 Total Value: $1,750.00
```

---

## Balance Updates

### Automatic Updates

The balance tracker runs every **5 minutes** to:
- Fetch on-chain balances
- Update USD valuations
- Detect new deposits

### Manual Refresh

Each time you send `/balance`, the bot fetches fresh data from the blockchain.

---

## Interpreting Your Balance

### Available for Trading

Your entire SCW balance is available for automated trading based on your strategy settings. When a trade triggers:

```
Trade Amount = Balance × Trade Percentage × Multiplier Factor
```

### Example

With 1 ETH and a 25% trade percentage:
- Trade size = 0.25 ETH per trigger
- Remaining = 0.75 ETH for future trades

---

## Balance History

Your balance is tracked over time for:
- **Deposit detection** - Identifying incoming funds
- **PnL calculation** - Measuring trading performance
- **Charts** - Visualizing portfolio changes

View your historical performance with `/chart`.

---

## Zero Balances

If you see zero balances:

```
💰 Your Portfolio

No balances found.

Use /deposit to get your wallet address and fund it.
```

This means:
- You haven't deposited yet, OR
- Your deposits haven't been detected yet

:::tip
Wait 5 minutes after depositing, then try `/balance` again.
:::

---

## Troubleshooting

### Balance Shows Zero After Deposit

1. **Check transaction status** - Ensure it's confirmed on the block explorer
2. **Verify the address** - Did you send to your SCW address?
3. **Check the network** - Did you send on Metis Andromeda?
4. **Wait for detection** - Auto-detection runs every 5 minutes

### Value Seems Wrong

Price data updates periodically. Small discrepancies are normal due to:
- Price volatility between updates
- Different price sources
- Stablecoin slight depegs

### Token Not Showing

Only supported tokens appear in the balance view. If you sent an unsupported token:
- It's still in your SCW
- It won't appear in balances
- It can't be traded (yet)
- Contact support if you need to recover it

---

## Next Steps

- [Configure Strategies](configuring-strategies) - Start automated trading
- [View Performance](viewing-performance) - See your trade history
