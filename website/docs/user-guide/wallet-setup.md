# Wallet Setup & Deposits

After registration, your next step is to set up your Smart Contract Wallet (SCW) and fund it for trading.

---

## What is a Smart Contract Wallet?

A Smart Contract Wallet (SCW) is a personal blockchain account created specifically for your trading activities. Unlike your regular wallet (EOA), an SCW is a programmable contract that:

- **Holds your trading funds** securely on-chain
- **Executes trades** on whitelisted DEXs only
- **Protects withdrawals** - funds can only go to your registered wallet
- **Works across chains** - same address on every supported blockchain

---

## Deploying Your SCW

### Step 1: Request Deposit Address

Send the `/deposit` command:

```
/deposit
```

### Step 2: Wait for Deployment

If this is your first time, the bot will deploy your SCW:

```
⏳ Deploying your Smart Contract Wallet...

This only happens once. Your wallet will have the same
address on all supported chains.

Please wait...
```

:::info
Deployment typically takes 10-30 seconds. The bot pays the gas fees for deployment.
:::

### Step 3: Receive Your Address

Once deployed, you'll see your deposit address:

```
✅ Your Smart Contract Wallet is Ready!

📥 Deposit Address:
0x1234567890abcdef1234567890abcdef12345678

This address works on:
✅ Metis Andromeda (Chain ID: 1088)

Send any supported tokens to this address to start trading.

⚠️ Only send tokens on supported chains!
```

---

## Funding Your Wallet

### Supported Tokens

Currently supported on **Metis Andromeda**:

| Token | Contract Address | Decimals |
|-------|------------------|----------|
| WETH | `0x420000000000000000000000000000000000000A` | 18 |
| m.USDC | `0xEA32A96608495e54156Ae48931A7c20f0dcc1a21` | 6 |
| WMetis | `0x75cb093E4D61d2A2e65D8e0BBb01DE8d89b53481` | 18 |

### How to Deposit

1. **Copy your SCW address** from the bot message
2. **Open your wallet** (MetaMask, Trust Wallet, etc.)
3. **Select the correct network** (Metis Andromeda)
4. **Send tokens** to your SCW address
5. **Wait for confirmation** (usually 1-2 blocks)

:::warning
**Double-check the network!** Sending tokens on an unsupported chain may result in lost funds.
:::

### Deposit Detection

The bot automatically detects deposits every 5 minutes. You can also check manually:

```
/balance
```

---

## Returning to Deposit

If you've already deployed your SCW, `/deposit` shows your existing address:

```
📥 Your Deposit Address

0x1234567890abcdef1234567890abcdef12345678

Active on:
✅ Metis Andromeda

Current Balances:
• 100.00 m.USDC
• 0.05 WETH
```

---

## Cross-Chain Deposits

Your SCW address is **deterministic** - it's the same on every chain where the LazaiTrader factory is deployed.

### What This Means

- Deploy once, use everywhere
- No need to remember different addresses per chain
- As new chains are added, your existing address works automatically

### Currently Active Chains

| Chain | Status | Can Deposit? |
|-------|--------|--------------|
| Metis Andromeda | Active | ✅ Yes |
| Zircuit | Coming Soon | ⏳ Not yet |
| Ethereum | Planned | ⏳ Not yet |
| Base | Planned | ⏳ Not yet |

:::danger
**Do not send funds on chains that aren't active yet!** Even though your address exists, trading functionality may not be available.
:::

---

## Deposit Best Practices

### Start Small
Test with a small amount first to ensure everything works correctly.

### Verify the Address
Always copy the address from the bot - don't type it manually.

### Check Network
Make sure you're sending on Metis Andromeda (Chain ID: 1088).

### Keep Some Gas
Your personal wallet needs gas for deposits. The SCW doesn't need gas for trading (the bot pays).

---

## Troubleshooting

### Deposit Not Showing?

1. **Wait 5 minutes** - Auto-detection runs periodically
2. **Check the transaction** - Verify it confirmed on the block explorer
3. **Use `/balance`** - Force a balance check
4. **Verify the chain** - Make sure you sent on Metis Andromeda

### Wrong Network?

If you sent tokens on an unsupported network:
- The tokens may be at your SCW address on that chain
- You'll need to wait until that chain is supported
- Or use a direct blockchain transaction to recover (advanced)

---

## Next Steps

Once your wallet is funded, you're ready to:
- [Check Balances](checking-balances) - Verify your deposits
- [Configure Strategies](configuring-strategies) - Set up automated trading
