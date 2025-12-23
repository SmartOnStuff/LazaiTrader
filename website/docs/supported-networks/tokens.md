# Supported Tokens

List of tokens available for trading on each supported chain.

---

## Metis Andromeda

### Active Tokens

| Token | Symbol | Contract Address | Decimals |
|-------|--------|------------------|----------|
| Wrapped ETH | WETH | `0x420000000000000000000000000000000000000A` | 18 |
| USD Coin | m.USDC | `0xEA32A96608495e54156Ae48931A7c20f0dcc1a21` | 6 |
| Wrapped Metis | WMetis | `0x75cb093E4D61d2A2e65D8e0BBb01DE8d89b53481` | 18 |

### Token Details

#### WETH (Wrapped ETH)
- Standard wrapped Ethereum
- Used as base token for ETH pairs
- Bridge from Ethereum via official Metis bridge

#### m.USDC (Metis USDC)
- Stablecoin pegged to US Dollar
- Primary quote token for trading pairs
- Bridge from Ethereum USDC

#### WMetis (Wrapped Metis)
- Wrapped version of native METIS token
- Used for METIS trading pairs
- Can wrap/unwrap from native METIS

---

## Token Normalization

For price tracking and display, tokens are normalized:

| On-Chain Symbol | Displayed As | Reason |
|-----------------|--------------|--------|
| WETH | ETH | Equivalent value |
| m.USDC | USDC | Same stablecoin |
| WMetis | METIS | Equivalent value |

This means:
- Charts show "ETH" instead of "WETH"
- Prices fetched for "ETH-USD" work for WETH
- Portfolio shows simplified symbols

---

## Testnet Tokens (Development Only)

### Hyperion Testnet

| Token | Symbol | Contract Address | Status |
|-------|--------|------------------|--------|
| Test gMetis | tgMetis | `0x69Dd3C70Ae76256De7Ec9AF5893DEE49356D45fc` | Dev only |
| Test gUSDC | tgUSDC | `0x6Eb66c8bBD57FdA71ecCAAc40a56610C2CA8FDb8` | Dev only |
| Test gETH | tgETH | `0x2222Fe85Dbe1Bd7CCB44f367767862fDbe15d6a8` | Dev only |

### Zircuit Garfield Testnet

| Token | Symbol | Contract Address | Status |
|-------|--------|------------------|--------|
| Test ETH | TETH | `0x69Dd3C70Ae76256De7Ec9AF5893DEE49356D45fc` | Dev only |
| Test USDC | TUSDC | `0x03B8f80a468640074297c662701c541397D8a6D9` | Dev only |

:::danger
**Testnet tokens have NO VALUE!** Do not attempt to trade real funds for testnet tokens.
:::

---

## Adding New Tokens

New tokens are added based on:

| Criteria | Requirement |
|----------|-------------|
| Liquidity | Sufficient DEX liquidity |
| Reliability | Stable price feeds available |
| Demand | User requests |
| Security | No known vulnerabilities |

### Token Support Checklist

Before a token is supported:
- [ ] Contract verified on explorer
- [ ] Adequate liquidity on whitelisted DEX
- [ ] Price feed available
- [ ] Trading pair configured
- [ ] Tested on testnet

---

## Depositing Tokens

### From Another Wallet

1. Copy your SCW address from `/deposit`
2. Send tokens from your wallet
3. Ensure you're on the correct network (Metis)
4. Check balance with `/balance`

### From a Centralized Exchange

1. Withdraw to your personal wallet first
2. Then send to your SCW
3. Some exchanges support direct Metis withdrawals

:::warning
**Always verify the network!** Sending tokens on the wrong chain can result in loss of funds.
:::

---

## Token Balances

View your token balances with `/balance`:

```
💰 Your Portfolio

Metis Andromeda:
┌────────────┬───────────┬──────────┐
│ Token      │ Balance   │ Value    │
├────────────┼───────────┼──────────┤
│ WETH       │ 0.5000    │ $1,250.00│
│ m.USDC     │ 500.00    │ $500.00  │
│ WMetis     │ 10.00     │ $450.00  │
└────────────┴───────────┴──────────┘

Total: $2,200.00
```

---

## Price Sources

Token prices are fetched from multiple sources:

| Source | Priority | Tokens Covered |
|--------|----------|----------------|
| Binance | 1 | BTC, ETH |
| CoinGecko | 2 | Most tokens |
| Coinbase | 3 | Major tokens |
| DEXScreener | 4 | DEX-specific |

The system automatically falls back if primary sources are unavailable.

---

## FAQs

### Can I deposit any ERC-20 token?

You can send any token to your SCW, but only supported tokens can be:
- Displayed in balances
- Traded via strategies
- Withdrawn through the bot

Unsupported tokens remain in your SCW but aren't accessible through LazaiTrader.

### What about native tokens (ETH, METIS)?

Native tokens should be wrapped (WETH, WMetis) for trading. The bot handles this distinction automatically where possible.

### Can I request a token?

Yes! Let us know which tokens you'd like supported. We prioritize based on liquidity, demand, and price feed availability.

---

## Further Reading

- [Trading Pairs](trading-pairs) - Available pairs
- [Chains](chains) - Supported networks
