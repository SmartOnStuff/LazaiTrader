# Supported Chains

LazaiTrader currently operates on select EVM-compatible blockchains with plans for expansion.

---

## Active Chains

### Metis Andromeda

| Property | Value |
|----------|-------|
| **Status** | ✅ Active |
| **Chain ID** | 1088 |
| **Native Currency** | METIS |
| **RPC Endpoint** | `https://andromeda.metis.io` |
| **Block Explorer** | [explorer.metis.io](https://explorer.metis.io) |

**About Metis:**
Metis is a Layer 2 scaling solution built on Ethereum. It offers fast transactions, low fees, and EVM compatibility. LazaiTrader launched on Metis to provide users with cost-effective automated trading.

**Why Metis?**
- Low transaction fees (fractions of a cent)
- Fast confirmation times (~2 seconds)
- Strong DeFi ecosystem (HerculesDEX, etc.)
- Ethereum security inherited via rollup

---

## Coming Soon

### Zircuit

| Property | Value |
|----------|-------|
| **Status** | 🔜 Coming Soon |
| **Chain ID** | 48900 |
| **Native Currency** | ETH |
| **Block Explorer** | [explorer.zircuit.com](https://explorer.zircuit.com) |

**About Zircuit:**
Zircuit is an EVM-compatible ZK rollup with built-in security features. It provides sequencer-level security to protect users from malicious transactions.

---

## Planned Chains

### Ethereum Mainnet

| Property | Value |
|----------|-------|
| **Status** | 📋 Planned |
| **Chain ID** | 1 |
| **Native Currency** | ETH |

**Considerations:**
- Higher gas fees
- Maximum liquidity
- Widest DEX support

### Base

| Property | Value |
|----------|-------|
| **Status** | 📋 Planned |
| **Chain ID** | 8453 |
| **Native Currency** | ETH |

**About Base:**
Base is Coinbase's Layer 2 network, offering low fees and strong institutional backing.

---

## Testnet Chains

These chains are used for development and testing only.

### Zircuit Garfield Testnet

| Property | Value |
|----------|-------|
| **Status** | 🧪 Development Only |
| **Chain ID** | 48898 |
| **Native Currency** | ETH |
| **RPC Endpoint** | `https://zircuit-garfield-testnet.drpc.org` |

### Hyperion Testnet (Metis)

| Property | Value |
|----------|-------|
| **Status** | 🧪 Development Only |
| **Chain ID** | 133717 |
| **Native Currency** | tMETIS |
| **RPC Endpoint** | `https://hyperion-testnet.metisdevops.link` |

{% hint style="warning" %}
**Do not send real funds to testnet addresses!** Testnet chains use test tokens with no real value.
{% endhint %}

---

## Chain Comparison

| Chain | Status | Fees | Speed | DEX Support |
|-------|--------|------|-------|-------------|
| Metis Andromeda | ✅ Live | Very Low | ~2s | HerculesDEX |
| Zircuit | 🔜 Soon | Low | ~2s | TBD |
| Ethereum | 📋 Planned | High | ~12s | Many |
| Base | 📋 Planned | Low | ~2s | Many |

---

## Cross-Chain Architecture

### Same Address Everywhere

Your Smart Contract Wallet has the **same address** on all chains:

```
Metis:    0x1234...abcd
Zircuit:  0x1234...abcd  (same!)
Ethereum: 0x1234...abcd  (same!)
Base:     0x1234...abcd  (same!)
```

This is possible because:
1. Same factory contract deployed on each chain
2. CREATE2 deterministic deployment
3. Your EOA is the consistent input

### Factory Deployment

Before trading is available on a new chain:
1. Factory contract must be deployed
2. DEXs must be whitelisted
3. Trading pairs must be configured
4. Infrastructure must be set up

---

## Adding Your Tokens

When a new chain is added:

1. **No action needed** - Your SCW address already exists
2. **Wait for activation** - Trading infrastructure must be ready
3. **Deposit when ready** - Bot will announce availability
4. **Configure strategies** - Set up pairs on the new chain

---

## Network Status

Check current network status in the bot:

```
/deposit

📥 Your Deposit Address

0x1234567890abcdef1234567890abcdef12345678

Active chains:
✅ Metis Andromeda - Ready
⏳ Zircuit - Coming soon
```

---

## FAQs

### Why not Ethereum mainnet first?

Gas fees on Ethereum can make small trades unprofitable. Layer 2 solutions like Metis provide better economics for automated trading.

### When will [chain] be added?

Check our [Roadmap](../roadmap/cross-chain-expansion.md) for the latest plans. We prioritize chains based on:
- User demand
- DEX availability
- Gas economics
- Security considerations

### Can I request a chain?

Yes! Let us know which chains you'd like to see supported. User demand influences our priorities.

---

## Further Reading

- [Tokens](tokens.md) - Supported tokens per chain
- [Trading Pairs](trading-pairs.md) - Available pairs
- [Cross-Chain Expansion](../roadmap/cross-chain-expansion.md) - Future plans
