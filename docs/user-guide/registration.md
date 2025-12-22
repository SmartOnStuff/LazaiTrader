# Registration

Getting started with LazaiTrader begins with a simple registration process through Telegram.

---

## Starting Registration

### Step 1: Find the Bot

Open Telegram and search for **@LazaiTraderBot**, or use this direct link:
- [t.me/LazaiTraderBot](https://t.me/LazaiTraderBot)

### Step 2: Send /start

Send the `/start` command to begin:

```
/start
```

The bot will respond with a welcome message:

```
👋 Welcome to LazaiTrader!

I'm your automated trading assistant. I'll help you:
• Set up a secure trading wallet
• Configure automated trading strategies
• Execute trades while you sleep

To get started, I need your Ethereum wallet address.
This is the address that will receive all withdrawals.

Please send your wallet address (starts with 0x):
```

---

## Providing Your Wallet Address

Send your Ethereum wallet address when prompted:

```
0x742d35Cc6634C0532925a3b844Bc9e7595f12345
```

{% hint style="warning" %}
**Critical:** This address becomes your withdrawal destination forever. Make absolutely sure:
- You control this address (have the private key or seed phrase)
- You've copied it correctly
- It's an EOA (regular wallet), not a contract address
{% endhint %}

### Valid Address Format

Your address must:
- Start with `0x`
- Be exactly 42 characters long
- Contain only hexadecimal characters (0-9, a-f, A-F)

### What Happens If I Enter the Wrong Address?

The bot validates your address format. If invalid, you'll be asked to try again:

```
❌ Invalid address format.

Please send a valid Ethereum address starting with 0x
(42 characters total).

Example: 0x742d35Cc6634C0532925a3b844Bc9e7595f12345
```

---

## Registration Complete

Once you provide a valid address, registration is complete:

```
✅ Registration Successful!

Your Details:
• Wallet: 0x742d35Cc...12345
• User ID: 123456789
• Registered: 2024-01-15

What's Next?
1. /deposit - Get your trading wallet address
2. /help - See all available commands

Your funds will always be sent to your registered wallet
when you withdraw. This cannot be changed.
```

---

## After Registration

You now have access to all LazaiTrader features:

| Command | Description |
|---------|-------------|
| `/deposit` | Deploy your Smart Contract Wallet |
| `/balance` | Check your balances |
| `/config` | Set up trading strategies |
| `/withdraw` | Withdraw funds to your wallet |
| `/help` | View all commands |

---

## Returning Users

If you've already registered and send `/start` again:

```
👋 Welcome back!

Your registered wallet: 0x742d35Cc...12345

Quick Actions:
• /balance - Check your balances
• /config - Configure a strategy
• /chart - View trade history

Need help? Send /help
```

---

## Frequently Asked Questions

### Can I change my registered wallet address?

No. Your withdrawal address is set permanently at registration for security reasons. This ensures that even if someone gains access to your Telegram account, they cannot redirect your funds.

### What if I lose access to my registered wallet?

Your funds in the Smart Contract Wallet are still accessible through blockchain transactions. However, LazaiTrader will only send withdrawals to your registered address.

{% hint style="danger" %}
**Never lose access to your registered wallet!** Back up your seed phrase or private key securely.
{% endhint %}

### Can I register multiple wallets?

Currently, one Telegram account = one registered wallet. If you need multiple trading wallets, use different Telegram accounts.

---

## Next Steps

Continue to [Wallet Setup & Deposits](wallet-setup.md) to deploy your Smart Contract Wallet and start funding it.
