# LazaiTrader Database Schema

This directory contains the Cloudflare D1 (SQLite) database schema for LazaiTrader.

## Files

- `schema.sql` - Complete database schema synced with production

## Schema Overview

### Tables (16 total)

| Table | Description |
|-------|-------------|
| `Chains` | Supported blockchain networks |
| `Users` | Registered users with wallet addresses |
| `Tokens` | ERC20 tokens per chain |
| `TradingPairs` | Trading pairs with DEX configuration |
| `UserTradingConfigs` | User trading strategy settings |
| `PriceAPIEndpoints` | Price API sources with fallback support |
| `CachedPrices` | Most recent fetched prices |
| `PriceHistory` | Historical price records |
| `Trades` | Executed trade records |
| `TradeMetrics` | Additional trade metrics |
| `UserBalances` | Cached user token balances |
| `Suggestions` | User feedback/suggestions |
| `RegistrationSessions` | User registration flow state |
| `SCWDeployments` | Smart Contract Wallet deployments |
| `DepositTransactions` | User deposits to SCW |
| `Withdrawals` | User withdrawals from SCW |
| `UserStrategyPending` | Pending strategy selections |

### Views (7 total)

| View | Description |
|------|-------------|
| `vw_ActiveUserTradingConfigs` | Active trading configurations with user/pair details |
| `vw_TradeSummaryByUserPair` | Aggregated trade statistics per user/pair |
| `vw_LatestPricesByPair` | Most recent price for each trading pair |
| `vw_UserBalances` | User balances with token details |
| `vw_TradeDetails` | Trade records with metrics joined |
| `vw_UserWithdrawalHistory` | User withdrawal history |
| `vw_WithdrawalSummary` | Withdrawal summary with all details |

## Usage

### Query Current Schema from Production

```bash
npx wrangler d1 execute <DATABASE_NAME> --command="SELECT type, name, sql FROM sqlite_master WHERE type IN ('table', 'index', 'view') AND name NOT LIKE 'sqlite_%' ORDER BY type, name;"
```

### Apply Schema to New Database

```bash
npx wrangler d1 execute <DATABASE_NAME> --file=cloudflare/database/schema.sql
```

## Key Schema Details

### Trades Table

The `Trades` table tracks all executed trades with the following key columns:

| Column | Type | Description |
|--------|------|-------------|
| `TradeID` | INTEGER | Primary key |
| `PairID` | INTEGER | Trading pair reference |
| `UserID` | INTEGER | User who executed the trade |
| `PriceID` | INTEGER | Price at time of trade |
| `Action` | TEXT | 'BUY' or 'SELL' |
| `TokenSent` | INTEGER | Token ID that was sold/sent |
| `TokenReceived` | INTEGER | Token ID that was bought/received |
| `QuantitySent` | REAL | Actual quantity of TokenSent that was sold |
| `QuantityReceived` | REAL | Actual quantity of TokenReceived that was received |
| `TxHash` | TEXT | Transaction hash |
| `CreatedAt` | TEXT | Trade timestamp |

**Examples:**

SELL 1 ETH for 3000 USDC:
- `Action`: SELL
- `TokenSent`: ETH TokenID
- `TokenReceived`: USDC TokenID
- `QuantitySent`: 1.0
- `QuantityReceived`: 3000.0

BUY 1 ETH with 3000 USDC:
- `Action`: BUY
- `TokenSent`: USDC TokenID
- `TokenReceived`: ETH TokenID
- `QuantitySent`: 3000.0
- `QuantityReceived`: 1.0

## Migrations

Migration scripts are located in `cloudflare/database/migrations/`.

### Applying Migrations

To apply a migration file:

```bash
npx wrangler d1 execute <DATABASE_NAME> --file=cloudflare/database/migrations/<MIGRATION_FILE>.sql
```

To run a single command:

```bash
npx wrangler d1 execute <DATABASE_NAME> --command="<SQL_STATEMENT>"
```

After applying migrations, update `schema.sql` to reflect the current production state.

### Recent Migrations

- `001_add_token_columns_to_trades.sql` - Added `TokenSent` and `TokenReceived` columns to clarify which tokens were exchanged
