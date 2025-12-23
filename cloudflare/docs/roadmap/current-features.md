# Current Features

What's available today in LazaiTrader.

---

## Live Features

### User Management

| Feature | Status | Description |
|---------|--------|-------------|
| Telegram Registration | ✅ Live | Register via /start command |
| Wallet Linking | ✅ Live | Link your EOA for withdrawals |
| SCW Deployment | ✅ Live | Automatic wallet creation |

### Trading

| Feature | Status | Description |
|---------|--------|-------------|
| Automated Trading | ✅ Live | Price-triggered execution |
| Strategy Configuration | ✅ Live | Custom trigger/trade percentages |
| Multiple Pairs | ✅ Live | Trade different token pairs |
| Position Sizing | ✅ Live | Percentage-based with multiplier |

### Portfolio Management

| Feature | Status | Description |
|---------|--------|-------------|
| Balance Checking | ✅ Live | Real-time portfolio view |
| Deposit Detection | ✅ Live | Automatic balance updates |
| Withdrawal | ✅ Live | Send funds to your EOA |
| Performance Charts | ✅ Live | Visual trade history |
| PnL Tracking | ✅ Live | Profit/loss calculations |

---

## Supported Infrastructure

### Chains

| Chain | Status |
|-------|--------|
| Metis Andromeda | ✅ Active |

### DEXs

| DEX | Chain | Status |
|-----|-------|--------|
| HerculesDEX | Metis | ✅ Whitelisted |

### Trading Pairs

| Pair | Chain | Status |
|------|-------|--------|
| WETH-m.USDC | Metis | ✅ Active |
| WMetis-m.USDC | Metis | ✅ Active |

---

## How It All Works Together

```
┌─────────────────────────────────────────────────────────────┐
│                    Current LazaiTrader                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  User Journey:                                              │
│                                                             │
│  1. /start → Register EOA                                   │
│  2. /deposit → Deploy SCW, get address                      │
│  3. Send tokens → Fund your SCW                             │
│  4. /config → Set strategy parameters                       │
│  5. Bot monitors → Checks prices every minute               │
│  6. Trigger hit → Execute trade automatically               │
│  7. /chart → View performance                               │
│  8. /withdraw → Get your funds back                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Strategy Parameters

Current configurable settings:

| Parameter | Range | Purpose |
|-----------|-------|---------|
| Trigger % | 1-50% | Price change to trigger trade |
| Trade % | 1-100% | Balance portion per trade |
| Min Amount | $1+ | Skip small trades |
| Max Amount | $1+ | Cap large trades |
| Multiplier | 1.0-3.0 | Scale consecutive trades |

---

## Security Features

| Feature | Status |
|---------|--------|
| Non-custodial SCW | ✅ Active |
| Deterministic addresses | ✅ Active |
| DEX whitelist | ✅ Active |
| Owner-only withdrawals | ✅ Active |

---

## Notification System

| Event | Notification |
|-------|--------------|
| Trade executed | ✅ Telegram message |
| Trade skipped (below min) | ✅ Telegram message |
| Deposit detected | ✅ Balance update |
| Withdrawal complete | ✅ Telegram message |

---

## What's Working Well

### Strengths

- **Reliable execution** - Trades execute 24/7 without manual intervention
- **Low fees** - Metis L2 enables cost-effective trading
- **Security** - Non-custodial model protects user funds
- **Simplicity** - Telegram interface requires no technical knowledge

### User Feedback

Based on early users:
- Easy registration process
- Clear strategy configuration
- Useful performance charts
- Reliable trade notifications

---

## Known Limitations

### Current Constraints

| Limitation | Workaround |
|------------|------------|
| Single chain (Metis) | More chains coming |
| Limited pairs | Expanding based on demand |
| Fixed strategy types | More strategies planned |
| Basic suggestions | AI enhancement planned |

---

## Getting Started

Ready to try current features?

1. **Register:** Send `/start` to [@LazaiTraderBot](https://t.me/LazaiTraderBot)
2. **Set up wallet:** Use `/deposit`
3. **Fund:** Send tokens to your SCW
4. **Configure:** Use `/config`
5. **Monitor:** Use `/balance` and `/chart`

---

## What's Next

See our roadmap for upcoming features:

- [Cross-Chain Expansion](cross-chain-expansion.md) - More blockchains
- [AI Strategy Engine](ai-strategy-engine.md) - Intelligent trading
- [Strategy Vault](strategy-vault.md) - Copy trading
- [Security Enhancements](security-enhancements.md) - Recovery options
