-- ============================================
-- LazaiTrader Trading Queue - Additional Tables
-- ============================================
-- NOTE: Trade queuing is handled by Cloudflare Queue (lt-trading-queue)
-- This file only contains tables for price fetching and caching

-- TABLE: PRICE API ENDPOINTS
-- Stores multiple API sources per base pair for fallback
-- Note: This is pair-agnostic for chains (ETH-USDC uses same API regardless of chain)
CREATE TABLE IF NOT EXISTS PriceAPIEndpoints (
    EndpointID INTEGER PRIMARY KEY AUTOINCREMENT,
    BasePairSymbol TEXT NOT NULL,          -- e.g., 'ETH-USDC', 'BTC-ETH'
    Provider TEXT NOT NULL,                 -- 'binance', 'dexscreener', 'coingecko', 'coinbase'
    EndpointURL TEXT NOT NULL,              -- Full API URL with placeholders
    ApiKeyEnvVar TEXT,                      -- Environment variable name for API key if needed
    Priority INTEGER DEFAULT 1,             -- Lower = higher priority (try first)
    IsActive INTEGER DEFAULT 1,
    LastSuccessAt TEXT,
    LastFailureAt TEXT,
    ConsecutiveFailures INTEGER DEFAULT 0,
    CreatedAt TEXT DEFAULT (datetime('now')),
    UpdatedAt TEXT DEFAULT (datetime('now')),
    UNIQUE(BasePairSymbol, Provider)
);

-- Index for efficient lookups by base pair
CREATE INDEX IF NOT EXISTS IX_PriceAPIEndpoints_BasePair_Priority 
ON PriceAPIEndpoints(BasePairSymbol, Priority, IsActive);

