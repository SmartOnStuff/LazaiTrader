# Non-Custodial Wallets

Understanding how LazaiTrader keeps you in control of your funds at all times.

---

## What Does "Non-Custodial" Mean?

In the crypto world, **custodial** vs **non-custodial** determines who controls your funds:

| Type | Who Holds Keys | Who Can Move Funds | Example |
|------|---------------|-------------------|---------|
| **Custodial** | The platform | The platform | Centralized exchanges |
| **Non-Custodial** | You | Only you | Personal wallets |
| **LazaiTrader** | Smart contract | You + authorized bot | Best of both |

LazaiTrader is **non-custodial** - you always maintain ultimate control over your funds.

---

## How LazaiTrader Works

### Your Smart Contract Wallet (SCW)

When you register, we deploy a personal smart contract wallet for you. This wallet:

```
┌─────────────────────────────────────────────────────────┐
│              Your Smart Contract Wallet                  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Owner: Your EOA (0x742d35...)                         │
│  ├── Can withdraw ALL funds anytime                    │
│  └── Receives ALL withdrawals                          │
│                                                         │
│  Bot Operator: LazaiTrader (0x50dBE4...)               │
│  ├── Can execute trades on whitelisted DEXs            │
│  └── CANNOT withdraw to any address                    │
│                                                         │
│  Whitelisted DEXs: Only approved exchanges             │
│  └── All other contracts blocked                       │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Key Security Properties

1. **Withdrawals go to you** - No matter who initiates, funds go to your registered wallet
2. **Limited bot permissions** - Bot can only trade, not withdraw to other addresses
3. **Whitelisted DEXs only** - Prevents interaction with malicious contracts
4. **On-chain code** - Rules enforced by blockchain, not our servers

---

## What LazaiTrader CAN Do

| Action | Allowed | Reason |
|--------|---------|--------|
| Execute trades | ✅ Yes | Core functionality |
| Approve tokens for DEX | ✅ Yes | Required for swaps |
| Read your balance | ✅ Yes | For trade calculations |
| Send notifications | ✅ Yes | Keep you informed |

---

## What LazaiTrader CANNOT Do

| Action | Blocked | Why |
|--------|---------|-----|
| Withdraw to other addresses | ❌ No | Smart contract enforces your EOA only |
| Trade on non-whitelisted DEXs | ❌ No | Whitelist is hardcoded |
| Change your registered wallet | ❌ No | Immutable after deployment |
| Access your private keys | ❌ No | We never have them |
| Move funds without trading | ❌ No | Only trade functions available |

---

## The Security Model

### Layer 1: Smart Contract Rules

The SCW smart contract enforces:
```solidity
// Withdrawals ONLY go to owner (your EOA)
function withdrawAllTokens(address _token) external {
    IERC20(_token).safeTransfer(owner, balance);  // owner = your wallet
}

// Only whitelisted DEXs can be called
modifier onlyWhitelistedDEX(address dex) {
    require(factory.isDEXWhitelisted(dex), "DEX not whitelisted");
    _;
}
```

### Layer 2: Permission Model

```
Your EOA (Owner)
├── Full withdrawal rights
├── Can call withdraw functions directly
└── Receives all withdrawn funds

Bot Operator
├── Can execute trades
├── Can approve tokens for whitelisted DEXs
├── Can initiate withdrawals (but funds go to owner)
└── Cannot redirect funds anywhere else
```

### Layer 3: Factory Whitelist

DEXs must be pre-approved at the factory level:
- Factory owner controls whitelist
- Individual SCWs inherit the whitelist
- No user or bot can override

---

## Comparing to Alternatives

### vs Centralized Exchanges

| Aspect | CEX | LazaiTrader |
|--------|-----|-------------|
| Holds your funds | Exchange | Your SCW |
| Can freeze funds | Yes | No |
| Can get hacked | Yes (hot wallets) | Only your SCW affected |
| Requires KYC | Usually | No |
| Your keys | Don't have | You control |

### vs Trading Bots with API Keys

| Aspect | API Key Bots | LazaiTrader |
|--------|--------------|-------------|
| Permission scope | Full account access | Trade only |
| Withdrawal risk | Can withdraw anywhere | Only to your wallet |
| Key compromise | Total loss possible | Limited to SCW |
| Revocation | Must revoke on exchange | On-chain controls |

---

## What If LazaiTrader Disappears?

Even if LazaiTrader stops operating:

1. **Your funds are safe** - They're in your SCW on the blockchain
2. **You can withdraw directly** - Call the contract's withdraw function
3. **No dependency on us** - Smart contract continues to work

### Emergency Recovery

If the bot is unavailable, you can withdraw using any Ethereum wallet that supports contract interactions:

1. Go to block explorer (e.g., Metis Explorer)
2. Find your SCW address
3. Connect your registered wallet
4. Call `withdrawAllTokens(tokenAddress)` or `withdrawAllNative()`
5. Funds sent to your connected wallet

---

## Trust Assumptions

What you're trusting when using LazaiTrader:

| Component | Trust Level | Mitigation |
|-----------|-------------|------------|
| Smart contract code | High | Open source, auditable |
| Bot doesn't go rogue | Medium | Contract limits actions |
| DEX whitelist is safe | Medium | Only established DEXs |
| Telegram account security | Medium | Can't change withdraw address |
| Our infrastructure | Low | Can recover without us |

{% hint style="success" %}
**Key Point:** Even with full access to our systems, an attacker cannot steal your funds - only the smart contract can move them, and it enforces your EOA as the only withdrawal destination.
{% endhint %}

---

## Best Practices

### Secure Your Registered Wallet

Your EOA is the key to your funds. Protect it:
- Back up seed phrase offline
- Use hardware wallet if possible
- Never share private keys

### Monitor Your SCW

Periodically check:
- Balance matches expectations
- No unexpected transactions
- Trading activity is as configured

### Understand the Limits

Know that:
- Bot CAN execute trades on your behalf
- Bot CANNOT send funds elsewhere
- You CAN always withdraw directly

---

## Further Reading

- [Deterministic Addresses](deterministic-addresses.md) - Same address everywhere
- [DEX Whitelist Protection](dex-whitelist.md) - Approved exchanges only
- [How Funds Are Protected](how-funds-are-protected.md) - Complete security overview
