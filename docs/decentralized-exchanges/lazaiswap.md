# LazaiSwap

A custom oracle-based DEX developed by LazaiTrader for predictable trade execution.

---

## Overview

LazaiSwap is a purpose-built decentralized exchange that uses oracle pricing instead of traditional AMM mechanics.

| Property | Value |
|----------|-------|
| **Type** | Oracle-Based |
| **Chain** | Testnet (Development) |
| **Status** | 🧪 Development |

{% hint style="info" %}
LazaiSwap is currently deployed on testnets for development and testing. Production deployment is planned for future releases.
{% endhint %}

---

## How Oracle-Based DEXs Work

### Traditional AMM Approach

```
Price = Pool Ratio
        └── Changes with every trade
        └── Slippage based on trade size
        └── MEV opportunities exist
```

### LazaiSwap Approach

```
Price = Oracle Value
        └── Set by trusted price feed
        └── Updated before trades
        └── Predictable execution
```

---

## Key Features

### Zero Slippage Execution

Trades execute at the exact oracle price:

| Aspect | AMM | LazaiSwap |
|--------|-----|-----------|
| Expected: $2,500 | ✓ | ✓ |
| Received: ~$2,475 | Possible | No |
| Slippage: ~1% | Possible | 0% |

### MEV Protection

No front-running or sandwich attacks:
- Price determined by oracle, not pool
- Trade order doesn't affect price
- Predictable outcomes

### Oracle-Updated Pricing

Before each trade cycle:
1. Fetch latest market price
2. Update oracle value
3. Execute trades at known price

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    LazaiSwap DEX                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────┐      ┌─────────────────┐              │
│  │   Token A Pool  │      │   Token B Pool  │              │
│  │   (e.g., ETH)   │      │   (e.g., USDC)  │              │
│  └─────────────────┘      └─────────────────┘              │
│           │                        │                        │
│           └────────┬───────────────┘                        │
│                    │                                        │
│           ┌────────▼────────┐                              │
│           │  Oracle Prices  │                              │
│           │                 │                              │
│           │  ETH→USDC: 2500 │                              │
│           │  USDC→ETH: 0.0004│                             │
│           └─────────────────┘                              │
│                    │                                        │
│           ┌────────▼────────┐                              │
│           │  swap(token,    │                              │
│           │       amount)   │                              │
│           └─────────────────┘                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## How Swaps Work

### Price Setting

Before trades execute:
```
Oracle Owner calls:
    setPrices(ethToUsdc: 2500, usdcToEth: 0.0004)
```

### Swap Execution

When you swap:
```
1. Send 1 ETH to contract
2. Contract calculates: 1 × 2500 = 2500 USDC
3. Contract sends 2500 USDC to you
4. No slippage, exact calculation
```

### Two-Way Pricing

Separate rates for each direction:
- **ETH → USDC:** Sell rate
- **USDC → ETH:** Buy rate

Allows for bid-ask spread if desired.

---

## Liquidity Model

### Managed Liquidity

Unlike AMMs where anyone provides liquidity:
- Protocol manages token reserves
- Sufficient liquidity ensured
- No impermanent loss concerns

### Liquidity Check

Before swaps complete:
```solidity
require(tokenOut.balanceOf(address(this)) >= amountOut,
        "Insufficient liquidity");
```

If insufficient liquidity:
- Swap reverts
- Your tokens returned
- No partial fills

---

## Integration with LazaiTrader

### Trade Flow

```
1. Trigger Detected
   └── Price moved 10%+

2. Update Oracle
   └── Bot updates DEX prices from market data

3. Execute Swap
   └── SCW calls swap() on LazaiSwap

4. Predictable Result
   └── Exact amount based on oracle price
```

### Price Synchronization

The bot ensures LazaiSwap prices match market:
1. Fetch current price from APIs
2. Update oracle on DEX
3. Execute trade immediately after

---

## Advantages

### For Traders

| Benefit | Description |
|---------|-------------|
| **Predictable costs** | Know exactly what you'll receive |
| **No MEV** | Can't be front-run |
| **Fair pricing** | Market rate from oracle |

### For Automated Trading

| Benefit | Description |
|---------|-------------|
| **Accurate triggers** | Trade at the price that triggered |
| **Better PnL** | No slippage eating profits |
| **Simpler math** | Exact calculations possible |

---

## Current Status

### Testnet Deployments

| Network | Address | Status |
|---------|---------|--------|
| Hyperion Testnet | `0x4704759E4a426b29615e4841B092357460925eFf` | Active |
| Zircuit Testnet | `0x547c2aBf7b604BfB9FfD8fADd678Bc9d449A39cD` | Active |

### Production Plans

LazaiSwap may be deployed to mainnet when:
- Testing complete
- Liquidity secured
- Security audited

---

## Comparison to AMMs

| Feature | LazaiSwap | HerculesDEX |
|---------|-----------|-------------|
| Price source | Oracle | Pool ratio |
| Slippage | Zero | Variable |
| MEV risk | None | Possible |
| Liquidity | Protocol | Community |
| Best for | Predictability | Deep liquidity |

---

## Security Considerations

### Oracle Trust

LazaiSwap relies on accurate oracle prices:
- Only trusted operators can update
- Prices verified against multiple sources
- Updates timestamped

### Smart Contract Security

Contract features:
- ReentrancyGuard protection
- SafeERC20 for token transfers
- Owner-only price setting
- Explicit token validation

---

## FAQs

### When will LazaiSwap be on mainnet?

LazaiSwap is currently in development on testnets. Mainnet deployment timeline will be announced in our roadmap updates.

### Can I provide liquidity to LazaiSwap?

Currently, liquidity is protocol-managed. Community liquidity provisions may be enabled in future versions.

### What if the oracle price is wrong?

Multiple safeguards:
- Prices from multiple sources
- Deviation checks
- Regular updates

---

## Further Reading

- [DEX Overview](overview.md) - DEX concepts
- [HerculesDEX](hercules-dex.md) - AMM comparison
- [Security](../security/how-funds-are-protected.md) - Protection measures
