# Workers Reference

Detailed documentation for each Cloudflare Worker in the LazaiTrader system.

---

## Worker Overview

| Worker | Type | Trigger | Purpose |
|--------|------|---------|---------|
| lt_tg | HTTP | Telegram Webhook | Main bot interface |
| lt_tg_start | HTTP | Service Binding | User registration |
| lt_tg_deposit | HTTP | Service Binding | SCW deployment |
| lt_tg_withdrawal | HTTP | Service Binding | Token withdrawals |
| lt_tg_balance | HTTP | Service Binding | Balance fetching |
| lt_tg_chart | HTTP | Service Binding | Chart generation |
| lt_trader_queue | Cron | Every 1 minute | Price monitoring |
| lt_trader_execute | Queue | Queue messages | Trade execution |
| lt_balance_tracker | Cron | Every 5 minutes | Balance tracking |

---

## lt_tg (Main Bot)

### Purpose

Entry point for all Telegram interactions. Routes commands to appropriate handlers and microservices.

### Files

```
lt_tg/
├── worker.js                    # Main entry point
├── helper.strategyhandlers.js   # Strategy management
├── helper.withdrawalhandlers.js # Withdrawal UI
├── wrangler.toml               # Configuration
└── package.json
```

### Bindings

```toml
# D1 Database
[[d1_databases]]
binding = "DB"

# Service Bindings
[[services]]
binding = "START_WORKER"
service = "lt-tg-start"

[[services]]
binding = "DEPOSIT_WORKER"
service = "lt-tg-deposit"

# ... more services
```

### Key Functions

```javascript
// Handle incoming Telegram updates
async fetch(request, env) {
  const update = await request.json();
  if (update.message) {
    await handleMessage(update.message, env);
  }
}

// Route commands
async function handleMessage(message, env) {
  const command = message.text.split(' ')[0];
  switch(command) {
    case '/start': return handleStart(message, env);
    case '/balance': return handleBalance(message, env);
    // ...
  }
}
```

---

## lt_tg_start (Registration)

### Purpose

Handles user registration flow and wallet verification.

### Input

```json
{
  "action": "start | verify_wallet",
  "chatId": 123456789,
  "userId": 123456789,
  "username": "telegram_username",
  "text": "0x..." // for verify_wallet
}
```

### Output

```json
{
  "success": true,
  "registered": true,
  "awaiting": "wallet" // if awaiting input
}
```

### Flow

1. Check if user exists
2. If new, create registration session
3. Validate wallet address
4. Create user record
5. Return success

---

## lt_tg_deposit (SCW Deployment)

### Purpose

Deploys Smart Contract Wallets using deterministic CREATE2.

### Input

```json
{
  "userId": 123456789,
  "userWallet": "0x..."
}
```

### Output

```json
{
  "success": true,
  "scwAddress": "0x...",
  "deployments": [
    {
      "chainId": 1088,
      "chainName": "Metis",
      "status": "deployed",
      "txHash": "0x..."
    }
  ]
}
```

### Flow

1. Check if user already has SCW
2. If exists, return existing address
3. Deploy SCW on all active chains
4. Record in SCWDeployments
5. Update Users.SCWAddress

---

## lt_tg_withdrawal (Withdrawals)

### Purpose

Executes withdrawals from SCW to user's EOA.

### Input

```json
{
  "userId": 123456789,
  "userWallet": "0x...",
  "scwAddress": "0x...",
  "tokenAddress": "0x...",
  "chainId": 1088,
  "rpcUrl": "https://..."
}
```

### Output

```json
{
  "success": true,
  "txHash": "0x...",
  "amount": "100.0",
  "token": "USDC"
}
```

### Flow

1. Connect to blockchain
2. Call SCW.withdrawAllTokens()
3. Wait for confirmation
4. Record in Withdrawals table
5. Return result

---

## lt_trader_queue (Producer)

### Purpose

Monitors prices and queues trades when trigger conditions are met.

### Trigger

