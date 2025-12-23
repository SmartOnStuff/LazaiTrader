# Project Wallets

Official wallet addresses used by LazaiTrader for operations across all chains.

---

## Overview

LazaiTrader uses several operational wallets for different purposes. All addresses are **the same across all supported chains**.

:::info
These are **operational wallets** - they facilitate the system but never hold your funds. Your funds are always in your personal SCW.
:::

---

## Bot Operator Wallet

### Address
```
0x50dBE40A3a792F18163f70c625ABd6B760156047
```

### Purpose
The Bot Operator wallet executes trades on behalf of users:

| Permission | Scope |
|------------|-------|
| Execute trades | Only on whitelisted DEXs |
| Approve tokens | Only for whitelisted DEXs |
| Initiate withdrawals | Only to user's registered EOA |

### What It Can Do

- ✅ Call `executeTrade()` on your SCW
- ✅ Call `approveToken()` for DEX interactions
- ✅ Initiate `withdrawAllTokens()` (funds go to YOUR wallet)

### What It Cannot Do

- ❌ Change withdrawal destination
- ❌ Interact with non-whitelisted contracts
- ❌ Access your private keys
- ❌ Redirect your funds

---

## Factory Deployer Wallet

### Address
```
0x92725DC925F36559C2CEf6498211e60Ac2d38739
```

### Purpose
Used for initial contract deployments:

| Function | Description |
|----------|-------------|
| Deploy Factory | Initial factory deployment |
| Deploy FactoryDeployer | CREATE2 helper deployment |
| Factory Ownership | Manages DEX whitelist |

### Responsibilities

- Deploy core contracts on new chains
- Manage factory whitelist (add/remove DEXs)
- System upgrades (if any)

---

## Wallet Relationships

```
┌─────────────────────────────────────────────────────────────┐
│                    LazaiTrader System                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Factory Deployer (0x9272...)                               │
│  └── Deploys and owns Factory                               │
│      └── Controls DEX whitelist                             │
│                                                             │
│  Bot Operator (0x50dB...)                                   │
│  └── Executes trades on SCWs                                │
│      └── Limited to whitelisted DEXs                        │
│      └── Cannot change withdrawal addresses                 │
│                                                             │
│  Your SCW (deployed per user)                               │
│  └── Holds YOUR funds                                       │
│      └── Owner = YOUR EOA                                   │
│      └── Withdrawals → YOUR wallet only                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Trust Model

### What You're Trusting

| Component | Trust Level | Mitigation |
|-----------|-------------|------------|
| Bot Operator behavior | Medium | Contract limits actions |
| Factory Deployer (whitelist) | Medium | Only DEX changes possible |
| Smart contract code | High | Open source, auditable |
| Your EOA security | High | Your responsibility |

### What You're NOT Trusting

| Component | Why Not |
|-----------|---------|
| LazaiTrader with your funds | Contract enforces your ownership |
| Bot to not steal funds | Physically impossible via contract |
| Operators to be honest | Code enforces rules, not humans |

---

## Verifying Wallet Roles

### Check Bot Operator

On any SCW, verify the bot operator:
```solidity
// Returns: 0x50dBE40A3a792F18163f70c625ABd6B760156047
scw.botOperator()
```

### Check Factory Owner

On the factory, verify the owner:
```solidity
// Returns: 0x92725DC925F36559C2CEf6498211e60Ac2d38739
factory.owner()
```

### Check Your SCW Owner

On your SCW, verify YOUR ownership:
```solidity
// Returns: YOUR registered EOA
scw.owner()
```

---

## Security Measures

### Multi-Sig Plans

Future enhancements may include:
- Multi-signature control for factory operations
- Time-locked changes to whitelist
- Community governance participation

### Monitoring

All wallet activities are:
- On-chain and transparent
- Verifiable by anyone
- Historically traceable

---

## What Happens If Wallets Are Compromised?

### Bot Operator Compromised

Worst case scenario:
- Attacker could execute trades on your SCW
- Trades limited to whitelisted DEXs
- **Cannot steal funds** - withdrawals go to YOUR wallet

Mitigation:
- Monitor your SCW for unusual activity
- Withdraw funds if concerned
- Wait for operator key rotation

### Factory Deployer Compromised

Worst case scenario:
- Attacker could whitelist malicious DEX
- Existing trades unaffected
- New trades could interact with bad DEX

Mitigation:
- Monitor whitelist changes
- Withdraw if suspicious DEX added
- Community alerts

:::tip
**Key Point:** Even in worst-case scenarios, your funds can only go to YOUR registered wallet. The security model assumes operational wallets could be compromised.
:::

---

## Transparency

### On-Chain Verification

All project wallets are viewable on block explorers:

| Wallet | Explorer Link |
|--------|--------------|
| Bot Operator | [View on Metis](https://explorer.metis.io/address/0x50dBE40A3a792F18163f70c625ABd6B760156047) |
| Factory Deployer | [View on Metis](https://explorer.metis.io/address/0x92725DC925F36559C2CEf6498211e60Ac2d38739) |

### Activity Monitoring

You can monitor:
- All transactions from these wallets
- Contract interactions
- Whitelist changes

---

## FAQs

### Why does the bot need a special wallet?

The bot wallet is authorized in your SCW to execute trades. Without it, automated trading wouldn't be possible while maintaining non-custodial security.

### Can LazaiTrader change these wallets?

- **Bot Operator:** Set at SCW deployment, immutable
- **Factory Owner:** Could transfer ownership (for upgrades)

### What gas does the bot wallet use?

The Bot Operator wallet:
- Holds native tokens for gas
- Pays gas for your trades
- Funded by LazaiTrader

You don't need to worry about gas for trading operations.

---

## Further Reading

- [Contract Addresses](contract-addresses) - All contract addresses
- [Non-Custodial Wallets](../security/non-custodial-wallets) - Security model
- [How Funds Are Protected](../security/how-funds-are-protected) - Complete security overview
