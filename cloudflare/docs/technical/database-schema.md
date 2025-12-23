# Database Schema

Complete reference for LazaiTrader's Cloudflare D1 database schema.

---

## Overview

LazaiTrader uses Cloudflare D1 (SQLite) for data persistence.

- **16 Tables** - Core data storage
- **7+ Views** - Pre-built queries
- **Comprehensive indexes** - Query optimization

---

## Core Tables

### Chains

Supported blockchain networks.

```sql
CREATE TABLE Chains (
    ChainID INTEGER PRIMARY KEY,
    ChainName TEXT NOT NULL UNIQUE,
    RPCEndpoint TEXT NOT NULL,
    ExplorerURL TEXT NOT NULL,
    NativeCurrency TEXT NOT NULL,
    IsActive INTEGER DEFAULT 1,
    CreatedAt TEXT DEFAULT (datetime('now')),
    UpdatedAt TEXT DEFAULT (datetime('now'))
);
```

### Users

Registered users with wallet addresses.

```sql
CREATE TABLE Users (
    UserID INTEGER PRIMARY KEY,
    UserWallet TEXT NOT NULL UNIQUE,
    SCWAddress TEXT,
    TelegramChatID TEXT NOT NULL UNIQUE,
    Username TEXT,
    RegisteredAt TEXT NOT NULL,
    IsActive INTEGER DEFAULT 1,
    CreatedAt TEXT DEFAULT (datetime('now')),
    UpdatedAt TEXT DEFAULT (datetime('now'))
);
```

### Tokens

ERC20 tokens per chain.

```sql
CREATE TABLE Tokens (
    TokenID INTEGER PRIMARY KEY AUTOINCREMENT,
    ChainID INTEGER NOT NULL,
    Symbol TEXT NOT NULL,
    TokenAddress TEXT NOT NULL,
    Decimals INTEGER NOT NULL,
    IsActive INTEGER DEFAULT 1,
    CreatedAt TEXT DEFAULT (datetime('now')),
    UpdatedAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (ChainID) REFERENCES Chains(ChainID),
    UNIQUE(Symbol, ChainID),
    UNIQUE(TokenAddress, ChainID)
);
```

### TradingPairs

Trading pairs with DEX configuration.

```sql
CREATE TABLE TradingPairs (
    PairID INTEGER PRIMARY KEY AUTOINCREMENT,
    ChainID INTEGER NOT NULL,
    PairName TEXT NOT NULL,
    BaseTokenID INTEGER NOT NULL,
    QuoteTokenID INTEGER NOT NULL,
    DEXAddress TEXT NOT NULL,
    DEXType TEXT,
    IsActive INTEGER DEFAULT 1,
    CreatedAt TEXT DEFAULT (datetime('now')),
    UpdatedAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (ChainID) REFERENCES Chains(ChainID),
    FOREIGN KEY (BaseTokenID) REFERENCES Tokens(TokenID),
    FOREIGN KEY (QuoteTokenID) REFERENCES Tokens(TokenID),
    UNIQUE(PairName, ChainID)
);
```

---

## Strategy Tables

### UserTradingConfigs

User trading strategy configurations.

```sql
CREATE TABLE UserTradingConfigs (
    ConfigID INTEGER PRIMARY KEY AUTOINCREMENT,
    UserID INTEGER NOT NULL,
    PairID INTEGER NOT NULL,
    TradePercentage REAL NOT NULL,      -- 0.0 to 1.0
    TriggerPercentage REAL NOT NULL,    -- 0.0 to 1.0
    MaxAmount REAL NOT NULL,            -- USD
    MinimumAmount REAL NOT NULL,        -- USD
    Multiplier REAL NOT NULL,           -- 1.0 to 3.0
    IsActive INTEGER DEFAULT 1,
    CreatedAt TEXT DEFAULT (datetime('now')),
    UpdatedAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (UserID) REFERENCES Users(UserID),
    FOREIGN KEY (PairID) REFERENCES TradingPairs(PairID),
    UNIQUE(UserID, PairID)
);
```

### UserStrategyPending

Pending strategy selections during configuration.

```sql
CREATE TABLE UserStrategyPending (
    PendingID INTEGER PRIMARY KEY AUTOINCREMENT,
    UserID INTEGER NOT NULL,
    PairID INTEGER NOT NULL,
    CreatedAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (UserID) REFERENCES Users(UserID),
    FOREIGN KEY (PairID) REFERENCES TradingPairs(PairID),
    UNIQUE(UserID, PairID)
);
```

---

## Price Tables

### PriceAPIEndpoints

Price API sources with fallback support.

