# LazaiTrader D1 Database

This folder contains the Cloudflare D1 database schema and configuration for the LazaiTrader bot.

## Database Overview

**Database Type:** Cloudflare D1 (SQLite-based)

**Tables:** 10
- Chains
- Users
- Tokens
- TradingPairs
- UserTradingConfigs
- PriceHistory
- Trades
- TradeMetrics
- UserBalances
- Suggestions

**Views:** 5
- vw_ActiveUserTradingConfigs
- vw_TradeSummaryByUserPair
- vw_LatestPricesByPair
- vw_UserBalances
- vw_TradeDetails

## Setup Instructions

### 1. Create D1 Database

```bash
wrangler d1 create lazaitrader-db
```

This will output something like:
```
[[d1_databases]]
binding = "DB"
database_name = "lazaitrader-db"
database_id = "xxxx-xxxx-xxxx-xxxx"
```

### 2. Update wrangler.toml

Add the D1 binding to your `cloudflare/lt_tg/wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "lazaitrader-db"
database_id = "your-database-id-here"
```

### 3. Initialize Schema

Run the schema to create tables and seed initial data:

```bash
wrangler d1 execute lazaitrader-db --file=cloudflare/database/schema.sql
```

### 4. Verify Setup

Check if tables were created:

```bash
wrangler d1 execute lazaitrader-db --command="SELECT name FROM sqlite_master WHERE type='table'"
```

## Database Schema Details

### Core Tables

#### Users
Stores Telegram user information and wallet addresses.
- `UserID` - Telegram user ID (Primary Key)
- `UserWallet` - User's EOA wallet address
- `SCWAddress` - Smart Contract Wallet address
- `TelegramChatID` - Telegram chat ID
- `Username` - Telegram username

#### Chains
Blockchain network information.
- Pre-populated with:
  - Metis Andromeda (1088)
  - Hyperion Testnet (133717)
  - Zircuit (48900)

#### Tokens
Token details per chain.
- Pre-populated with testnet tokens:
  - tgMetis
  - tgUSDC
  - tgETH

#### TradingPairs
Available trading pairs per chain.
- Links BaseToken and QuoteToken
- Contains DEX and price source information

#### UserTradingConfigs
User-specific trading strategies.
- Trade percentage
- Trigger percentage
- Max/Min amounts
- Multiplier

### Transaction Tables

#### PriceHistory
Historical price data for trading pairs.

#### Trades
Individual trade records with transaction hashes.

#### TradeMetrics
Additional metrics per trade (consecutive counts, etc.).

#### UserBalances
Current token balances per user.

#### Suggestions
AI-generated trading suggestions for users.

## Usage in Worker

### Accessing the Database

In your worker code, access D1 via the binding:

```javascript
export default {
  async fetch(request, env) {
    // env.DB is your D1 database
    const result = await env.DB.prepare(
      "SELECT * FROM Users WHERE TelegramChatID = ?"
    ).bind(chatId).first();

    return new Response(JSON.stringify(result));
  }
};
```

### Common Queries

#### Get User by Telegram Chat ID
```javascript
const user = await env.DB.prepare(
  "SELECT * FROM Users WHERE TelegramChatID = ?"
).bind(chatId).first();
```

#### Insert New User
```javascript
await env.DB.prepare(
  `INSERT INTO Users (UserID, UserWallet, SCWAddress, TelegramChatID, Username, RegisteredAt)
   VALUES (?, ?, ?, ?, ?, datetime('now'))`
).bind(userId, userWallet, scwAddress, chatId, username).run();
```

#### Get Active Trading Configs
```javascript
const configs = await env.DB.prepare(
  "SELECT * FROM vw_ActiveUserTradingConfigs WHERE UserID = ?"
).bind(userId).all();
```

#### Get Available Trading Pairs
```javascript
const pairs = await env.DB.prepare(
  `SELECT tp.*, bt.Symbol as BaseToken, qt.Symbol as QuoteToken
   FROM TradingPairs tp
   JOIN Tokens bt ON tp.BaseTokenID = bt.TokenID
   JOIN Tokens qt ON tp.QuoteTokenID = qt.TokenID
   WHERE tp.IsActive = 1 AND tp.ChainID = ?`
).bind(chainId).all();
```

## Local Development

### Test Queries Locally

```bash
wrangler d1 execute lazaitrader-db --command="SELECT * FROM Users"
```

### Import Data

```bash
wrangler d1 execute lazaitrader-db --file=data.sql
```

### Backup Database

```bash
wrangler d1 export lazaitrader-db --output=backup.sql
```

## Best Practices

1. **Use Prepared Statements**: Always use `.prepare()` with `.bind()` to prevent SQL injection
2. **Index Usage**: The schema includes optimized indexes for common queries
3. **Batch Operations**: Use D1 batch API for multiple inserts/updates
4. **Error Handling**: Always wrap D1 calls in try-catch blocks
5. **Constraints**: The schema enforces data integrity via foreign keys and checks

## Migration Strategy

For schema changes:

1. Create a new migration file: `migration_001.sql`
2. Test locally with `wrangler d1 execute`
3. Apply to production database
4. Update `schema.sql` to reflect current state

## Resources

- [Cloudflare D1 Docs](https://developers.cloudflare.com/d1/)
- [D1 Client API](https://developers.cloudflare.com/d1/platform/client-api/)
- [Wrangler D1 Commands](https://developers.cloudflare.com/workers/wrangler/commands/#d1)
