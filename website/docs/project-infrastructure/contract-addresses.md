# Contract Addresses

Official smart contract addresses deployed by LazaiTrader across all supported chains.

---

## Factory Contracts

The LazaiWalletFactory is deployed at the **same address on all chains** using CREATE2 deterministic deployment.

### LazaiWalletFactory

| Chain | Address | Status |
|-------|---------|--------|
| Metis Andromeda | `0xe053618226d20AC5daA428e7558bA8aE13AeE6E0` | ✅ Active |
| Zircuit | `0xe053618226d20AC5daA428e7558bA8aE13AeE6E0` | ⏳ Coming Soon |
| Ethereum | `0xe053618226d20AC5daA428e7558bA8aE13AeE6E0` | 📋 Planned |
| Base | `0xe053618226d20AC5daA428e7558bA8aE13AeE6E0` | 📋 Planned |

:::tip
**Same address everywhere!** The factory is deployed deterministically, ensuring the same address on all EVM chains.
:::

---

## Deployment Infrastructure

### FactoryDeployer (Deterministic Deployer)

Used to deploy the factory at a predictable address:

| Chain | Address |
|-------|---------|
| All Chains | `0x558bC575E12ecCD0b315F8ECEbbC0196522246BF` |

This is a helper contract used during initial deployment.

---

## DEX Contracts

### Whitelisted DEXs by Chain

#### Metis Andromeda

| DEX | Type | Address |
|-----|------|---------|
| HerculesDEX (CamelotYakRouter) | AMM | `0xF9a6d89DCCb139E26da4b9DF00796C980b5975d2` |

#### Testnet - Hyperion

| DEX | Type | Address |
|-----|------|---------|
| LazaiSwap (tgMetis-tgUSDC) | Oracle | `0x4704759E4a426b29615e4841B092357460925eFf` |
| LazaiSwap (tgETH-tgUSDC) | Oracle | `0x1D980BdE3da29058c6C0b7129c8E60F8c6e439b8` |

#### Testnet - Zircuit Garfield

| DEX | Type | Address |
|-----|------|---------|
| LazaiSwap (tETH-tUSDC) | Oracle | `0x547c2aBf7b604BfB9FfD8fADd678Bc9d449A39cD` |

---

## Token Contracts

### Metis Andromeda

| Token | Symbol | Address |
|-------|--------|---------|
| Wrapped ETH | WETH | `0x420000000000000000000000000000000000000A` |
| USD Coin | m.USDC | `0xEA32A96608495e54156Ae48931A7c20f0dcc1a21` |
| Wrapped Metis | WMetis | `0x75cb093E4D61d2A2e65D8e0BBb01DE8d89b53481` |

---

## Verifying Contracts

### On Block Explorer

1. Go to the chain's block explorer
2. Search for the contract address
3. View "Contract" tab for verified source code

### Metis Explorer Links

- Factory: [View on Metis Explorer](https://explorer.metis.io/address/0xe053618226d20AC5daA428e7558bA8aE13AeE6E0)
- HerculesDEX: [View on Metis Explorer](https://explorer.metis.io/address/0xF9a6d89DCCb139E26da4b9DF00796C980b5975d2)

---

## Your Smart Contract Wallet

Your SCW address is **deterministic** based on your EOA:

```
SCW Address = CREATE2(factory, hash(yourEOA, salt), walletCode)
```

This means:
- Same SCW address on all chains
- Predictable before deployment
- Verifiable on any block explorer

### Finding Your SCW

1. Use `/deposit` command in the bot
2. Check the factory's `userWallets` mapping
3. Calculate from your EOA using `computeWalletAddress()`

---

## Contract Verification Status

| Contract | Metis | Zircuit | Ethereum | Base |
|----------|-------|---------|----------|------|
| Factory | ✅ Verified | ⏳ | 📋 | 📋 |
| Trading Wallet | ✅ Template | ✅ Template | 📋 | 📋 |
| HerculesDEX | ✅ Third-party | - | - | - |

---

## Security Notes

### Official Contracts Only

:::danger
**Only interact with official contract addresses listed here.** Scammers may create fake contracts with similar names.
:::

### Verification Steps

Before trusting a contract:
1. Verify address matches this documentation
2. Check contract is verified on explorer
3. Review source code if technical
4. Confirm through official channels

### Reporting Issues

If you find suspicious contracts or addresses claiming to be LazaiTrader:
- Do not interact with them
- Report to our team
- Warn other community members

---

## Cross-Chain Architecture

### Why Same Addresses?

Benefits of deterministic deployment:
- **User simplicity** - One address to remember
- **Security** - Verifiable across chains
- **Future-proof** - New chains work automatically

### How It's Achieved

```
CREATE2 Formula:
address = keccak256(0xff, factory, salt, keccak256(bytecode))

Components (identical across chains):
├── 0xff: Constant
├── factory: Same address deployed first
├── salt: Derived from user EOA
└── bytecode: Identical contract code
```

---

## FAQs

### How do I verify my SCW address?

1. Get your EOA (registered wallet)
2. Call `factory.computeWalletAddress(yourEOA)`
3. Compare with address shown in bot

### What if addresses don't match documentation?

- Do not proceed
- Contact support immediately
- May indicate phishing attempt

### Are contracts upgradeable?

No. The SCW and factory are **not upgradeable**:
- Code is immutable
- Rules cannot change
- Maximum security

---

## Further Reading

- [Project Wallets](project-wallets) - Operator addresses
- [Security](../security/how-funds-are-protected) - Protection measures
- [Non-Custodial Wallets](../security/non-custodial-wallets) - Custody model