```sql
CREATE TABLE PriceAPIEndpoints (
    EndpointID INTEGER PRIMARY KEY AUTOINCREMENT,
    BasePairSymbol TEXT NOT NULL,       -- e.g., 'ETH-USDC'
    Provider TEXT NOT NULL,             -- 'binance', 'coingecko', etc.
    EndpointURL TEXT NOT NULL,
    ApiKeyEnvVar TEXT,
    Priority INTEGER DEFAULT 1,         -- Lower = higher priority
    IsActive INTEGER DEFAULT 1,
    LastSuccessAt TEXT,
    LastFailureAt TEXT,
    ConsecutiveFailures INTEGER DEFAULT 0,
    ResponseSchema TEXT,
    CreatedAt TEXT DEFAULT (datetime('now')),
    UpdatedAt TEXT DEFAULT (datetime('now')),
    UNIQUE(BasePairSymbol, Provider)
);
```

### CachedPrices

Most recent fetched price per base pair.

```sql
CREATE TABLE CachedPrices (
    CacheID INTEGER PRIMARY KEY AUTOINCREMENT,
    BasePairSymbol TEXT NOT NULL UNIQUE,
    Price REAL NOT NULL,
    Provider TEXT NOT NULL,
    FetchedAt TEXT DEFAULT (datetime('now'))
);
```

### PriceHistory

Historical prices for trading pairs.

```sql
CREATE TABLE PriceHistory (
    PriceID INTEGER PRIMARY KEY AUTOINCREMENT,
    PairID INTEGER NOT NULL,
    Price REAL NOT NULL,
    CreatedAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (PairID) REFERENCES TradingPairs(PairID)
);
```

---

## Trade Tables

### Trades

Executed trade records.

```sql
CREATE TABLE Trades (
    TradeID INTEGER PRIMARY KEY AUTOINCREMENT,
    PairID INTEGER NOT NULL,
    UserID INTEGER NOT NULL,
    PriceID INTEGER NOT NULL,
    Action TEXT NOT NULL,               -- 'BUY' or 'SELL'
    TokenSent INTEGER,
    TokenReceived INTEGER,
    QuantitySent REAL NOT NULL,
    QuantityReceived REAL NOT NULL,
    TxHash TEXT NOT NULL UNIQUE,
    CreatedAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (PairID) REFERENCES TradingPairs(PairID),
    FOREIGN KEY (UserID) REFERENCES Users(UserID),
    FOREIGN KEY (PriceID) REFERENCES PriceHistory(PriceID),
    CHECK (Action IN ('BUY', 'SELL'))
);
```

### TradeMetrics

Additional metrics for trades.

```sql
CREATE TABLE TradeMetrics (
    MetricID INTEGER PRIMARY KEY AUTOINCREMENT,
    TradeID INTEGER NOT NULL,
    ConsecutiveCount INTEGER NOT NULL,
    ActualTradePercentage REAL NOT NULL,
    CreatedAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (TradeID) REFERENCES Trades(TradeID),
    UNIQUE(TradeID)
);
```

---

## Financial Tables

### UserBalances

User token balances (historical tracking).

```sql
CREATE TABLE UserBalances (
    BalanceID INTEGER PRIMARY KEY AUTOINCREMENT,
    UserID INTEGER NOT NULL,
    TokenID INTEGER NOT NULL,
    Balance REAL NOT NULL,
    BalanceUSDC REAL,
    PriceUSDC REAL,
    CreatedAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (UserID) REFERENCES Users(UserID),
    FOREIGN KEY (TokenID) REFERENCES Tokens(TokenID)
    -- NO UNIQUE constraint - allows historical tracking
);
```

### DepositTransactions

User deposits to SCW.

```sql
CREATE TABLE DepositTransactions (
    DepositID INTEGER PRIMARY KEY AUTOINCREMENT,
    UserID INTEGER NOT NULL,
    ChainID INTEGER NOT NULL,
    SCWAddress TEXT NOT NULL,
    FromAddress TEXT,
    TokenAddress TEXT,
    Amount REAL NOT NULL,
    TxHash TEXT UNIQUE,
    ConfirmationCount INTEGER DEFAULT 0,
    Status TEXT DEFAULT 'pending',
    CreatedAt TEXT DEFAULT (datetime('now')),
    ConfirmedAt TEXT,
    FOREIGN KEY (UserID) REFERENCES Users(UserID),
    FOREIGN KEY (ChainID) REFERENCES Chains(ChainID)
);
```

### Withdrawals

User withdrawals from SCW.

