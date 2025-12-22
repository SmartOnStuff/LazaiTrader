# LazaiTrader Balance Tracker Worker

Scheduled worker that automatically tracks user balances across all chains and tokens, detects deposits, and maintains balance history with USDC valuations.

## Overview

This worker runs on a schedule (every 5 minutes in production) to:

1. **Check Balances**: Fetch balances for all active users on all active chains/tokens
2. **Store Snapshots**: Insert new rows into UserBalances table
3. **Detect Deposits**: Compare balances with previous snapshots and identify deposits
4. **Track Deposits**: Record detected deposits in DepositTransactions table

## Architecture

### Single-Table Design

**UserBalances** (Both Current AND Historical)
- **NO UNIQUE constraint** - allows multiple records per user/token
- Each balance check creates a **new row** (INSERT only, no UPDATE)
- Each row has unique `BalanceID` and `CreatedAt` timestamp
- Updated by **both** `/balance` command (real-time) and scheduled worker (every 5 min)
- Latest balance: `ORDER BY CreatedAt DESC LIMIT 1`
- Historical tracking: Query all rows for user/token

### Why This Design?

✅ **Single Table** - No redundancy, no separate history table
✅ **Immutable Rows** - Each row is INSERT-only (never updated)
✅ **Historical Tracking** - Built-in with CreatedAt timestamps
✅ **Real-time Updates** - User's `/balance` call creates immediate row
✅ **Deposit Detection** - Compare consecutive rows
✅ **Simpler Architecture** - One table to rule them all!

## How It Works

### Balance Tracking

1. Fetches all active users with SCW addresses
2. For each user, iterates through all active chains
3. For each chain, fetches all active tokens
4. Queries the blockchain for current token balance
5. **INSERTs new row** into UserBalances with USDC values

### USDC Valuation

- Uses the `priceHelper.js` utility to fetch token prices
- Implements ±5 minute caching for price data
- If recent price exists (within 5 min), uses cached value
- Otherwise, fetches fresh price from configured API endpoints
- Calculates `BalanceUSDC = Balance * PriceUSDC`

### Deposit Detection

The worker intelligently detects deposits by:

1. **Getting Previous Snapshot**: Fetch most recent row from `UserBalances`
   ```sql
   SELECT * FROM UserBalances
   WHERE UserID = ? AND TokenID = ?
   ORDER BY CreatedAt DESC
   LIMIT 1
   ```

2. **Calculating Expected Balance**:
   - Start with previous balance
   - Add tokens received from trades
   - Subtract tokens sent in trades
   - Subtract confirmed withdrawals

3. **Detecting Deposits**:
   - If `actual balance > expected balance`, difference is a deposit
   - Records deposit in `DepositTransactions` table

Example:
```
Previous Balance: 100 USDC
Trades: +50 USDC (received), -20 USDC (sent)
Withdrawals: -10 USDC
Expected Balance: 100 + 50 - 20 - 10 = 120 USDC
Actual Balance: 150 USDC
Deposit Detected: 150 - 120 = 30 USDC ✅
```

## Database Schema

### UserBalances Table

```sql
CREATE TABLE UserBalances (
    BalanceID INTEGER PRIMARY KEY AUTOINCREMENT,
    UserID INTEGER NOT NULL,
    TokenID INTEGER NOT NULL,
    Balance REAL NOT NULL,
    BalanceUSDC REAL,           -- Balance in USDC
    PriceUSDC REAL,             -- Token price in USDC
    CreatedAt TEXT,             -- When this balance was recorded
    -- NO UNIQUE CONSTRAINT - allows historical tracking
);
```

**Key Points:**
- No UNIQUE constraint - multiple rows per user/token
- Each row is immutable (INSERT only, never UPDATE)
- CreatedAt provides time-series data

### vw_UserBalancesUSDC View

Shows the **latest** balance per user/token:

```sql
SELECT * FROM vw_UserBalancesUSDC WHERE UserID = 1;
```

Uses `ROW_NUMBER()` window function to get latest row per user/token.

Returns:
- UserID, Username, SCWAddress
- ChainName, TokenSymbol
- Balance, PriceUSDC, BalanceUSDC
- LastUpdated (CreatedAt of latest row)

## Schedule

- **Production**: Every 5 minutes (`*/5 * * * *`)
- **Staging**: Every 15 minutes (`*/15 * * * *`)
- **Development**: Once a day (`0 0 * * *`)

## Deployment

### Apply Database Migration

```bash
# IMPORTANT: This migration recreates UserBalances table
# It will preserve existing balances but drop historical data
wrangler d1 execute lazaitrader --file=cloudflare/database/migrations/002_simplify_user_balances.sql
```

### Install Dependencies

```bash
cd cloudflare/lt_balance_tracker
npm install
```

### Set Secrets

```bash
wrangler secret put WORKER_SECRET
```

### Deploy

```bash
npm run deploy
```

## API Endpoints

### GET /health
Health check endpoint.

### POST /trigger
Manually trigger balance tracking (requires Bearer token).

### GET /status
Get worker statistics.

## Monitoring

### Query Latest Balances

```sql
-- Get latest balance for a user
SELECT * FROM vw_UserBalancesUSDC WHERE UserID = 1;
```

### Query Balance History

```sql
-- Get balance history for a specific user/token
SELECT CreatedAt, Balance, BalanceUSDC, PriceUSDC
FROM UserBalances
WHERE UserID = 1 AND TokenID = 1
ORDER BY CreatedAt DESC
LIMIT 100;
```

### Query Portfolio Value Over Time

```sql
SELECT
    DATE(CreatedAt) as Date,
    SUM(BalanceUSDC) as TotalUSDC
FROM UserBalances
WHERE UserID = 1
GROUP BY DATE(CreatedAt)
ORDER BY Date DESC;
```

## Cleanup Old Data

```sql
-- Delete balance records older than 90 days
DELETE FROM UserBalances
WHERE CreatedAt < datetime('now', '-90 days');
```

## Dependencies

- **ethers**: Ethereum library
- **priceHelper.js**: Price fetching with ±5 min caching
- **priceParser.js**: API response parsing
