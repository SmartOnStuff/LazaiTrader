# DEX Overview

How LazaiTrader integrates with decentralized exchanges to execute your trades.

---

## What is a DEX?

A Decentralized Exchange (DEX) is a smart contract that enables token swaps without a central authority:

| Feature | Centralized Exchange | Decentralized Exchange |
|---------|---------------------|------------------------|
| Custody | Exchange holds funds | You hold funds |
| Registration | KYC required | No registration |
| Availability | Business hours / regions | 24/7 global |
| Trust | Trust the exchange | Trust the code |

---

## DEX Types We Support

LazaiTrader integrates with two types of DEX architecture:

### 1. AMM (Automated Market Maker)

**Example:** HerculesDEX (CamelotYakRouter)

How it works:
- Liquidity pools hold token pairs
- Price determined by pool ratios
- Slippage based on trade size vs pool size
- Anyone can provide liquidity

**Best for:**
- Large liquidity
- Standard token swaps
- Market-driven pricing

### 2. Oracle-Based

**Example:** LazaiSwap (Custom)

How it works:
- Oracle sets current market price
- Trades execute at oracle price
- Zero slippage (if liquidity available)
- Price updated before each trade

**Best for:**
- Predictable pricing
- No MEV/sandwich attacks
- Exact execution price

---

## Integration Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Your SCW                                 │
│                                                             │
│  executeTrade(dex, swapData)                                │
│        │                                                    │
│        ▼                                                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Check Whitelist                         │   │
│  │         Is DEX approved? ───► Yes ──────────────────┼───┼─►
│  │                         └──► No ──► REVERT          │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Whitelisted DEX                           │
│                                                             │
│  ┌──────────────────┐    ┌──────────────────┐              │
│  │  HerculesDEX     │    │   LazaiSwap      │              │
│  │  (AMM)           │    │   (Oracle)       │              │
│  │                  │    │                  │              │
│  │  swap(...)       │    │  swap(...)       │              │
│  │  ↓               │    │  ↓               │              │
│  │  Price from pool │    │  Price from      │              │
│  │                  │    │  oracle          │              │
│  └──────────────────┘    └──────────────────┘              │
└─────────────────────────────────────────────────────────────┘
```

---

## Currently Whitelisted DEXs

| DEX | Type | Chain | Address |
|-----|------|-------|---------|
| HerculesDEX | AMM | Metis | `0xF9a6d89DCCb139E26da4b9DF00796C980b5975d2` |
| LazaiSwap | Oracle | Testnet | Various |

---

## Trade Execution Flow

### Step 1: Trigger Detection

Bot monitors prices every minute:
```
Current ETH: $3,400
Last Trade: $3,000
Change: +13.3%
Trigger: 10%
→ Trigger met!
```

### Step 2: Amount Calculation

```
Balance: 1 ETH
Trade %: 25%
→ Trade 0.25 ETH
```

### Step 3: DEX Selection

For each trading pair, a specific DEX is configured:
```
WETH-m.USDC → HerculesDEX
```

### Step 4: Trade Execution

Bot calls your SCW:
```
SCW.executeTrade(
    dex: 0xF9a6d8...,
    data: [swap function call]
)
```

### Step 5: Swap Completes

DEX processes the swap:
```
Send: 0.25 ETH
Receive: ~$850 USDC (minus slippage/fees)
```

---

## Slippage Considerations

### AMM DEXs (HerculesDEX)

Slippage varies based on:
- Trade size relative to pool
- Current pool liquidity
- Market volatility

**Protection:** Min/max amount settings help avoid bad fills.

### Oracle DEXs (LazaiSwap)

Minimal slippage because:
- Price set by oracle
- Executes at known price
- No pool ratio dependency

---

## Why Multiple DEX Types?

Each DEX type has trade-offs:

| Aspect | AMM | Oracle |
|--------|-----|--------|
| Liquidity | Community-provided | Protocol-managed |
| Price discovery | Market-driven | Oracle-fed |
| MEV risk | Possible | Minimal |
| Availability | Always (if liquidity) | Depends on oracle |
| Best use | High liquidity pairs | Predictable execution |

LazaiTrader selects the best DEX for each trading pair.

---

## Security Measures

### Whitelist Protection

Only pre-approved DEXs can be called:
- Verified contract code
- Established track record
- Sufficient liquidity

### Trade Validation

Before execution:
- Check trigger still valid
- Verify amounts within limits
- Confirm DEX whitelisted

### Post-Trade Verification

After execution:
- Confirm tokens received
- Record transaction
- Notify user

---

## DEX-Specific Details

For detailed information on each DEX:

- [HerculesDEX](hercules-dex.md) - Main DEX on Metis
- [LazaiSwap](lazaiswap.md) - Custom oracle-based DEX

---

## FAQs

### Why can't I choose which DEX to use?

Trading pairs are configured with specific DEXs based on:
- Best liquidity for that pair
- Most reliable execution
- Lowest fees

This ensures optimal trades without requiring DEX expertise.

### What happens if a DEX fails?

If a trade fails:
- Transaction reverts
- Your funds stay in SCW
- Error logged
- May retry automatically

### Can new DEXs be added?

Yes. New DEXs go through:
1. Security review
2. Liquidity verification
3. Test integration
4. Whitelist addition
5. User announcement
