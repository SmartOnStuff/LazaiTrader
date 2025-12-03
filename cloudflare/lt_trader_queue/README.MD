# LazaiTrader Trading Queue Worker (Producer)

A Cloudflare Worker that monitors cryptocurrency prices and sends trade messages to a Cloudflare Queue when user-defined trigger conditions are met. This is the **producer** worker - a separate **consumer** worker (`lt-trading-execution`) will process the queued trades.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│              lt-trading-queue Worker (PRODUCER)                  │
│                    Runs every 1 minute                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │   Step 1     │    │   Step 2     │    │   Step 3     │       │
│  │ Get Active   │───▶│ Fetch Prices │───▶│ Check Configs│       │
│  │   Pairs      │    │ & Cache      │    │ & Send to Q  │       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
│         │                   │                   │                │
│         ▼                   ▼                   ▼                │
│  ┌──────────────────────────────────────────────────────────────┐│
│  │                    D1 Database                               ││
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          ││
│  │  │TradingPairs │  │CachedPrices │  │PriceHistory │          ││
│  │  └─────────────┘  └─────────────┘  └─────────────┘          ││
│  │  ┌─────────────┐  ┌─────────────┐                           ││
│  │  │UserTrading  │  │PriceAPI     │                           ││
│  │  │  Configs    │  │ Endpoints   │                           ││
│  │  └─────────────┘  └─────────────┘                           ││
│  └──────────────────────────────────────────────────────────────┘│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
              ┌───────────────────────────────┐
              │     Cloudflare Queue          │
              │     "lt-trading-queue"        │
              │                               │
              │  Messages contain:            │
              │  - User/Config IDs            │
              │  - Action (BUY/SELL)          │
              │  - Price info                 │
              │  - Chain/DEX details          │
              │  - Token addresses            │
              └───────────────────────────────┘
                              │
                              ▼
              ┌───────────────────────────────┐
              │   lt-trading-execution        │
              │   Worker (CONSUMER)           │
              │                               │
              │   Triggered by queue          │
              │   Executes trades via SCW     │
              └───────────────────────────────┘
```

## Features

- **Multi-Provider Price Fetching**: Supports Binance, Coinbase, CoinGecko, DEXScreener with automatic fallback
- **Chain-Agnostic Pricing**: Same price API for ETH-USDC regardless of chain (Zircuit, Metis, etc.)
- **Trigger-Based Trading**: Monitors price changes against user-defined trigger percentages
- **Cloudflare Queue Integration**: Sends rich trade messages to queue for async processing
- **Price Caching**: Caches prices to avoid redundant API calls
- **Price History**: Records all fetched prices for historical analysis

## Quick Start

### 1. Create the Cloudflare Queue

```bash
# Create the queue first
npx wrangler queues create lt-trading-queue

# For dev/staging environments
npx wrangler queues create lt-trading-queue-dev
npx wrangler queues create lt-trading-queue-staging
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Run Database Migrations

```bash
# Against remote D1
npm run db:migrate

# Against local D1 (for development)
npm run db:migrate:local
```

### 4. Set Secrets

```bash
# Secret for manual trigger authentication
wrangler secret put WORKER_SECRET
```

### 5. Deploy

```bash
# Production
npm run deploy

# Staging
npm run deploy:staging

# Development
npm run deploy:dev
```

### 6. Local Development

```bash
npm run dev
```

## Queue Message Format

When a trigger condition is met, the producer sends messages to the queue with this structure:

```json
{
  "userId": 123,
  "configId": 456,
  "pairId": 1,
  "chainId": 48900,
  "action": "SELL",
  "triggerPrice": 3400.50,
  "lastTradePrice": 3000.00,
  "lastTradeId": 789,
  "triggerPercentage": 0.10,
  "actualChangePercent": 13.35,
  "telegramChatId": "123456789",
  "scwAddress": "0x...",
  "userWallet": "0x...",
  "tradePercentage": 0.25,
  "maxAmount": 1000,
  "minimumAmount": 10,
  "multiplier": 1.5,
  "chain": {
    "chainId": 48900,
    "chainName": "Zircuit",
    "rpcEndpoint": "https://mainnet.zircuit.com",
    "explorerUrl": "https://explorer.zircuit.com",
    "nativeCurrency": "ETH"
  },
  "pair": {
    "pairName": "ETH-USDC",
    "dexAddress": "0x...",
    "baseToken": {
      "symbol": "ETH",
      "address": "0x...",
      "decimals": 18
    },
    "quoteToken": {
      "symbol": "USDC",
      "address": "0x...",
      "decimals": 6
    }
  },
  "queuedAt": "2024-01-15T10:30:00.000Z",
  "priority": 13
}
```

## Database Schema

### New Tables

#### PriceAPIEndpoints
Stores multiple API sources per trading pair for fallback.