```toml
[triggers]
crons = ["* * * * *"]  # Every minute
```

### Flow

1. Fetch active trading configs
2. Get unique base pair symbols
3. Fetch prices for each
4. Check trigger conditions
5. Queue trades for execution

### Queue Message

```json
{
  "userId": 123,
  "configId": 456,
  "action": "SELL",
  "triggerPrice": 3400.50,
  "lastTradePrice": 3000.00,
  "chain": {...},
  "pair": {...}
}
```

---

## lt_trader_execute (Consumer)

### Purpose

Consumes queued trades and executes them via Smart Contract Wallets.

### Trigger

```toml
[[queues.consumers]]
queue = "lt-trading-queue"
max_batch_size = 1
```

### Flow

1. Receive message from queue
2. Re-validate trigger condition
3. Calculate trade amount
4. Update oracle prices (if LazaiSwap)
5. Execute trade via SCW
6. Record in Trades table
7. Send notification

### Trade Execution

```javascript
// Execute on SCW
const tx = await scw.executeTrade(
  dexAddress,
  swapCalldata
);
await tx.wait();
```

---

## lt_balance_tracker (Balance Tracker)

### Purpose

Automatically tracks user balances and detects deposits.

### Trigger

```toml
[triggers]
crons = ["*/5 * * * *"]  # Every 5 minutes
```

### Flow

1. Fetch all active users with SCWs
2. For each user/chain/token combination
3. Query on-chain balance
4. Insert into UserBalances (historical)
5. Detect deposits by comparing to expected balance
6. Record deposits in DepositTransactions

### Balance Record

```sql
INSERT INTO UserBalances
  (UserID, TokenID, Balance, BalanceUSDC, PriceUSDC)
VALUES (?, ?, ?, ?, ?);
```

---

## lt_tg_chart (Charts)

### Purpose

Generates performance charts using QuickChart.io.

### Input

```json
{
  "userId": 123456789
}
```

### Output

```json
{
  "success": true,
  "chartUrl": "https://quickchart.io/...",
  "stats": {
    "totalTrades": 25,
    "pnlPercentage": 35.0,
    "tokensTraded": ["ETH", "METIS"]
  }
}
```

### Chart Features

- Price lines per token
- Buy/sell markers
- PnL in title
- Date axis

---

## Shared Utilities

### priceHelper.js

```javascript
// Normalize token symbols
normalizeTokenSymbol('WETH')  // Returns 'ETH'

// Get cached price
getTokenPriceUSDC(db, 'ETH', 'USDC', 5)  // 5 min cache
```

### priceParser.js

```javascript
// Parse API response
parsePrice(response, 'binance')  // Returns price number
```

### tokenMappings.json

```json
{
  "symbolMap": {
    "WETH": "ETH",
    "M.USDC": "USDC"
  },
  "stablecoins": ["USDC", "USDT", "DAI"],
  "chartColors": {
    "ETH": "#627EEA"
  }
}
```

---

## Error Handling

### Standard Response Format

```javascript
// Success
return new Response(JSON.stringify({
  success: true,
  data: result
}), { status: 200 });

// Error
return new Response(JSON.stringify({
  success: false,
  error: 'Description',
  errorCode: 'CODE'
}), { status: 400 });
```

### Common Error Codes

| Code | Meaning |
|------|---------|
| INVALID_INPUT | Bad request parameters |
| NOT_FOUND | Resource not found |
| UNAUTHORIZED | Permission denied |
| BLOCKCHAIN_ERROR | Chain interaction failed |
| DATABASE_ERROR | D1 query failed |

---

## Configuration

### Environment-Specific

```toml
# Production
[env.production]
name = "lt-tg"

# Staging
[env.staging]
name = "lt-tg-staging"

# Development
[env.development]
name = "lt-tg-dev"
```

### Secrets

```bash
wrangler secret put BOT_TOKEN
wrangler secret put BOT_PRIVATE_KEY
wrangler secret put WORKER_SECRET
```
