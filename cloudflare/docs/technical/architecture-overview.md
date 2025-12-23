# Architecture Overview

Technical overview of LazaiTrader's system architecture.

---

## System Components

LazaiTrader is built on Cloudflare Workers with smart contracts on multiple EVM chains.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              Users                                       │
│                           (Telegram)                                     │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         Telegram Bot API                                 │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    Cloudflare Workers Infrastructure                     │
│                                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                  │
│  │   lt_tg      │  │  lt_trader   │  │  lt_balance  │                  │
│  │  Main Bot    │  │   _queue     │  │   _tracker   │                  │
│  │              │  │  (Producer)  │  │  (Scheduled) │                  │
│  └──────┬───────┘  └──────┬───────┘  └──────────────┘                  │
│         │                 │                                             │
│         ▼                 ▼                                             │
│  ┌────────────────────────────────────┐                                │
│  │        Cloudflare Queue            │                                │
│  │       "lt-trading-queue"           │                                │
│  └─────────────┬──────────────────────┘                                │
│                │                                                        │
│                ▼                                                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                  │
│  │  lt_trader   │  │ lt_tg_start │  │lt_tg_deposit │                  │
│  │  _execute    │  │(Registration)│  │(SCW Deploy) │                  │
│  │  (Consumer)  │  └──────────────┘  └──────────────┘                  │
│  └──────────────┘                                                       │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    Cloudflare D1 Database                        │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         Blockchain Layer                                 │
│                                                                         │
│  ┌────────────────────┐  ┌────────────────────┐                        │
│  │  LazaiWalletFactory │  │  User SCWs         │                        │
│  │  (Deterministic)   │  │  (Per User)        │                        │
│  └────────────────────┘  └────────────────────┘                        │
│                                                                         │
│  ┌────────────────────┐                                                │
│  │  Whitelisted DEXs  │                                                │
│  │  (HerculesDEX,etc) │                                                │
│  └────────────────────┘                                                │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Cloudflare Workers

### Main Bot (lt_tg)

**Purpose:** Entry point for all Telegram interactions

**Responsibilities:**
- Handle webhook from Telegram
- Route commands to appropriate handlers
- Display responses to users
- Coordinate with microservices

**Key Files:**
- `worker.js` - Main entry point
- `helper.strategyhandlers.js` - Strategy management
- `helper.withdrawalhandlers.js` - Withdrawal handling

### Trading Queue Producer (lt_trader_queue)

**Purpose:** Monitor prices and queue trades

**Trigger:** Cron schedule (every 1 minute)

**Responsibilities:**
- Fetch current prices from APIs
- Check user trigger conditions
- Queue trades for execution
- Cache prices in database

### Trading Execution Consumer (lt_trader_execute)

**Purpose:** Execute queued trades

**Trigger:** Cloudflare Queue messages

**Responsibilities:**
- Re-validate trigger conditions
- Calculate trade amounts
- Execute trades via SCW
- Record trades in database
- Send notifications

### Balance Tracker (lt_balance_tracker)

**Purpose:** Track user balances

**Trigger:** Cron schedule (every 5 minutes)

**Responsibilities:**
- Fetch on-chain balances
- Detect deposits
- Update USDC valuations
- Maintain balance history

### Microservices

| Worker | Purpose | Binding Type |
|--------|---------|--------------|
| lt_tg_start | User registration | Service Binding |
| lt_tg_deposit | SCW deployment | Service Binding |
| lt_tg_withdrawal | Token withdrawals | Service Binding |
| lt_tg_balance | Balance fetching | Service Binding |
| lt_tg_chart | Performance charts | Service Binding |

---

## Data Flow

### User Registration Flow

```
User → /start → lt_tg → lt_tg_start → D1 Database
                              │
                              ▼
                    Create Users record
                    Create RegistrationSession
```

### Deposit Flow

```
User → /deposit → lt_tg → lt_tg_deposit → Blockchain
                               │
                               ▼
                    Deploy SCW via Factory
                    Update Users.SCWAddress
```

### Trading Flow

```
Cron (1 min) → lt_trader_queue → Check prices
                      │
                      ▼ (trigger met)
               Cloudflare Queue
                      │
                      ▼
              lt_trader_execute → SCW.executeTrade() → DEX
                      │
                      ▼
               Record in D1 → Notify user
```

### Withdrawal Flow

```
User → /withdraw → lt_tg → lt_tg_withdrawal → SCW.withdrawAll()
                                │
                                ▼
                    Funds sent to user's EOA
                    Record in Withdrawals table
```

---

## Database Schema

### Core Tables

| Table | Purpose |
|-------|---------|
| Users | Registered users |
| Chains | Supported blockchains |
| Tokens | ERC20 tokens |
| TradingPairs | Trading pair configs |
| UserTradingConfigs | User strategies |

### Trading Tables

| Table | Purpose |
|-------|---------|
| Trades | Executed trades |
| TradeMetrics | Additional trade data |
| PriceHistory | Historical prices |
| CachedPrices | Latest prices |

### Financial Tables

| Table | Purpose |
|-------|---------|
| UserBalances | Balance history |
| DepositTransactions | Detected deposits |
| Withdrawals | Withdrawal records |
| SCWDeployments | SCW addresses |

---

## Smart Contracts

### LazaiWalletFactory

**Purpose:** Deploy user SCWs deterministically

**Key Functions:**
- `createWallet(owner)` - Deploy new SCW
- `computeWalletAddress(owner)` - Predict address
- `setDEXWhitelist(dex, status)` - Manage whitelist

### LazaiTradingWallet

**Purpose:** User's non-custodial trading wallet

**Key Functions:**
- `executeTrade(dex, data)` - Execute swap
- `withdrawAllTokens(token)` - Withdraw to owner
- `approveToken(token, dex, amount)` - Approve DEX

---

## External Integrations

### Price APIs

| Provider | Priority | Use Case |
|----------|----------|----------|
| Binance | 1 | Major pairs |
| CoinGecko | 2 | Fallback |
| Coinbase | 3 | Additional source |
| DEXScreener | 4 | DEX-specific |

### Telegram Bot API

- Webhook for incoming messages
- sendMessage for responses
- Inline keyboards for UX

### Blockchain RPC

| Chain | RPC Provider |
|-------|--------------|
| Metis | Metis official |
| Zircuit | Zircuit official |

---

## Shared Utilities

### priceHelper.js

- Token symbol normalization
- Price fetching with caching
- Multi-source fallback

### priceParser.js

- Parse API responses
- Handle different formats
- Error handling

### tokenMappings.json

- Symbol normalization map
- Stablecoin list
- Chart colors

---

## Security Architecture

### Worker Level

- Service bindings (internal only)
- Secret management (Wrangler)
- Input validation

### Contract Level

- Immutable owner
- DEX whitelist
- Reentrancy guards

### Data Level

- D1 database isolation
- No sensitive data in logs
- Minimal data exposure

---

## Further Reading

- [For Developers](for-developers/README.md) - Development guide
- [Database Schema](database-schema.md) - Full schema reference
- [Smart Contracts](for-developers/smart-contracts.md) - Contract details
