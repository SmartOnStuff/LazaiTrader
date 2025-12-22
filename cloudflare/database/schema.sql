-- =============================================
-- LazaiTrader Database Schema
-- Cloudflare D1 (SQLite)
-- Last synced with production: 2025-12-16
-- =============================================

-- =============================================
-- TABLES
-- =============================================

-- TABLE: Chains
-- Supported blockchain networks
CREATE TABLE IF NOT EXISTS Chains (
    ChainID INTEGER PRIMARY KEY,
    ChainName TEXT NOT NULL UNIQUE,
    RPCEndpoint TEXT NOT NULL,
    ExplorerURL TEXT NOT NULL,
    NativeCurrency TEXT NOT NULL,
    IsActive INTEGER DEFAULT 1,
    CreatedAt TEXT DEFAULT (datetime('now')),
    UpdatedAt TEXT DEFAULT (datetime('now'))
);

-- TABLE: Users
-- Registered users with their wallets
CREATE TABLE IF NOT EXISTS Users (
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

-- TABLE: Tokens
-- ERC20 tokens per chain
CREATE TABLE IF NOT EXISTS Tokens (
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
    UNIQUE(TokenAddress, ChainID),
    CHECK (Decimals >= 0 AND Decimals <= 18)
);

-- TABLE: TradingPairs
-- Trading pairs with DEX configuration
CREATE TABLE IF NOT EXISTS TradingPairs (
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
    UNIQUE(PairName, ChainID),
    CHECK (BaseTokenID != QuoteTokenID)
);

-- TABLE: UserTradingConfigs
-- User trading strategy configurations per pair
CREATE TABLE IF NOT EXISTS UserTradingConfigs (
    ConfigID INTEGER PRIMARY KEY AUTOINCREMENT,
    UserID INTEGER NOT NULL,
    PairID INTEGER NOT NULL,
    TradePercentage REAL NOT NULL,
    TriggerPercentage REAL NOT NULL,
    MaxAmount REAL NOT NULL,
    MinimumAmount REAL NOT NULL,
    Multiplier REAL NOT NULL,
    IsActive INTEGER DEFAULT 1,
    CreatedAt TEXT DEFAULT (datetime('now')),
    UpdatedAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (UserID) REFERENCES Users(UserID),
    FOREIGN KEY (PairID) REFERENCES TradingPairs(PairID),
    UNIQUE(UserID, PairID),
    CHECK (TradePercentage >= 0 AND TradePercentage <= 1),
    CHECK (TriggerPercentage >= 0 AND TriggerPercentage <= 1),
    CHECK (MaxAmount >= MinimumAmount)
);

-- TABLE: PriceAPIEndpoints
-- Price API sources with fallback support
CREATE TABLE IF NOT EXISTS PriceAPIEndpoints (
    EndpointID INTEGER PRIMARY KEY AUTOINCREMENT,
    BasePairSymbol TEXT NOT NULL,
    Provider TEXT NOT NULL,
    EndpointURL TEXT NOT NULL,
    ApiKeyEnvVar TEXT,
    Priority INTEGER DEFAULT 1,
    IsActive INTEGER DEFAULT 1,
    LastSuccessAt TEXT,
    LastFailureAt TEXT,
    ConsecutiveFailures INTEGER DEFAULT 0,
    ResponseSchema TEXT,
    CreatedAt TEXT DEFAULT (datetime('now')),
    UpdatedAt TEXT DEFAULT (datetime('now')),
    UNIQUE(BasePairSymbol, Provider)
);

-- TABLE: CachedPrices
-- Most recent fetched price per base pair
CREATE TABLE IF NOT EXISTS CachedPrices (
    CacheID INTEGER PRIMARY KEY AUTOINCREMENT,
    BasePairSymbol TEXT NOT NULL UNIQUE,
    Price REAL NOT NULL,
    Provider TEXT NOT NULL,
    FetchedAt TEXT DEFAULT (datetime('now'))
);

-- TABLE: PriceHistory
-- Historical prices for trading pairs
CREATE TABLE IF NOT EXISTS PriceHistory (
    PriceID INTEGER PRIMARY KEY AUTOINCREMENT,
    PairID INTEGER NOT NULL,
    Price REAL NOT NULL,
    CreatedAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (PairID) REFERENCES TradingPairs(PairID)
);

-- TABLE: Trades
-- Executed trades
CREATE TABLE IF NOT EXISTS Trades (
    TradeID INTEGER PRIMARY KEY AUTOINCREMENT,
    PairID INTEGER NOT NULL,
    UserID INTEGER NOT NULL,
    PriceID INTEGER NOT NULL,
    Action TEXT NOT NULL,
    TokenSent INTEGER,
    TokenReceived INTEGER,
    QuantitySent REAL NOT NULL,
    QuantityReceived REAL NOT NULL,
    TxHash TEXT NOT NULL UNIQUE,
    CreatedAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (PairID) REFERENCES TradingPairs(PairID),
    FOREIGN KEY (UserID) REFERENCES Users(UserID),
    FOREIGN KEY (PriceID) REFERENCES PriceHistory(PriceID),
    FOREIGN KEY (TokenSent) REFERENCES Tokens(TokenID),
    FOREIGN KEY (TokenReceived) REFERENCES Tokens(TokenID),
    CHECK (Action IN ('BUY', 'SELL'))
);

-- TABLE: TradeMetrics
-- Additional metrics for trades
CREATE TABLE IF NOT EXISTS TradeMetrics (
    MetricID INTEGER PRIMARY KEY AUTOINCREMENT,
    TradeID INTEGER NOT NULL,
    ConsecutiveCount INTEGER NOT NULL,
    ActualTradePercentage REAL NOT NULL,
    CreatedAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (TradeID) REFERENCES Trades(TradeID),
    UNIQUE(TradeID)
);

-- TABLE: UserBalances
-- User token balances (historical tracking with each balance check)
-- Each balance check creates a new row (no UNIQUE constraint)
-- Updated by both /balance command (real-time) and scheduled worker (every 5 min)
CREATE TABLE IF NOT EXISTS UserBalances (
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

-- TABLE: Suggestions
-- User suggestions/feedback
CREATE TABLE IF NOT EXISTS Suggestions (
    SuggestionID INTEGER PRIMARY KEY AUTOINCREMENT,
    UserID INTEGER NOT NULL,
    Suggestion TEXT NOT NULL,
    InputData TEXT,
    CreatedAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (UserID) REFERENCES Users(UserID)
);

-- TABLE: RegistrationSessions
-- User registration flow state
CREATE TABLE IF NOT EXISTS RegistrationSessions (
    SessionID INTEGER PRIMARY KEY AUTOINCREMENT,
    UserID INTEGER NOT NULL UNIQUE,
    TelegramChatID TEXT NOT NULL,
    Username TEXT,
    State TEXT NOT NULL,
    CreatedAt TEXT DEFAULT (datetime('now')),
    UpdatedAt TEXT DEFAULT (datetime('now'))
);

-- TABLE: SCWDeployments
-- Smart Contract Wallet deployments per user/chain
CREATE TABLE IF NOT EXISTS SCWDeployments (
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

-- TABLE: DepositTransactions
-- User deposits to SCW
CREATE TABLE IF NOT EXISTS DepositTransactions (
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

-- TABLE: Withdrawals
-- User withdrawals from SCW
CREATE TABLE IF NOT EXISTS Withdrawals (
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

-- TABLE: UserStrategyPending
-- Pending strategy selections
CREATE TABLE IF NOT EXISTS UserStrategyPending (
    PendingID INTEGER PRIMARY KEY AUTOINCREMENT,
    UserID INTEGER NOT NULL,
    PairID INTEGER NOT NULL,
    CreatedAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (UserID) REFERENCES Users(UserID),
    FOREIGN KEY (PairID) REFERENCES TradingPairs(PairID),
    UNIQUE(UserID, PairID)
);

-- =============================================
-- INDEXES
-- =============================================

-- Chains
CREATE INDEX IF NOT EXISTS IX_Chains_ChainName ON Chains(ChainName);
CREATE INDEX IF NOT EXISTS IX_Chains_IsActive ON Chains(IsActive);

-- Users
CREATE INDEX IF NOT EXISTS IX_Users_Username ON Users(Username);
CREATE INDEX IF NOT EXISTS IX_Users_SCWAddress ON Users(SCWAddress);

-- Tokens
CREATE INDEX IF NOT EXISTS IX_Tokens_Symbol ON Tokens(Symbol);
CREATE INDEX IF NOT EXISTS IX_Tokens_ChainID ON Tokens(ChainID);

-- TradingPairs
CREATE INDEX IF NOT EXISTS IX_TradingPairs_ChainID ON TradingPairs(ChainID);
CREATE INDEX IF NOT EXISTS IX_TradingPairs_BaseToken ON TradingPairs(BaseTokenID);
CREATE INDEX IF NOT EXISTS IX_TradingPairs_QuoteToken ON TradingPairs(QuoteTokenID);

-- UserTradingConfigs
CREATE INDEX IF NOT EXISTS IX_UserTradingConfigs_User ON UserTradingConfigs(UserID);
CREATE INDEX IF NOT EXISTS IX_UserTradingConfigs_Pair ON UserTradingConfigs(PairID);

-- PriceAPIEndpoints
CREATE INDEX IF NOT EXISTS IX_PriceAPIEndpoints_BasePair_Priority ON PriceAPIEndpoints(BasePairSymbol, Priority, IsActive);
CREATE INDEX IF NOT EXISTS IX_PriceAPIEndpoints_Provider ON PriceAPIEndpoints(Provider);

-- CachedPrices
CREATE INDEX IF NOT EXISTS IX_CachedPrices_FetchedAt ON CachedPrices(FetchedAt);

-- PriceHistory
CREATE INDEX IF NOT EXISTS IX_PriceHistory_Pair_CreatedAt ON PriceHistory(PairID, CreatedAt DESC);
CREATE INDEX IF NOT EXISTS IX_PriceHistory_CreatedAt ON PriceHistory(CreatedAt);

-- Trades
CREATE INDEX IF NOT EXISTS IX_Trades_Pair_CreatedAt ON Trades(PairID, CreatedAt DESC);
CREATE INDEX IF NOT EXISTS IX_Trades_User ON Trades(UserID);
CREATE INDEX IF NOT EXISTS IX_Trades_CreatedAt ON Trades(CreatedAt);
CREATE INDEX IF NOT EXISTS IX_Trades_TxHash ON Trades(TxHash);
CREATE INDEX IF NOT EXISTS IX_Trades_User_CreatedAt ON Trades(UserID, CreatedAt DESC);
CREATE INDEX IF NOT EXISTS IX_Trades_TokenSent ON Trades(TokenSent);
CREATE INDEX IF NOT EXISTS IX_Trades_TokenReceived ON Trades(TokenReceived);

-- TradeMetrics
CREATE INDEX IF NOT EXISTS IX_TradeMetrics_TradeID ON TradeMetrics(TradeID);
CREATE INDEX IF NOT EXISTS IX_TradeMetrics_ConsecutiveCount ON TradeMetrics(ConsecutiveCount);

-- UserBalances
CREATE INDEX IF NOT EXISTS IX_UserBalances_User ON UserBalances(UserID);
CREATE INDEX IF NOT EXISTS IX_UserBalances_Token ON UserBalances(TokenID);
CREATE INDEX IF NOT EXISTS IX_UserBalances_User_Token_CreatedAt ON UserBalances(UserID, TokenID, CreatedAt DESC);
CREATE INDEX IF NOT EXISTS IX_UserBalances_CreatedAt ON UserBalances(CreatedAt DESC);
CREATE INDEX IF NOT EXISTS IX_UserBalances_Balance ON UserBalances(Balance);

-- Suggestions
CREATE INDEX IF NOT EXISTS IX_Suggestions_UserID ON Suggestions(UserID);
CREATE INDEX IF NOT EXISTS IX_Suggestions_CreatedAt ON Suggestions(CreatedAt DESC);

-- RegistrationSessions
CREATE INDEX IF NOT EXISTS IX_RegistrationSessions_UserID ON RegistrationSessions(UserID);
CREATE INDEX IF NOT EXISTS IX_RegistrationSessions_State ON RegistrationSessions(State);
CREATE INDEX IF NOT EXISTS IX_RegistrationSessions_CreatedAt ON RegistrationSessions(CreatedAt);

-- SCWDeployments
CREATE INDEX IF NOT EXISTS IX_SCWDeployments_User ON SCWDeployments(UserID);
CREATE INDEX IF NOT EXISTS IX_SCWDeployments_Chain ON SCWDeployments(ChainID);
CREATE INDEX IF NOT EXISTS IX_SCWDeployments_SCWAddress ON SCWDeployments(SCWAddress);
CREATE INDEX IF NOT EXISTS IX_SCWDeployments_UserChain ON SCWDeployments(UserID, ChainID);

-- DepositTransactions
CREATE INDEX IF NOT EXISTS IX_DepositTransactions_User ON DepositTransactions(UserID);
CREATE INDEX IF NOT EXISTS IX_DepositTransactions_Status ON DepositTransactions(Status);
CREATE INDEX IF NOT EXISTS IX_DepositTransactions_SCW ON DepositTransactions(SCWAddress);
CREATE INDEX IF NOT EXISTS IX_DepositTransactions_CreatedAt ON DepositTransactions(CreatedAt DESC);

-- Withdrawals
CREATE INDEX IF NOT EXISTS IX_Withdrawals_UserID ON Withdrawals(UserID);
CREATE INDEX IF NOT EXISTS IX_Withdrawals_ChainID ON Withdrawals(ChainID);
CREATE INDEX IF NOT EXISTS IX_Withdrawals_Status ON Withdrawals(Status);
CREATE INDEX IF NOT EXISTS IX_Withdrawals_TxHash ON Withdrawals(TxHash);
CREATE INDEX IF NOT EXISTS IX_Withdrawals_WithdrawnAt ON Withdrawals(WithdrawnAt DESC);
CREATE INDEX IF NOT EXISTS IX_Withdrawals_User_WithdrawnAt ON Withdrawals(UserID, WithdrawnAt DESC);

-- UserStrategyPending
CREATE INDEX IF NOT EXISTS IX_UserStrategyPending_User ON UserStrategyPending(UserID);

-- =============================================
-- VIEWS
-- =============================================

-- View: Active User Trading Configs
CREATE VIEW IF NOT EXISTS vw_ActiveUserTradingConfigs AS
SELECT
    utc.ConfigID,
    u.UserID,
    u.Username,
    u.TelegramChatID,
    c.ChainName,
    c.ChainID,
    tp.PairName,
    bt.Symbol AS BaseToken,
    qt.Symbol AS QuoteToken,
    utc.TradePercentage,
    utc.TriggerPercentage,
    utc.MaxAmount,
    utc.MinimumAmount,
    utc.Multiplier,
    utc.IsActive
FROM UserTradingConfigs utc
INNER JOIN Users u ON utc.UserID = u.UserID
INNER JOIN TradingPairs tp ON utc.PairID = tp.PairID
INNER JOIN Chains c ON tp.ChainID = c.ChainID
INNER JOIN Tokens bt ON tp.BaseTokenID = bt.TokenID
INNER JOIN Tokens qt ON tp.QuoteTokenID = qt.TokenID
WHERE utc.IsActive = 1 AND u.IsActive = 1;

-- View: Trade Summary by User and Pair
CREATE VIEW IF NOT EXISTS vw_TradeSummaryByUserPair AS
SELECT
    t.UserID,
    u.Username,
    c.ChainName,
    c.ChainID,
    tp.PairName,
    COUNT(*) AS TotalTrades,
    SUM(CASE WHEN t.Action = 'BUY' THEN 1 ELSE 0 END) AS BuyCount,
    SUM(CASE WHEN t.Action = 'SELL' THEN 1 ELSE 0 END) AS SellCount,
    SUM(t.QuantitySent) AS TotalVolumeSent,
    SUM(t.QuantityReceived) AS TotalVolumeReceived,
    AVG(t.QuantitySent) AS AvgQuantitySent,
    MIN(t.CreatedAt) AS FirstTradeDate,
    MAX(t.CreatedAt) AS LastTradeDate
FROM Trades t
INNER JOIN Users u ON t.UserID = u.UserID
INNER JOIN TradingPairs tp ON t.PairID = tp.PairID
INNER JOIN Chains c ON tp.ChainID = c.ChainID
GROUP BY t.UserID, u.Username, c.ChainName, c.ChainID, tp.PairName;

-- View: Latest Prices by Pair
CREATE VIEW IF NOT EXISTS vw_LatestPricesByPair AS
WITH RankedPrices AS (
    SELECT
        ph.PairID,
        tp.PairName,
        c.ChainName,
        c.ChainID,
        ph.Price,
        ph.CreatedAt,
        ROW_NUMBER() OVER (PARTITION BY ph.PairID ORDER BY ph.CreatedAt DESC) AS rn
    FROM PriceHistory ph
    INNER JOIN TradingPairs tp ON ph.PairID = tp.PairID
    INNER JOIN Chains c ON tp.ChainID = c.ChainID
)
SELECT PairID, PairName, ChainName, ChainID, Price, CreatedAt
FROM RankedPrices
WHERE rn = 1;

-- View: User Balances with Token Details
CREATE VIEW IF NOT EXISTS vw_UserBalances AS
SELECT
    ub.UserID,
    u.Username,
    c.ChainName,
    t.Symbol AS TokenSymbol,
    t.TokenAddress,
    ub.Balance,
    ub.CreatedAt AS LastUpdated
FROM UserBalances ub
INNER JOIN Users u ON ub.UserID = u.UserID
INNER JOIN Tokens t ON ub.TokenID = t.TokenID
INNER JOIN Chains c ON t.ChainID = c.ChainID;

-- View: Trade Details with Metrics
CREATE VIEW IF NOT EXISTS vw_TradeDetails AS
SELECT
    t.TradeID,
    t.UserID,
    u.Username,
    tp.PairName,
    c.ChainName,
    t.Action,
    ph.Price,
    tSent.Symbol AS TokenSentSymbol,
    t.QuantitySent,
    tReceived.Symbol AS TokenReceivedSymbol,
    t.QuantityReceived,
    tm.ConsecutiveCount,
    tm.ActualTradePercentage,
    t.TxHash,
    t.CreatedAt
FROM Trades t
INNER JOIN Users u ON t.UserID = u.UserID
INNER JOIN TradingPairs tp ON t.PairID = tp.PairID
INNER JOIN Chains c ON tp.ChainID = c.ChainID
INNER JOIN PriceHistory ph ON t.PriceID = ph.PriceID
LEFT JOIN Tokens tSent ON t.TokenSent = tSent.TokenID
LEFT JOIN Tokens tReceived ON t.TokenReceived = tReceived.TokenID
LEFT JOIN TradeMetrics tm ON t.TradeID = tm.TradeID;

-- View: User Withdrawal History
CREATE VIEW IF NOT EXISTS vw_UserWithdrawalHistory AS
SELECT
    w.WithdrawalID,
    u.UserID,
    u.Username,
    c.ChainName,
    t.Symbol,
    w.Amount,
    w.AmountFormatted,
    w.TxHash,
    w.Status,
    w.WithdrawnAt
FROM Withdrawals w
INNER JOIN Users u ON w.UserID = u.UserID
INNER JOIN Chains c ON w.ChainID = c.ChainID
INNER JOIN Tokens t ON w.TokenID = t.TokenID;

-- View: Withdrawal Summary
CREATE VIEW IF NOT EXISTS vw_WithdrawalSummary AS
SELECT
    w.WithdrawalID,
    u.UserID,
    u.Username,
    c.ChainName,
    c.ChainID,
    t.Symbol AS TokenSymbol,
    w.Amount,
    w.AmountFormatted,
    w.RecipientAddress,
    w.TxHash,
    w.Status,
    w.WithdrawnAt
FROM Withdrawals w
INNER JOIN Users u ON w.UserID = u.UserID
INNER JOIN Chains c ON w.ChainID = c.ChainID
INNER JOIN Tokens t ON w.TokenID = t.TokenID
ORDER BY w.WithdrawnAt DESC;

-- View: User Balances in USDC (Latest balance per user/token)
CREATE VIEW IF NOT EXISTS vw_UserBalancesUSDC AS
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
