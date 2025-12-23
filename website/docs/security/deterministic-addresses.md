# Deterministic Addresses

How LazaiTrader gives you the same wallet address on every blockchain.

---

## The Problem with Multi-Chain

Traditionally, deploying a smart contract on different blockchains results in different addresses:

```
Chain A: 0xabc123...
Chain B: 0xdef456...
Chain C: 0x789xyz...
```

This creates problems:
- Confusing to manage multiple addresses
- Risk of sending to wrong address on wrong chain
- Harder to track total portfolio

---

## Our Solution: Same Address Everywhere

LazaiTrader uses **CREATE2** deployment to give you the same Smart Contract Wallet address on every supported chain:

```
Metis:    0x1234567890abcdef1234567890abcdef12345678
Zircuit:  0x1234567890abcdef1234567890abcdef12345678
Ethereum: 0x1234567890abcdef1234567890abcdef12345678
Base:     0x1234567890abcdef1234567890abcdef12345678
          ↑ Same address on all chains!
```

---

## What This Means for You

### Simplified Management

- **One address to remember** - Works on all chains
- **No confusion** - Can't mix up chain-specific addresses
- **Future-proof** - New chains will use the same address

### Safer Deposits

- Send to the same address regardless of chain
- Less risk of sending to wrong address
- Consistent experience across networks

### Portfolio Clarity

- All holdings linked to one address
- Easy to verify on any block explorer
- Clear ownership across chains

---

## How It Works (Simplified)

:::info
This section explains the technology at a high level. You don't need to understand this to use LazaiTrader.
:::

### Normal Contract Deployment

```
Address = hash(deployer, nonce)
         ↑ Different each time
```

Regular deployments depend on the nonce (transaction count), which differs per chain.

### CREATE2 Deployment

```
Address = hash(factory, salt, code)
         ↑ Predictable!
```

CREATE2 uses:
- **Factory address** - Same on all chains
- **Salt** - Derived from your wallet address
- **Code** - Same contract on all chains

Since all inputs are the same, the output address is the same.

### The Magic

```
Your EOA: 0x742d35Cc...

Salt = hash(0x742d35Cc..., "LazaiTrader_v1")

SCW Address = CREATE2(factory, salt, walletCode)
            = 0x1234567890...  ← Same everywhere!
```

---

## Pre-Deployment Verification

Before we deploy your SCW, the system:

1. **Calculates** the expected address
2. **Verifies** it matches on all chains
3. **Deploys** only if addresses match
4. **Confirms** deployment success

This ensures your address is truly deterministic.

---

## Cross-Chain Safety

### What's Guaranteed

| Property | Guaranteed |
|----------|------------|
| Same address on all deployed chains | ✅ Yes |
| Same owner (your EOA) | ✅ Yes |
| Same security rules | ✅ Yes |
| Same withdrawal destination | ✅ Yes |

### What to Know

| Consideration | Details |
|---------------|---------|
| Chain must be supported | Not all chains have factory yet |
| Factory must be deployed | We handle this |
| Gas for deployment | We pay, you don't |

---

## Current Deployment Status

| Chain | Factory Deployed | Your SCW Ready |
|-------|------------------|----------------|
| Metis Andromeda | ✅ Yes | ✅ Auto-deployed |
| Zircuit | ✅ Yes | ⏳ Coming soon |
| Ethereum | 🔜 Planned | - |
| Base | 🔜 Planned | - |

---

## Practical Benefits

### Scenario 1: Adding a New Chain

When we add support for a new chain:
- Your address is already known
- Just needs deployment transaction
- Same address, no changes needed

### Scenario 2: Sending from Any Source

Whether you send from:
- A centralized exchange
- Another wallet
- A friend

Same address works on any supported chain.

### Scenario 3: Recovery

If you need to recover funds:
- Address is predictable from your EOA
- Can verify on any chain
- No dependency on LazaiTrader records

---

## Technical Note

:::warning
**Important:** While the address is the same, you must deposit on an **active** chain. Just because the address exists doesn't mean the trading infrastructure is live on that chain yet.
:::

Only deposit on chains shown as "Active" in `/deposit`.

---

## FAQs

### Can I predict my SCW address before registration?

Technically yes, but we handle this automatically. Your SCW address is shown after `/deposit`.

### What if the factory gets upgraded?

Factory upgrades would create new addresses. We maintain backward compatibility - your existing SCW continues working.

### Is this standard Ethereum technology?

Yes. CREATE2 is a standard EVM opcode available on all Ethereum-compatible chains.

---

## Further Reading

- [Non-Custodial Wallets](non-custodial-wallets) - Security model
- [Contract Addresses](../project-infrastructure/contract-addresses) - Factory addresses