-- TABLE: CACHED PRICES
-- Stores the most recent fetched price per base pair symbol
CREATE TABLE IF NOT EXISTS CachedPrices (
    CacheID INTEGER PRIMARY KEY AUTOINCREMENT,
    BasePairSymbol TEXT NOT NULL UNIQUE,    -- e.g., 'ETH-USDC'
    Price REAL NOT NULL,
    Provider TEXT NOT NULL,                  -- Which API provided this price
    FetchedAt TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS IX_CachedPrices_FetchedAt ON CachedPrices(FetchedAt);

-- ============================================
-- SAMPLE DATA: Price API Endpoints
-- ============================================

-- ETH-USDC (common pair, multiple providers)
INSERT OR IGNORE INTO PriceAPIEndpoints (BasePairSymbol, Provider, EndpointURL, Priority) VALUES
('ETH-USDC', 'binance', 'https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDC', 1),
('ETH-USDC', 'coinbase', 'https://api.coinbase.com/v2/prices/ETH-USDC/spot', 2),
('ETH-USDC', 'coingecko', 'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd', 3);

-- BTC-USDC
INSERT OR IGNORE INTO PriceAPIEndpoints (BasePairSymbol, Provider, EndpointURL, Priority) VALUES
('BTC-USDC', 'binance', 'https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDC', 1),
('BTC-USDC', 'coinbase', 'https://api.coinbase.com/v2/prices/BTC-USDC/spot', 2),
('BTC-USDC', 'coingecko', 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd', 3);

-- METIS-USDC (might need DEX-specific APIs)
INSERT OR IGNORE INTO PriceAPIEndpoints (BasePairSymbol, Provider, EndpointURL, Priority) VALUES
('METIS-USDC', 'coingecko', 'https://api.coingecko.com/api/v3/simple/price?ids=metis-token&vs_currencies=usd', 1),
('METIS-USDC', 'dexscreener', 'https://api.dexscreener.com/latest/dex/tokens/0xDeadDeAddeAddEAddeadDEaDDEAdDeaDDeAD0000', 2);

-- ETH-BTC (crypto-to-crypto pair)
INSERT OR IGNORE INTO PriceAPIEndpoints (BasePairSymbol, Provider, EndpointURL, Priority) VALUES
('ETH-BTC', 'binance', 'https://api.binance.com/api/v3/ticker/price?symbol=ETHBTC', 1),
('ETH-BTC', 'coinbase', 'https://api.coinbase.com/v2/prices/ETH-BTC/spot', 2);


-- =============================================
-- LazaiTrader Database Schema - Complete Reference
-- =============================================

-- TABLE 1: CHAINS
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

-- TABLE 2: USERS
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

-- TABLE 3: TOKENS
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

-- TABLE 4: TRADING PAIRS
CREATE TABLE IF NOT EXISTS TradingPairs (
    PairID INTEGER PRIMARY KEY AUTOINCREMENT,
    ChainID INTEGER NOT NULL,
    PairName TEXT NOT NULL,
    BaseTokenID INTEGER NOT NULL,
    QuoteTokenID INTEGER NOT NULL,
    DEXAddress TEXT NOT NULL,
    PriceSource TEXT,
    PriceAPI TEXT,
    IsActive INTEGER DEFAULT 1,
    CreatedAt TEXT DEFAULT (datetime('now')),
    UpdatedAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (ChainID) REFERENCES Chains(ChainID),
    FOREIGN KEY (BaseTokenID) REFERENCES Tokens(TokenID),
    FOREIGN KEY (QuoteTokenID) REFERENCES Tokens(TokenID),
    UNIQUE(PairName, ChainID),
    CHECK (BaseTokenID != QuoteTokenID)
);

-- TABLE 5: USER TRADING CONFIGS
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

-- TABLE 6: PRICE HISTORY
CREATE TABLE IF NOT EXISTS PriceHistory (
    PriceID INTEGER PRIMARY KEY AUTOINCREMENT,
    PairID INTEGER NOT NULL,
    Price REAL NOT NULL,
    CreatedAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (PairID) REFERENCES TradingPairs(PairID)
);

-- TABLE 7: TRADES
CREATE TABLE IF NOT EXISTS Trades (
    TradeID INTEGER PRIMARY KEY AUTOINCREMENT,
    PairID INTEGER NOT NULL,
    UserID INTEGER NOT NULL,
    PriceID INTEGER NOT NULL,
    Action TEXT NOT NULL,
    QuantitySent REAL NOT NULL,
    QuantityReceived REAL NOT NULL,
    TxHash TEXT NOT NULL UNIQUE,
    CreatedAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (PairID) REFERENCES TradingPairs(PairID),
    FOREIGN KEY (UserID) REFERENCES Users(UserID),
    FOREIGN KEY (PriceID) REFERENCES PriceHistory(PriceID),
    CHECK (Action IN ('BUY', 'SELL'))
);

-- TABLE 8: TRADE METRICS
CREATE TABLE IF NOT EXISTS TradeMetrics (
    MetricID INTEGER PRIMARY KEY AUTOINCREMENT,
    TradeID INTEGER NOT NULL,
    ConsecutiveCount INTEGER NOT NULL,
    ActualTradePercentage REAL NOT NULL,
    CreatedAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (TradeID) REFERENCES Trades(TradeID),
    UNIQUE(TradeID)
);

-- TABLE 9: USER BALANCES
CREATE TABLE IF NOT EXISTS UserBalances (
    BalanceID INTEGER PRIMARY KEY AUTOINCREMENT,
    UserID INTEGER NOT NULL,
    TokenID INTEGER NOT NULL,
    Balance REAL NOT NULL,
    CreatedAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (UserID) REFERENCES Users(UserID),
    FOREIGN KEY (TokenID) REFERENCES Tokens(TokenID),
    UNIQUE(UserID, TokenID)
);

-- TABLE 10: SUGGESTIONS
CREATE TABLE IF NOT EXISTS Suggestions (
    SuggestionID INTEGER PRIMARY KEY AUTOINCREMENT,
    UserID INTEGER NOT NULL,
    Suggestion TEXT NOT NULL,
    InputData TEXT,
    CreatedAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (UserID) REFERENCES Users(UserID)
);

-- =============================================
-- INDEXES
-- =============================================

-- Chains Indexes
CREATE INDEX IF NOT EXISTS IX_Chains_ChainName ON Chains(ChainName);
CREATE INDEX IF NOT EXISTS IX_Chains_IsActive ON Chains(IsActive);

-- Users Indexes
CREATE INDEX IF NOT EXISTS IX_Users_Username ON Users(Username);
CREATE INDEX IF NOT EXISTS IX_Users_SCWAddress ON Users(SCWAddress);

-- Tokens Indexes
CREATE INDEX IF NOT EXISTS IX_Tokens_Symbol ON Tokens(Symbol);
CREATE INDEX IF NOT EXISTS IX_Tokens_ChainID ON Tokens(ChainID);

-- Trading Pairs Indexes
CREATE INDEX IF NOT EXISTS IX_TradingPairs_ChainID ON TradingPairs(ChainID);
CREATE INDEX IF NOT EXISTS IX_TradingPairs_BaseToken ON TradingPairs(BaseTokenID);
CREATE INDEX IF NOT EXISTS IX_TradingPairs_QuoteToken ON TradingPairs(QuoteTokenID);

-- User Trading Configs Indexes
CREATE INDEX IF NOT EXISTS IX_UserTradingConfigs_User ON UserTradingConfigs(UserID);
CREATE INDEX IF NOT EXISTS IX_UserTradingConfigs_Pair ON UserTradingConfigs(PairID);

-- Price History Indexes
CREATE INDEX IF NOT EXISTS IX_PriceHistory_Pair_CreatedAt ON PriceHistory(PairID, CreatedAt DESC);
CREATE INDEX IF NOT EXISTS IX_PriceHistory_CreatedAt ON PriceHistory(CreatedAt);

-- Trades Indexes
CREATE INDEX IF NOT EXISTS IX_Trades_Pair_CreatedAt ON Trades(PairID, CreatedAt DESC);
CREATE INDEX IF NOT EXISTS IX_Trades_User ON Trades(UserID);
CREATE INDEX IF NOT EXISTS IX_Trades_CreatedAt ON Trades(CreatedAt);
CREATE INDEX IF NOT EXISTS IX_Trades_TxHash ON Trades(TxHash);
CREATE INDEX IF NOT EXISTS IX_Trades_User_CreatedAt ON Trades(UserID, CreatedAt DESC);

-- Trade Metrics Indexes
CREATE INDEX IF NOT EXISTS IX_TradeMetrics_TradeID ON TradeMetrics(TradeID);
CREATE INDEX IF NOT EXISTS IX_TradeMetrics_ConsecutiveCount ON TradeMetrics(ConsecutiveCount);

-- User Balances Indexes
CREATE INDEX IF NOT EXISTS IX_UserBalances_User ON UserBalances(UserID);
CREATE INDEX IF NOT EXISTS IX_UserBalances_Token ON UserBalances(TokenID);
CREATE INDEX IF NOT EXISTS IX_UserBalances_User_Token ON UserBalances(UserID, TokenID);
CREATE INDEX IF NOT EXISTS IX_UserBalances_Balance ON UserBalances(Balance);

-- Suggestions Indexes
CREATE INDEX IF NOT EXISTS IX_Suggestions_UserID ON Suggestions(UserID);
CREATE INDEX IF NOT EXISTS IX_Suggestions_CreatedAt ON Suggestions(CreatedAt DESC);

-- =============================================
-- COMMON DATA (Chains & Tokens Only)
-- =============================================

-- Insert Chains
INSERT INTO Chains (ChainID, ChainName, RPCEndpoint, ExplorerURL, NativeCurrency)
VALUES
(1088, 'Metis Andromeda', 'https://andromeda.metis.io/?owner=1088', 'https://explorer.metis.io', 'METIS'),
(133717, 'Hyperion Testnet', 'https://hyperion-testnet.metisdevops.link', 'https://hyperion-testnet-explorer.metisdevops.link', 'tMETIS'),
(48900, 'Zircuit', 'https://mainnet.zircuit.com', 'https://explorer.zircuit.com', 'ETH');

-- Insert Tokens (Hyperion Testnet)
INSERT INTO Tokens (ChainID, Symbol, TokenAddress, Decimals)
VALUES
(133717, 'tgMetis', '0x69Dd3C70Ae76256De7Ec9AF5893DEE49356D45fc', 18),
(133717, 'tgUSDC', '0x6Eb66c8bBD57FdA71ecCAAc40a56610C2CA8FDb8', 18),
(133717, 'tgETH', '0x2222Fe85Dbe1Bd7CCB44f367767862fDbe15d6a8', 18);

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
SELECT
    PairID,
    PairName,
    ChainName,
    ChainID,
    Price,
    CreatedAt
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
    t.QuantitySent,
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
LEFT JOIN TradeMetrics tm ON t.TradeID = tm.TradeID;

-- =============================================
-- SCHEMA SUMMARY
-- =============================================
-- Total Tables: 10
--   1. Chains
--   2. Users
--   3. Tokens
--   4. TradingPairs
--   5. UserTradingConfigs
--   6. PriceHistory
--   7. Trades
--   8. TradeMetrics
--   9. UserBalances
--   10. Suggestions
--
-- Total Indexes: 26
-- Total Views: 5
-- Common Data Included: 3 Chains, 3 Tokens (Hyperion Testnet)
