# HerculesDEX

The primary decentralized exchange for LazaiTrader on Metis Andromeda.

---

## Overview

HerculesDEX is a leading DEX on Metis Andromeda, utilizing the CamelotYakRouter for efficient token swaps.

| Property | Value |
|----------|-------|
| **Type** | AMM (Automated Market Maker) |
| **Chain** | Metis Andromeda |
| **Router Address** | `0xF9a6d89DCCb139E26da4b9DF00796C980b5975d2` |
| **Status** | ✅ Whitelisted |

---

## How AMM DEXs Work

### Liquidity Pools

HerculesDEX uses liquidity pools - smart contracts holding token pairs:

```
┌─────────────────────────────────────────┐
│          ETH-USDC Pool                   │
│                                         │
│   ETH Reserve: 1,000 ETH                │
│   USDC Reserve: 2,500,000 USDC          │
│                                         │
│   Price: 2,500,000 / 1,000 = $2,500/ETH │
└─────────────────────────────────────────┘
```

### Constant Product Formula

Prices adjust automatically based on trades:

```
x * y = k (constant)

Before trade: 1,000 ETH × 2,500,000 USDC = 2,500,000,000
After selling 10 ETH: 1,010 ETH × 2,475,248 USDC = 2,500,000,000
New price: $2,450/ETH
```

### Slippage

Larger trades move the price more:

| Trade Size | Pool Impact | Slippage |
|------------|-------------|----------|
| 0.1 ETH | Minimal | ~0.01% |
| 1 ETH | Small | ~0.1% |
| 10 ETH | Moderate | ~1% |
| 100 ETH | Significant | ~10%+ |

---

## LazaiTrader Integration

### Router Type

LazaiTrader uses the **CamelotYakRouter** interface:
- Optimized routing
- Multi-hop support
- Gas efficient

### Supported Pairs

| Pair | Pool Address |
|------|--------------|
| WETH-m.USDC | Via router |
| WMetis-m.USDC | Via router |

### Trade Flow

```
1. Bot detects trigger condition
2. Calculates trade amount
3. Calls SCW.executeTrade()
4. SCW approves tokens for router
5. Router finds best path
6. Swap executed
7. Tokens received in SCW
```

---

## Advantages

### Deep Liquidity

HerculesDEX has significant liquidity on Metis:
- Established pools
- Active liquidity providers
- Competitive rates

### Proven Technology

Built on battle-tested AMM mechanics:
- Similar to Uniswap/Camelot
- Well-understood behavior
- Predictable execution

### Multi-Hop Routing

Can route through multiple pools for better rates:
```
WETH → METIS → USDC
(if better than direct WETH → USDC)
```

---

## Considerations

### Slippage

For large trades relative to pool size:
- Price impact increases
- May receive less than expected
- Min/max settings help protect

### MEV (Miner Extractable Value)

AMM trades can be subject to:
- Front-running
- Sandwich attacks
- Arbitrage

{% hint style="info" %}
LazaiTrader's min/max amount settings help limit exposure to these risks.
{% endhint %}

### Impermanent Loss (for LPs)

Not applicable to traders - this affects liquidity providers only.

---

## Trade Execution Details

### Approval Flow

Before swapping:
```
1. Bot calls SCW.approveToken(WETH, router, amount)
2. SCW approves router to spend WETH
3. Router can now execute swap
```

### Swap Call

```javascript
router.swap({
    tokenIn: WETH,
    tokenOut: USDC,
    amountIn: 0.25 ETH,
    amountOutMin: calculated based on slippage tolerance,
    recipient: SCW address
})
```

### Result

```
Sent: 0.25 WETH
Received: 624.50 m.USDC
Fee: ~0.3%
Slippage: ~0.1%
```

---

## Verifying Trades

All trades are on-chain and verifiable:

1. **Find transaction hash** from bot notification
2. **Open Metis Explorer** - [explorer.metis.io](https://explorer.metis.io)
3. **Search transaction hash**
4. **View details:**
   - Tokens transferred
   - Amounts
   - Gas used
   - Contract interactions

---

## Fee Structure

| Fee Type | Amount | Recipient |
|----------|--------|-----------|
| Swap fee | ~0.3% | Liquidity providers |
| Gas | Variable | Network |
| Platform fee | 0% | LazaiTrader takes nothing |

---

## FAQs

### Why HerculesDEX over other Metis DEXs?

- Deepest liquidity for target pairs
- Reliable router implementation
- Active development and support

### Can I add liquidity through LazaiTrader?

No, LazaiTrader is for trading only. To provide liquidity:
1. Withdraw funds to your EOA
2. Add liquidity directly on HerculesDEX

### What if liquidity dries up?

Trades may fail or have high slippage. The bot:
- Detects failed trades
- Notifies you of issues
- Can skip trades below minimum

---

## Further Reading

- [DEX Overview](overview.md) - General DEX concepts
- [Trading Pairs](../supported-networks/trading-pairs.md) - Available pairs
- [DEX Whitelist Protection](../security/dex-whitelist.md) - Security measures
