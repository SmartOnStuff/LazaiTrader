# LazaiTrader Chart Worker

Cloudflare Worker that generates trade history charts for LazaiTrader Telegram bot users.

## Overview

This worker queries the database for user trades, deposits, withdrawals, and balance history, calculates trading statistics (including proper PnL with deposits/withdrawals consideration), and generates visual charts using the QuickChart.io API.

## Features

- **Token Price Lines**: Shows price lines for each token (ETH, BTC, METIS, etc.) normalized across chains
- **Buy/Sell Markers**: Green dots for buys, red dots for sells positioned on the price lines
- **Cross-Chain Normalization**: Maps token variants (WETH, GETH → ETH) using shared token mappings
- **Proper PnL Calculation**: PnL = Current Portfolio + Withdrawals - Deposits
- **Balance History Integration**: Uses UserBalances table for price data
- **Statistics Summary**: Trade count, buy/sell ratio, portfolio value, and trading period

## API

### Endpoint

POST request to the worker URL.

### Request

```json
{
  "userId": 123456789
}
```

### Response

Success:
```json
{
  "success": true,
  "chartUrl": "https://quickchart.io/chart/render/...",
  "stats": {
    "totalTrades": 25,
    "totalDeposits": 3,
    "totalWithdrawals": 1,
    "buyCount": 15,
    "sellCount": 10,
    "totalDepositedUSDC": 1000.0,
    "totalWithdrawnUSDC": 200.0,
    "currentPortfolioUSDC": 1150.0,
    "pnlAbsolute": 350.0,
    "pnlPercentage": 35.0,
    "firstTradeDate": "2024-01-01T10:00:00Z",
    "lastTradeDate": "2024-01-31T15:30:00Z",
    "tokensTraded": ["ETH", "BTC", "METIS"]
  },
  "tradeCount": 25,
  "depositCount": 3,
  "withdrawalCount": 1
}
```

Error:
```json
{
  "success": false,
  "error": "No trading or balance history found",
  "errorCode": "NO_DATA"
}
```

## Database Tables Used

- **Trades**: User trading history with token details
- **DepositTransactions**: User deposit history
- **Withdrawals**: User withdrawal history
- **UserBalances**: Historical balance snapshots with USDC values
- **PriceHistory**: Price data for trading pairs
- **TradingPairs**: Trading pair information
- **Tokens**: Token information

## Chart Features

The generated chart includes:
- **Price Lines**: Colored lines for each token (ETH=#627EEA, BTC=#F7931A, METIS=#00D395)
- **Green Dots**: Buy orders positioned at the trade price
- **Red Dots**: Sell orders positioned at the trade price
- **Title**: Shows PnL percentage, absolute gain/loss, and trade count
- **Legend**: Token price lines (buy/sell markers hidden from legend to reduce clutter)
- **Date Axis**: YYYY-MM-DD formatted labels

## Token Symbol Normalization

Uses shared `tokenMappings.json` for cross-chain compatibility:
- WETH, GETH → ETH
- WBTC, GBTC → BTC
- M.USDC, GUSDC, USDC.E → USDC
- WMETIS → METIS

## PnL Calculation

The PnL formula properly accounts for deposits and withdrawals:

```
PnL = Current Portfolio Value + Total Withdrawals - Total Deposits
```

This ensures:
- Deposits are treated as cost basis (money in)
- Withdrawals are treated as realized gains (money out)
- Current holdings represent unrealized gains

## Dependencies

- QuickChart.io API (external service)
- D1 Database binding
- Shared `priceHelper.js` for token normalization

## Deployment

```bash
cd cloudflare/lt_tg_chart
npm install
wrangler deploy
```

## Service Binding

Add to parent worker's `wrangler.toml`:

```toml
[[services]]
binding = "CHART_WORKER"
service = "lt-tg-chart"
```

## Environment Variables

None required. Uses D1 database binding configured in wrangler.toml.
