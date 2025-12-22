# LazaiTrader

## Automated Crypto Trading via Telegram

LazaiTrader is a **non-custodial automated trading bot** that lets you set up trading strategies and execute trades directly from Telegram. Your funds remain in your control at all times through Smart Contract Wallets (SCW) deployed on your behalf.

***

## Why LazaiTrader?

| Feature                  | Benefit                                                                                               |
| ------------------------ | ----------------------------------------------------------------------------------------------------- |
| **Non-Custodial**        | Your funds stay in your personal smart contract wallet. We never have access to withdraw your assets. |
| **Telegram-Based**       | No app to download. Trade from any device with Telegram.                                              |
| **Automated Strategies** | Set your rules once, let the bot execute 24/7.                                                        |
| **Cross-Chain Ready**    | Same wallet address across all supported blockchains.                                                 |
| **Transparent**          | All trades executed on-chain with full transaction history.                                           |

***

## Quick Start

1. **Start the Bot** - Send `/start` to [@LazaiTraderBot](https://t.me/LazaiTraderBot) on Telegram
2. **Register Your Wallet** - Provide your Ethereum wallet address (EOA)
3. **Get Your Deposit Address** - Use `/deposit` to deploy your Smart Contract Wallet
4. **Fund Your Wallet** - Send tokens to your SCW address
5. **Configure Strategy** - Use `/config` to set up your trading parameters
6. **Monitor & Trade** - The bot handles the rest!

***

## Core Concepts

### Smart Contract Wallet (SCW)

When you register, LazaiTrader deploys a personal Smart Contract Wallet for you. This wallet:

* Is **owned by you** - only your registered wallet can receive withdrawals
* Has **deterministic addresses** - same address on every supported chain
* Can **only trade on whitelisted DEXs** - protecting you from malicious contracts

### Automated Trading

Set your strategy parameters:

* **Trigger Percentage** - How much price must move to trigger a trade
* **Trade Percentage** - What portion of your balance to trade
* **Min/Max Amounts** - Bounds for trade sizes
* **Multiplier** - Increase position size on consecutive signals

The bot monitors prices and executes trades automatically when your conditions are met.

***

## Current Status

| Chain           | Status      | DEX         |
| --------------- | ----------- | ----------- |
| Metis Andromeda | **Live**    | HerculesDEX |
| Zircuit         | Coming Soon | -           |
| Lazai           | Coming Soon | -           |
| Base            | Planned     | -           |
| Ethereum        | Planned     | -           |

***

## Get Started

Ready to automate your trading? Head to the [Getting Started](introduction/getting-started.md) guide.

***

## Support

* Telegram: [@LazaiTraderBot](https://t.me/LazaiTraderBot)
* Documentation: You're reading it!
