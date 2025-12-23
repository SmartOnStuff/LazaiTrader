# Cross-Chain Expansion

Bringing LazaiTrader to more blockchains.

---

## Vision

LazaiTrader's deterministic address system means your Smart Contract Wallet can exist at the **same address on every EVM chain**. Our goal is to leverage this to provide seamless multi-chain trading.

---

## Expansion Plans

### Priority Chains

| Chain | Status | Priority | Rationale |
|-------|--------|----------|-----------|
| **Zircuit** | 🔜 Coming Soon | High | ZK security, growing ecosystem |
| **Ethereum** | 📋 Planned | High | Maximum liquidity, widest adoption |
| **Base** | 📋 Planned | Medium | Low fees, Coinbase ecosystem |

---

## Zircuit Integration

### Why Zircuit?

Zircuit is a ZK rollup with built-in security features:
- **Sequencer-level security** - Protects against malicious transactions
- **EVM compatible** - Easy integration
- **Low fees** - Cost-effective trading
- **Growing DeFi** - Emerging DEX ecosystem

### What to Expect

- Same SCW address as Metis
- New trading pairs
- Integrated DEX support
- Unified portfolio view

---

## Ethereum Mainnet

### Why Ethereum?

Despite higher fees, Ethereum offers:
- **Maximum liquidity** - Deepest pools
- **Most DEXs** - Uniswap, Curve, etc.
- **Institutional adoption** - Widest acceptance
- **Security** - Most battle-tested

### Considerations

| Aspect | Challenge | Approach |
|--------|-----------|----------|
| Gas fees | High costs | Larger minimum trades |
| Competition | Many bots | Optimized execution |
| MEV | Front-running risk | MEV-protected submission |

---

## Base Integration

### Why Base?

Base is Coinbase's L2 solution:
- **Low fees** - L2 economics
- **Coinbase backing** - Institutional trust
- **Growing liquidity** - Active ecosystem
- **Easy onboarding** - Coinbase integration

### Expected Features

- Standard LazaiTrader functionality
- Popular Base DEX integration
- Additional trading pairs

---

## Technical Implementation

### Same Address Guarantee

Your SCW will be at the same address because:

```
SCW Address = CREATE2(factory, salt, bytecode)

Where:
- factory = Same on all chains (0xe053618...)
- salt = Based on YOUR EOA (unchanged)
- bytecode = Identical contract code
```

### Deployment Process

For each new chain:
1. Deploy FactoryDeployer
2. Deploy Factory (same address guaranteed)
3. Whitelist DEXs
4. Configure trading pairs
5. Activate trading

---

## Multi-Chain Benefits

### For Users

| Benefit | Description |
|---------|-------------|
| **One address** | Same SCW everywhere |
| **Unified view** | See all balances together |
| **Consistent UX** | Same commands, any chain |
| **Arbitrage potential** | Trade across chains |

### For Trading

| Benefit | Description |
|---------|-------------|
| **More pairs** | Access chain-specific tokens |
| **Better liquidity** | Trade where liquidity is deepest |
| **Fee optimization** | Choose chain based on costs |

---

## User Experience

### What Changes?

Very little! Multi-chain will be intuitive:

```
/balance

💰 Your Portfolio

Metis Andromeda:
• WETH: 0.5 ($1,250)
• m.USDC: 500 ($500)

Zircuit:
• ETH: 0.3 ($750)
• USDC: 300 ($300)

Ethereum:
• WETH: 1.0 ($2,500)

Total: $5,300
```

### Deposits

Same address on any chain:
```
Your SCW: 0x1234...abcd

Deposit on:
✅ Metis - Active
✅ Zircuit - Active
✅ Ethereum - Active
```

### Strategy Configuration

Per-chain strategies:
```
/config

Select chain:
[Metis] [Zircuit] [Ethereum]

Select pair:
[ETH-USDC] [METIS-USDC]
```

---

## Timeline

:::info
Specific dates are not provided. Development priorities may shift based on ecosystem developments and user demand.
:::

### Near-Term
- Zircuit integration
- Additional Metis pairs

### Medium-Term
- Ethereum mainnet
- Base integration

### Long-Term
- Additional L2s based on demand
- Cross-chain trading features

---

## How You Can Help

### Request Chains

Let us know which chains you want:
- Active DeFi ecosystem
- Tokens you want to trade
- Liquidity availability

### Test Early

- Join testnet releases
- Provide feedback
- Report issues

---

## FAQs

### Will my current strategy work on new chains?

You'll need to create new strategies for each chain/pair, but the process is identical.

### Do I need to do anything when new chains launch?

No! Your SCW address already exists. Just deposit and configure strategies.

### Will there be cross-chain trading?

Not initially. Each chain operates independently. Cross-chain features are being researched.

---

## Further Reading

- [Current Features](current-features) - What's live now
- [Deterministic Addresses](../security/deterministic-addresses) - How same-address works
- [Chains](../supported-networks/chains) - Current chain support