| Column | Type | Description |
|--------|------|-------------|
| EndpointID | INTEGER | Primary key |
| BasePairSymbol | TEXT | e.g., 'ETH-USDC', 'BTC-ETH' |
| Provider | TEXT | 'binance', 'dexscreener', 'coingecko', 'coinbase' |
| EndpointURL | TEXT | Full API URL |
| Priority | INTEGER | Lower = higher priority (try first) |
| IsActive | INTEGER | 1 = active, 0 = disabled |
| ConsecutiveFailures | INTEGER | Count of consecutive failures |

#### CachedPrices
Stores the most recent fetched price per base pair symbol.

| Column | Type | Description |
|--------|------|-------------|
| CacheID | INTEGER | Primary key |
| BasePairSymbol | TEXT | e.g., 'ETH-USDC' |
| Price | REAL | Current price |
| Provider | TEXT | Which API provided this price |
| FetchedAt | TEXT | When the price was fetched |

## Configuration

### Cron Schedule

The worker is configured to run every 1 minute:

```toml
[triggers]
crons = ["* * * * *"]
```

### Queue Producer Binding

```toml
[[queues.producers]]
queue = "lt-trading-queue"
binding = "TRADING_QUEUE"
```

### Adding Price API Endpoints

To add support for a new trading pair:

```sql
INSERT INTO PriceAPIEndpoints (BasePairSymbol, Provider, EndpointURL, Priority) 
VALUES 
  ('NEW-USDC', 'binance', 'https://api.binance.com/api/v3/ticker/price?symbol=NEWUSDC', 1),
  ('NEW-USDC', 'coingecko', 'https://api.coingecko.com/api/v3/simple/price?ids=new-token&vs_currencies=usd', 2);
```

## API Endpoints

### GET /health
Health check endpoint.

```bash
curl https://lt-trading-queue.<your-subdomain>.workers.dev/health
```

### POST /trigger
Manually trigger the queue processing (requires authentication).

```bash
curl -X POST https://lt-trading-queue.<your-subdomain>.workers.dev/trigger \
  -H "Authorization: Bearer YOUR_WORKER_SECRET"
```

### GET /status
Get status including cached prices and active configs count.

```bash
curl https://lt-trading-queue.<your-subdomain>.workers.dev/status
```

### POST /test-queue
Send a test message to the queue (requires authentication).

```bash
curl -X POST https://lt-trading-queue.<your-subdomain>.workers.dev/test-queue \
  -H "Authorization: Bearer YOUR_WORKER_SECRET"
```

## Trading Logic

### Trigger Conditions

1. **Price Change Calculation**:
   ```
   percentChange = ((currentPrice - lastTradePrice) / lastTradePrice) * 100
   ```

2. **Trigger Check**:
   ```
   if |percentChange| >= triggerPercentage * 100:
       trigger = true
   ```

3. **Action Determination**:
   - Price UP by trigger% → SELL (take profit / rebalance)
   - Price DOWN by trigger% → BUY (buy the dip / rebalance)

### Example Scenario

```
User Config:
- Pair: ETH-USDC
- Trigger: 10% (stored as 0.10)

Last Trade:
- Price: $3,000
- Action: BUY

Current Price: $3,400

Calculation:
- Change: ((3400 - 3000) / 3000) * 100 = 13.33%
- Trigger met? 13.33% >= 10% → YES
- Action: SELL (price went up)

Result: Send SELL message to queue
```

## Consumer Worker Setup

The consumer worker (`lt-trading-execution`) should be configured with:

```toml
# wrangler.toml for consumer
name = "lt-trading-execution"

[[queues.consumers]]
queue = "lt-trading-queue"
max_batch_size = 10
max_batch_timeout = 5
```

And implement the queue handler:

```javascript
export default {
  async queue(batch, env) {
    for (const message of batch.messages) {
      const trade = message.body;
      // Execute trade using trade.scwAddress, trade.chain, etc.
      // ...
      message.ack();
    }
  }
};
```

## Monitoring

### View Logs

```bash
# Production
npm run tail

# Staging
npm run tail:staging
```

### Check Status

```bash
npm run status
```

### D1 Studio (GUI)

```bash
npm run db:studio
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| WORKER_SECRET | Secret for manual trigger auth | Yes |
| ENVIRONMENT | 'production', 'staging', or 'development' | No |

## File Structure

```
lt-trading-queue/
├── src/
│   └── worker.js          # Main producer worker code
├── schema_additions.sql   # New database tables (PriceAPIEndpoints, CachedPrices)
├── wrangler.toml          # Cloudflare configuration with queue producer
├── package.json           # Node.js dependencies
└── README.md              # This file
```

## Error Handling

- **API Failures**: Automatically tries next priority endpoint
- **Invalid Prices**: Skips pair if no valid price obtained
- **Queue Errors**: Throws error which will be logged and can trigger alerts
- **Failure Tracking**: Records consecutive failures per price API endpoint

## Performance Considerations

- **Parallel Price Fetching**: Fetches prices for all pairs concurrently
- **Unique Base Pairs**: Only makes one API call per unique base pair symbol
- **5s Timeout**: API calls timeout after 5 seconds to prevent blocking
- **Batch Queue Sending**: Uses `sendBatch()` for efficient queue operations

## License

MIT