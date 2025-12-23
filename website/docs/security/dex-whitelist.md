# DEX Whitelist Protection

How LazaiTrader ensures your funds only interact with safe, approved exchanges.

---

## Why Whitelisting Matters

In DeFi, your wallet can interact with any smart contract. This creates risks:

| Risk | Description | Consequence |
|------|-------------|-------------|
| Malicious contracts | Fake DEXs that steal funds | Total loss |
| Phishing approvals | Tricking you into approving bad contracts | Funds drained |
| Rug pulls | DEX disappears with liquidity | Trade fails, funds lost |

LazaiTrader's whitelist eliminates these risks.

---

## How the Whitelist Works

### At the Factory Level

The LazaiWalletFactory maintains a master whitelist:

```
┌─────────────────────────────────────────────────────────┐
│              LazaiWalletFactory                          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Whitelisted DEXs:                                      │
│  ✅ 0xF9a6d8... (HerculesDEX - Metis)                  │
│  ✅ 0x4704759... (LazaiSwap - Testnet)                 │
│                                                         │
│  All other addresses: ❌ BLOCKED                        │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### At the Wallet Level

Every SCW checks the factory before executing trades:

```
Trade Request → SCW → Check Factory Whitelist → Execute or Reject
```

```solidity
// From LazaiTradingWallet.sol
modifier onlyWhitelistedDEX(address dex) {
    require(factory.isDEXWhitelisted(dex), "DEX not whitelisted");
    _;
}
```

---

## What Gets Blocked

### Trade Attempts to Non-Whitelisted Contracts

```
❌ BLOCKED: Trade to 0xMalicious...
Reason: DEX not whitelisted
Result: Transaction reverts, funds safe
```

### Even the Bot Can't Bypass

The bot operator has permission to call trade functions, but:
- Every trade checks the whitelist
- Non-whitelisted addresses always fail
- No override possible

---

## Whitelisting Criteria

Before a DEX is whitelisted, we verify:

| Criteria | Requirement |
|----------|-------------|
| Established protocol | Not newly launched |
| Audited contracts | Security review completed |
| Sufficient liquidity | Can handle trades |
| Transparent team | Known developers |
| Track record | No security incidents |

---

## Currently Whitelisted DEXs

### Metis Andromeda

| DEX | Address | Type |
|-----|---------|------|
| HerculesDEX | `0xF9a6d89DCCb139E26da4b9DF00796C980b5975d2` | CamelotYakRouter |

### Testnet (Development)

| DEX | Address | Type |
|-----|---------|------|
| LazaiSwap | `0x4704759E4a426b29615e4841B092357460925eFf` | Oracle-based |

---

## Whitelist Management

### Who Controls the Whitelist?

The factory owner (LazaiTrader team) manages the whitelist:
- Can add new DEXs after verification
- Can remove DEXs if issues arise
- Changes apply to all SCWs immediately

### Adding New DEXs

When we expand to new chains or add DEX support:
1. DEX is reviewed and verified
2. Added to factory whitelist
3. All users can trade on it automatically
4. Announced in release notes

### Removing a DEX

If a DEX becomes unsafe:
1. Removed from whitelist immediately
2. Existing trades complete normally
3. New trades to that DEX blocked
4. Users notified of change

---

## Security Benefits

### Protection Against

| Threat | Protection |
|--------|------------|
| Malicious swap contracts | ✅ Blocked by whitelist |
| Approval scams | ✅ Only approved DEXs get approvals |
| Bot compromise | ✅ Still limited to whitelisted DEXs |
| Social engineering | ✅ Contract enforces, not humans |

### Trust Model

```
You trust: The whitelist is safe
We ensure: Only vetted DEXs are added
Contract enforces: No exceptions possible
```

---

## Verifying the Whitelist

You can verify whitelisted DEXs on-chain:

### Using Block Explorer

1. Go to the factory contract on Metis Explorer
2. Find `getWhitelistedDEXs()` function
3. Call it to see all approved addresses

### Factory Address

```
Factory: 0xe053618226d20AC5daA428e7558bA8aE13AeE6E0
```

---

## What If I Want to Use Another DEX?

Currently, you can only trade through whitelisted DEXs via LazaiTrader. Options:

1. **Wait for addition** - Request we add the DEX
2. **Withdraw and trade** - Move funds to your EOA and trade directly
3. **Use directly** - Your EOA can interact with any contract

:::info
The whitelist only affects trades through your SCW via the bot. Your personal wallet (EOA) has no restrictions.
:::

---

## FAQs

### Can I request a DEX be whitelisted?

Yes, contact us with the DEX details. We'll evaluate based on our criteria.

### What if a whitelisted DEX gets hacked?

- We'd remove it from the whitelist immediately
- Existing funds aren't affected (they're in your SCW, not the DEX)
- Only pending trades could be impacted

### Can I see trade transactions?

Yes, all trades are on-chain. Check your SCW address on the block explorer.

---

## Further Reading

- [HerculesDEX](../decentralized-exchanges/hercules-dex) - Main DEX on Metis
- [LazaiSwap](../decentralized-exchanges/lazaiswap) - Custom oracle DEX
- [Non-Custodial Wallets](non-custodial-wallets) - Security model
