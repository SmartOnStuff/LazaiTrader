-- =============================================
-- Migration: Simplify UserBalances for historical tracking
-- Date: 2025-12-19
-- Description:
--   Removes UNIQUE constraint from UserBalances to allow historical tracking
--   Adds USDC fields for balance valuations
--   Single table approach - no separate history table needed
-- =============================================

-- Step 1: Create new UserBalances table without UNIQUE constraint
-- SQLite doesn't support dropping constraints, so we need to recreate the table

-- Create temporary table with new structure
CREATE TABLE UserBalances_new (
    BalanceID INTEGER PRIMARY KEY AUTOINCREMENT,
    UserID INTEGER NOT NULL,
    TokenID INTEGER NOT NULL,
    Balance REAL NOT NULL,
    BalanceUSDC REAL,
    PriceUSDC REAL,
    CreatedAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (UserID) REFERENCES Users(UserID),
    FOREIGN KEY (TokenID) REFERENCES Tokens(TokenID)
);

-- Copy existing data (will preserve only the current balances)
INSERT INTO UserBalances_new (UserID, TokenID, Balance, CreatedAt)
SELECT UserID, TokenID, Balance, CreatedAt
FROM UserBalances;

-- Drop old table
DROP TABLE UserBalances;

-- Rename new table
ALTER TABLE UserBalances_new RENAME TO UserBalances;

-- Step 2: Recreate indexes for UserBalances
CREATE INDEX IF NOT EXISTS IX_UserBalances_User ON UserBalances(UserID);
CREATE INDEX IF NOT EXISTS IX_UserBalances_Token ON UserBalances(TokenID);
CREATE INDEX IF NOT EXISTS IX_UserBalances_User_Token_CreatedAt ON UserBalances(UserID, TokenID, CreatedAt DESC);
CREATE INDEX IF NOT EXISTS IX_UserBalances_CreatedAt ON UserBalances(CreatedAt DESC);
CREATE INDEX IF NOT EXISTS IX_UserBalances_Balance ON UserBalances(Balance);

-- Step 3: Update vw_UserBalancesUSDC view
DROP VIEW IF EXISTS vw_UserBalancesUSDC;

CREATE VIEW vw_UserBalancesUSDC AS
WITH LatestBalances AS (
    SELECT
        UserID,
        TokenID,
        Balance,
        BalanceUSDC,
        PriceUSDC,
        CreatedAt,
        ROW_NUMBER() OVER (PARTITION BY UserID, TokenID ORDER BY CreatedAt DESC) AS rn
    FROM UserBalances
)
SELECT
    lb.UserID,
    u.Username,
    u.SCWAddress,
    c.ChainName,
    c.ChainID,
    t.TokenID,
    t.Symbol AS TokenSymbol,
    t.TokenAddress,
    lb.Balance,
    lb.PriceUSDC,
    lb.BalanceUSDC,
    lb.CreatedAt AS LastUpdated
FROM LatestBalances lb
INNER JOIN Users u ON lb.UserID = u.UserID
INNER JOIN Tokens t ON lb.TokenID = t.TokenID
INNER JOIN Chains c ON t.ChainID = c.ChainID
WHERE lb.rn = 1;

-- =============================================
-- Migration Notes:
-- =============================================
--
-- Purpose:
--   Simplifies balance tracking by using a single table (UserBalances)
--   for both current and historical balance tracking.
--
-- UserBalances Table Changes:
--   - REMOVED: UNIQUE(UserID, TokenID) constraint
--   - REMOVED: UpdatedAt field (not needed)
--   - ADDED: BalanceUSDC (nullable) - Balance value in USDC
--   - ADDED: PriceUSDC (nullable) - Token price in USDC at check time
--   - Each balance check creates a NEW row (not an update)
--
-- How It Works:
--   - Every balance check (from /balance command or scheduled worker) INSERTs a new row
--   - Each row has unique BalanceID and CreatedAt timestamp
--   - To get latest balance: ORDER BY CreatedAt DESC LIMIT 1
--   - To get historical balances: Query all rows for user/token
--   - View (vw_UserBalancesUSDC) shows latest balance per user/token
--
-- Benefits:
--   ✅ Single table - no redundancy
--   ✅ Historical tracking built-in
--   ✅ Simpler architecture
--   ✅ No UNIQUE constraint issues
--   ✅ Each row is immutable (INSERT only)
--
-- Workflow:
--   User calls /balance command:
--     → Fetches balance from blockchain
--     → Gets price (±5 min cache)
--     → INSERTs new row into UserBalances
--
--   Scheduled worker runs every 5 minutes:
--     → Fetches balances for all users
--     → INSERTs new rows into UserBalances
--     → Compares with previous row for deposit detection
--
-- Deposit Detection:
--   1. Get previous row: SELECT * WHERE UserID=? AND TokenID=? ORDER BY CreatedAt DESC LIMIT 1 OFFSET 1
--   2. Calculate expected balance based on trades/withdrawals
--   3. If actual > expected, difference is a deposit
--
-- Example Queries:
--   -- Get latest balance for a user/token
--   SELECT * FROM vw_UserBalancesUSDC WHERE UserID = 1 AND TokenID = 1;
--
--   -- Get balance history for a user/token
--   SELECT CreatedAt, Balance, BalanceUSDC, PriceUSDC
--   FROM UserBalances
--   WHERE UserID = 1 AND TokenID = 1
--   ORDER BY CreatedAt DESC
--   LIMIT 100;
--
--   -- Get total portfolio value over time
--   SELECT
--     DATE(CreatedAt) as Date,
--     SUM(BalanceUSDC) as TotalUSDC
--   FROM UserBalances
--   WHERE UserID = 1
--   GROUP BY DATE(CreatedAt)
--   ORDER BY Date DESC;
--
--   -- Get previous balance (for deposit detection)
--   SELECT Balance, BalanceUSDC, CreatedAt
--   FROM UserBalances
--   WHERE UserID = 1 AND TokenID = 1
--   ORDER BY CreatedAt DESC
--   LIMIT 1 OFFSET 1;
--
-- =============================================