```sql
CREATE TABLE Withdrawals (
    WithdrawalID INTEGER PRIMARY KEY AUTOINCREMENT,
    UserID INTEGER NOT NULL,
    SCWAddress TEXT NOT NULL,
    TokenID INTEGER NOT NULL,
    TokenAddress TEXT NOT NULL,
    Amount TEXT NOT NULL,
    AmountFormatted TEXT,
    RecipientAddress TEXT NOT NULL,
    TxHash TEXT NOT NULL UNIQUE,
    ChainID INTEGER NOT NULL,
    Status TEXT DEFAULT 'confirmed',
    WithdrawnAt TEXT DEFAULT (datetime('now')),
    CreatedAt TEXT DEFAULT (datetime('now')),
    UpdatedAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (UserID) REFERENCES Users(UserID),
    FOREIGN KEY (TokenID) REFERENCES Tokens(TokenID),
    FOREIGN KEY (ChainID) REFERENCES Chains(ChainID),
    CHECK (Status IN ('pending', 'confirmed', 'failed'))
);
```

---

## Auxiliary Tables

### SCWDeployments

Smart Contract Wallet deployments per user/chain.

```sql
CREATE TABLE SCWDeployments (
    DeploymentID INTEGER PRIMARY KEY AUTOINCREMENT,
    UserID INTEGER NOT NULL,
    ChainID INTEGER NOT NULL,
    SCWAddress TEXT NOT NULL,
    DeploymentStatus TEXT DEFAULT 'success',
    TxHash TEXT,
    DeployedAt TEXT DEFAULT (datetime('now')),
    UpdatedAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (UserID) REFERENCES Users(UserID),
    FOREIGN KEY (ChainID) REFERENCES Chains(ChainID),
    UNIQUE(UserID, ChainID)
);
```

### RegistrationSessions

User registration flow state. Tracks legal agreement and wallet submission.

**State values:**
- `awaiting_legal` - User has started registration, awaiting legal agreement
- `awaiting_wallet` - User agreed to terms, awaiting wallet address

```sql
CREATE TABLE RegistrationSessions (
    SessionID INTEGER PRIMARY KEY AUTOINCREMENT,
    UserID INTEGER NOT NULL UNIQUE,
    TelegramChatID TEXT NOT NULL,
    Username TEXT,
    State TEXT NOT NULL,           -- 'awaiting_legal' or 'awaiting_wallet'
    LegalAgreedAt TEXT,            -- Timestamp when user agreed to terms
    CreatedAt TEXT DEFAULT (datetime('now')),
    UpdatedAt TEXT DEFAULT (datetime('now'))
);
```

### Suggestions

User suggestions/feedback.

```sql
CREATE TABLE Suggestions (
    SuggestionID INTEGER PRIMARY KEY AUTOINCREMENT,
    UserID INTEGER NOT NULL,
    Suggestion TEXT NOT NULL,
    InputData TEXT,
    CreatedAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (UserID) REFERENCES Users(UserID)
);
```

---

## Key Views

### vw_ActiveUserTradingConfigs

Active trading configurations with user/pair details.

### vw_TradeSummaryByUserPair

Aggregated trade statistics per user/pair.

### vw_LatestPricesByPair

Most recent price for each trading pair.

### vw_UserBalancesUSDC

Latest balance per user/token with USDC values.

### vw_TradeDetails

Trade records with metrics joined.

### vw_WithdrawalSummary

Withdrawal history with all details.

---

## Indexes

Key indexes for query optimization:

```sql
-- Users
CREATE INDEX IX_Users_SCWAddress ON Users(SCWAddress);

-- Trades
CREATE INDEX IX_Trades_User_CreatedAt ON Trades(UserID, CreatedAt DESC);

-- UserBalances
CREATE INDEX IX_UserBalances_User_Token_CreatedAt
    ON UserBalances(UserID, TokenID, CreatedAt DESC);

-- PriceHistory
CREATE INDEX IX_PriceHistory_Pair_CreatedAt
    ON PriceHistory(PairID, CreatedAt DESC);
```

---

## Querying Examples

### Get User's Latest Balances

```sql
SELECT * FROM vw_UserBalancesUSDC WHERE UserID = ?;
```

### Get User's Trade History

```sql
SELECT * FROM vw_TradeDetails
WHERE UserID = ?
ORDER BY CreatedAt DESC
LIMIT 100;
```

### Get Active Configs for Processing

```sql
SELECT * FROM vw_ActiveUserTradingConfigs;
```

---

## Further Reading

- [Architecture Overview](architecture-overview.md) - System design
- [For Developers](for-developers/README.md) - Development guide
