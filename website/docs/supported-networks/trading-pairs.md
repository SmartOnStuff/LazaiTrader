# Trading Pairs

Available trading pairs for automated strategies on each chain.

---

## Active Trading Pairs

### Metis Andromeda

| Pair | Base Token | Quote Token | DEX | Status |
|------|------------|-------------|-----|--------|
| **WETH-m.USDC** | WETH | m.USDC | HerculesDEX | ✅ Active |
| **WMetis-m.USDC** | WMetis | m.USDC | HerculesDEX | ✅ Active |

---

## Pair Details

### WETH-m.USDC

| Property | Value |
|----------|-------|
| **Base Token** | WETH (Wrapped ETH) |
| **Quote Token** | m.USDC |
| **DEX** | HerculesDEX (CamelotYakRouter) |
| **DEX Address** | `0xF9a6d89DCCb139E26da4b9DF00796C980b5975d2` |
| **Chain** | Metis Andromeda |

**Use Case:**
- Trade ETH against USD
- Rebalance ETH/USD exposure
- Buy dips in ETH
- Take profits on ETH rallies

### WMetis-m.USDC

| Property | Value |
|----------|-------|
| **Base Token** | WMetis (Wrapped Metis) |
| **Quote Token** | m.USDC |
| **DEX** | HerculesDEX (CamelotYakRouter) |
| **DEX Address** | `0xF9a6d89DCCb139E26da4b9DF00796C980b5975d2` |
| **Chain** | Metis Andromeda |

**Use Case:**
- Trade METIS against USD
- Exposure to Metis ecosystem
- Rebalance METIS holdings

---

## Understanding Trading Pairs

### Base vs Quote Token

| Term | Description | Example |
|------|-------------|---------|
| **Base Token** | What you're buying/selling | ETH in ETH-USDC |
| **Quote Token** | What you're pricing in | USDC in ETH-USDC |

### Trade Actions

| Action | What Happens |
|--------|--------------|
| **BUY** | Sell quote token, receive base token |
| **SELL** | Sell base token, receive quote token |

**Example with WETH-m.USDC:**
- BUY: Spend USDC → Receive ETH
- SELL: Spend ETH → Receive USDC

---

## Price Monitoring

For each pair, the system:

1. **Fetches price** from multiple sources
2. **Caches locally** to reduce API calls
3. **Compares** to your last trade price
4. **Triggers** when threshold crossed

### Price Sources

Prices are normalized across sources:

| Pair Symbol | Price Feed |
|-------------|------------|
| WETH-m.USDC | ETH-USDC |
| WMetis-m.USDC | METIS-USDC |

---

## Testnet Pairs (Development Only)

### Hyperion Testnet

| Pair | DEX | Status |
|------|-----|--------|
| tgMetis-tgUSDC | LazaiSwap | 🧪 Dev |
| tgETH-tgUSDC | LazaiSwap | 🧪 Dev |

### Zircuit Garfield Testnet

| Pair | DEX | Status |
|------|-----|--------|
| tETH-tUSDC | LazaiSwap | 🧪 Dev |

---

## Configuring a Pair

To trade a pair, configure a strategy with `/config`:

```
/config

Select chain: [Metis Andromeda]

Select pair: [WETH-m.USDC] [WMetis-m.USDC]

Enter trigger percentage: 10

Enter trade percentage: 25

...
```

### One Strategy Per Pair

You can have **one active strategy per trading pair**. To trade both pairs:
- Run `/config` for WETH-m.USDC
- Run `/config` again for WMetis-m.USDC

---

## Adding New Pairs

New trading pairs are added when:

| Requirement | Description |
|-------------|-------------|
| Liquidity | Sufficient DEX liquidity exists |
| Price Feed | Reliable price data available |
| Token Support | Both tokens already supported |
| User Demand | Requested by users |

### Request a Pair

Want to trade a pair that's not available? Let us know! We evaluate requests based on:
- Liquidity depth
- Price feed reliability
- Trading volume
- User interest

---

## Trading Flow

When a trigger condition is met for your pair:

```
1. Price Trigger
   └─ ETH rises 10% from last trade

2. Action Determined
   └─ SELL (price went up)

3. Amount Calculated
   └─ 25% of ETH balance

4. Trade Executed
   └─ WETH → m.USDC on HerculesDEX

5. Notification Sent
   └─ Telegram message with details
```

---

## Pair Performance

View performance per pair with `/chart`:

- Price lines for each traded token
- Buy/sell markers
- PnL breakdown

---

## FAQs

### Can I trade BTC on Metis?

Currently, we don't have BTC pairs on Metis. BTC pairs will be available when:
- Wrapped BTC has liquidity on Metis
- Price feeds are configured
- DEX supports the pair

### Why USDC as quote for all pairs?

USDC provides:
- Stable pricing (dollar denominated)
- High liquidity
- Easy PnL calculation
- Consistent experience

### Can I have multiple strategies for one pair?

No, each pair supports one strategy. Modify your existing strategy with `/config` if you want to change parameters.

---

## Further Reading

- [Tokens](tokens) - Token details
- [HerculesDEX](../decentralized-exchanges/hercules-dex) - DEX information
- [Configuring Strategies](../user-guide/configuring-strategies) - Setup guide
