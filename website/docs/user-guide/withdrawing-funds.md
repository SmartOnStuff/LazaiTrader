# Withdrawing Funds

Move your funds from your Smart Contract Wallet back to your personal wallet.

---

## How Withdrawals Work

When you withdraw:
1. Bot initiates withdrawal from your SCW
2. Funds are sent **directly to your registered EOA**
3. Transaction is executed on-chain
4. You receive tokens in your personal wallet

:::tip
**Security Feature:** Withdrawals can ONLY go to the wallet address you registered with. This protects your funds even if someone gains access to your Telegram account.
:::

---

## Initiating a Withdrawal

### Step 1: Start Withdrawal

Send `/withdraw` to the bot:

```
/withdraw
```

### Step 2: Select Chain

```
💸 Withdraw Funds

Select a chain to withdraw from:

[Metis Andromeda]
```

### Step 3: Select Token

```
Select token to withdraw:

Your balances on Metis:
• WETH: 0.5000 ($1,250.00)
• m.USDC: 500.00 ($500.00)
• WMetis: 10.00 ($450.00)

[WETH] [m.USDC] [WMetis] [All Tokens]
```

### Step 4: Confirm

```
⚠️ Confirm Withdrawal

Token: WETH
Amount: 0.5000 WETH (~$1,250.00)
To: 0x742d35Cc...12345 (your wallet)
Network: Metis Andromeda

[Confirm Withdrawal] [Cancel]
```

---

## Withdrawal Processing

### During Withdrawal

```
⏳ Processing Withdrawal...

Sending 0.5 WETH to your wallet.
Please wait for blockchain confirmation.
```

### Successful Withdrawal

```
✅ Withdrawal Complete!

Transaction Details:
• Token: WETH
• Amount: 0.5000
• To: 0x742d35Cc...12345
• Tx Hash: 0xabc123...

🔗 View on Explorer

Your funds should arrive in your wallet shortly.
```

---

## Withdraw All Tokens

To withdraw everything at once:

1. Select **[All Tokens]** when prompted
2. Confirm the withdrawal
3. All tokens are sent in separate transactions

```
💸 Withdrawing All Tokens

Processing 3 withdrawals:
✅ WETH: 0.5000 sent
✅ m.USDC: 500.00 sent
✅ WMetis: 10.00 sent

All funds have been sent to your wallet.
```

---

## Withdrawal Fees

| Fee Type | Who Pays | Amount |
|----------|----------|--------|
| Gas fees | LazaiTrader bot | Variable (network dependent) |
| Platform fees | None | Free |

:::info
LazaiTrader covers gas fees for withdrawals. You receive the full amount withdrawn.
:::

---

## Withdrawal Destination

Your funds are **always** sent to your registered wallet address:

```
Registered Wallet: 0x742d35Cc6634C0532925a3b844Bc9e7595f12345
```

This cannot be changed. It's a security feature to protect your funds.

### Why Can't I Change the Destination?

If someone gains access to your Telegram account, they could potentially:
- View your balances
- Delete your strategies
- Try to withdraw

But they **cannot** redirect your funds to a different address. Your tokens will always go to YOUR wallet.

---

## After Withdrawal

### Check Your Wallet

1. Open your personal wallet (MetaMask, etc.)
2. Switch to Metis Andromeda network
3. Verify the tokens arrived

### SCW Balance

After withdrawal, your SCW balance will be reduced:

```
/balance

💰 Your Portfolio

Metis Andromeda:
• WETH: 0.0000 ($0.00)
• m.USDC: 0.00 ($0.00)

Total: $0.00

Note: Recently withdrawn funds may take a moment to reflect.
```

---

## Troubleshooting

### Withdrawal Pending

```
⏳ Withdrawal still processing...

This can take up to a few minutes depending on network congestion.
Check the transaction status on the block explorer.
```

If stuck for more than 10 minutes:
- Check the transaction hash on the block explorer
- Network might be congested
- Contact support if needed

### Insufficient Balance

```
❌ Insufficient Balance

You don't have enough WETH to withdraw.
Current balance: 0.0000 WETH
```

### Transaction Failed

```
❌ Withdrawal Failed

The transaction could not be completed.
Reason: Network error

Your funds are safe in your SCW.
Please try again later.
```

If failures persist:
- Check network status
- Try a different token
- Contact support

---

## Partial Withdrawals

Currently, withdrawals are **all-or-nothing** per token. You cannot withdraw a specific amount.

To keep some funds in your SCW:
1. Withdraw all of one token
2. Deposit back the amount you want to keep trading

---

## Withdrawal History

View past withdrawals with `/chart`:

The chart includes:
- All withdrawal transactions
- Amounts and dates
- Impact on PnL calculations

---

## Next Steps

- [Check Balances](checking-balances) - Verify remaining funds
- [View Performance](viewing-performance) - See complete history
