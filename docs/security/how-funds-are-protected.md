# How Your Funds Are Protected

A comprehensive overview of all security measures protecting your assets in LazaiTrader.

---

## Security Layers

LazaiTrader implements multiple layers of security:

```
┌─────────────────────────────────────────────────────────────────┐
│                     Layer 5: User Controls                       │
│              (Your registered wallet, your keys)                 │
├─────────────────────────────────────────────────────────────────┤
│                     Layer 4: Telegram Security                   │
│           (2FA, session management, account security)            │
├─────────────────────────────────────────────────────────────────┤
│                     Layer 3: Bot Permissions                     │
│              (Limited to trades, can't redirect)                 │
├─────────────────────────────────────────────────────────────────┤
│                     Layer 2: DEX Whitelist                       │
│              (Only approved exchanges allowed)                   │
├─────────────────────────────────────────────────────────────────┤
│                     Layer 1: Smart Contract                      │
│         (Immutable rules, owner-only withdrawals)                │
└─────────────────────────────────────────────────────────────────┘
```

---

## Layer 1: Smart Contract Security

### Immutable Owner

Your EOA is set as the owner at deployment and **cannot be changed**:

```solidity
address public immutable owner;  // Your wallet, forever
```

### Withdrawal Restrictions

All withdrawals go to the owner:

```solidity
function withdrawAllTokens(address _token) external {
    IERC20(_token).safeTransfer(owner, balance);
    // owner = always your registered wallet
}
```

### Reentrancy Protection

Prevents attack patterns that drain funds:

```solidity
contract LazaiTradingWallet is ReentrancyGuard {
    function executeTrade(...) external nonReentrant {
        // Protected from reentrancy attacks
    }
}
```

---

## Layer 2: DEX Whitelist

### Centralized Control

Only factory-approved DEXs can be called:

```solidity
modifier onlyWhitelistedDEX(address dex) {
    require(factory.isDEXWhitelisted(dex), "DEX not whitelisted");
    _;
}
```

### Benefits

| Threat | Protection |
|--------|------------|
| Malicious contracts | Blocked |
| Fake DEXs | Blocked |
| Phishing attempts | Blocked |

---

## Layer 3: Bot Permission Limits

### What the Bot Can Do

| Permission | Details |
|------------|---------|
| Execute trades | Only on whitelisted DEXs |
| Approve tokens | Only for whitelisted DEXs |
| Initiate withdrawals | Only to your EOA |
| Read balances | For calculations |

### What the Bot Cannot Do

| Restriction | Enforcement |
|-------------|-------------|
| Withdraw to other addresses | Smart contract prevents |
| Trade on arbitrary contracts | Whitelist prevents |
| Change owner | Immutable variable |
| Modify whitelist | Not authorized |

---

## Layer 4: Telegram Security

### Account Protection

- Enable 2FA on your Telegram account
- Use strong password
- Be aware of phishing

### What If Telegram Is Compromised?

Even with full Telegram access, an attacker:

| Can Do | Cannot Do |
|--------|-----------|
| View your balances | Withdraw to different address |
| Delete strategies | Access your EOA |
| See trade history | Change registered wallet |
| Try to withdraw | Redirect funds |

{% hint style="success" %}
**Key Point:** Withdrawals still go to YOUR registered wallet, even if someone else initiates them.
{% endhint %}

---

## Layer 5: Your Responsibilities

### Protect Your Registered Wallet

| Action | Why |
|--------|-----|
| Backup seed phrase | Recovery if device lost |
| Use hardware wallet | Enhanced security |
| Never share private key | Only you should have it |
| Verify addresses | Before depositing |

### Monitor Your Account

| Check | Frequency |
|-------|-----------|
| Balance | Daily/Weekly |
| Trade history | Weekly |
| Unknown transactions | Investigate immediately |

---

## Attack Scenarios & Protections

### Scenario 1: Bot Server Compromised

**Attack:** Hacker gains access to LazaiTrader servers.

**Protection:**
- Cannot change withdrawal addresses (immutable)
- Cannot bypass DEX whitelist (contract-enforced)
- Can only execute trades within normal parameters

**Your funds:** Safe in SCW, withdrawable to your EOA

### Scenario 2: Your Telegram Hacked

**Attack:** Someone accesses your Telegram account.

**Protection:**
- Withdrawals only go to your registered wallet
- They'd need your EOA private key to actually receive funds

**Your funds:** Sent to YOUR wallet, not theirs

### Scenario 3: Malicious DEX Added

**Attack:** A bad DEX gets whitelisted.

**Protection:**
- Rigorous vetting process
- Quick removal if issues detected
- Your SCW funds stay in SCW until traded

**Your funds:** Only at risk during active trades on that DEX

### Scenario 4: Smart Contract Bug

**Attack:** Vulnerability in SCW contract.

**Protection:**
- Standard OpenZeppelin libraries
- Simple, auditable code
- No upgradability (less attack surface)

**Your funds:** Risk depends on bug severity

---

## Emergency Recovery

### If LazaiTrader Goes Offline

Your funds are still accessible:

1. **Your SCW address** - Known and deterministic
2. **Your EOA** - Has withdrawal permission
3. **Direct contract call** - Bypass the bot entirely

### How to Withdraw Directly

Using any Web3 wallet or block explorer:

1. Connect your registered wallet
2. Go to your SCW on block explorer
3. Call `withdrawAllTokens(tokenAddress)`
4. Funds sent to your connected wallet

### Required Information

| Item | How to Find |
|------|-------------|
| SCW address | Previous bot messages, or calculate from EOA |
| Token addresses | Block explorer, documentation |
| Your EOA | Your wallet |

---

## Security Checklist

### Before You Start

- [ ] Secure Telegram with 2FA
- [ ] Have seed phrase backup for registered wallet
- [ ] Verify you control the wallet address
- [ ] Start with small test deposit

### Ongoing

- [ ] Check balances regularly
- [ ] Review trade notifications
- [ ] Keep Telegram account secure
- [ ] Report suspicious activity

### If Something Seems Wrong

- [ ] Check transaction history on block explorer
- [ ] Verify your wallet is still the owner
- [ ] Contact support with details
- [ ] Consider emergency withdrawal

---

## Trust Summary

| Component | You Trust | We Ensure |
|-----------|-----------|-----------|
| Smart contract | Code is correct | Use standard libraries, simple logic |
| DEX whitelist | Only safe DEXs | Rigorous vetting |
| Bot operation | Normal behavior | Limited permissions |
| Infrastructure | Availability | Redundant systems |
| **Your wallet** | **You control it** | **We can't access it** |

{% hint style="success" %}
**Bottom Line:** Your funds are as safe as your personal wallet security. LazaiTrader cannot steal your funds - the smart contract makes it impossible.
{% endhint %}

---

## Further Reading

- [Non-Custodial Wallets](non-custodial-wallets.md) - Detailed custody model
- [DEX Whitelist](dex-whitelist.md) - Exchange protection
- [Deterministic Addresses](deterministic-addresses.md) - Cross-chain security
