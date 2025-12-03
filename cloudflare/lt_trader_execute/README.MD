# LazaiTrader Trading Execution Worker (Consumer)

A Cloudflare Worker that consumes trade messages from the queue and executes them via Smart Contract Wallets (SCW). Each message is processed individually - no batch processing.

## Architecture Overview

```
┌───────────────────────────────────────────────────────────────┐
│                  Cloudflare Queue                              │
│                  "lt-trading-queue"                            │
│                                                                │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ Message: { userId, action, pair, chain, scwAddress... } │  │
│  └─────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────┘
                              │
                              ▼ (max_batch_size = 1)
┌───────────────────────────────────────────────────────────────┐
│            lt-trading-execution Worker (CONSUMER)              │
├───────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐     │
│  │   Step 1     │    │   Step 2     │    │   Step 3     │     │
│  │ Fetch Fresh  │───▶│ Re-validate  │───▶│ Calculate    │     │
│  │   Price      │    │   Trigger    │    │   Amount     │     │
│  └──────────────┘    └──────────────┘    └──────────────┘     │
│         │                                       │              │
│         │    ┌──────────────┐    ┌──────────────┐             │
│         │    │   Step 4     │    │   Step 5     │             │
│         └───▶│ Execute via  │───▶│ Record DB +  │             │
│              │   SCW/DEX    │    │   Notify TG  │             │
│              └──────────────┘    └──────────────┘             │
│                     │                   │                      │
│                     ▼                   ▼                      │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │                    Blockchain                             │ │
│  │  SCW.executeTrade(DEX, swapData)                         │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
└───────────────────────────────────────────────────────────────┘
```

## Processing Flow

### 1. Receive Message
- Queue delivers one message at a time (`max_batch_size = 1`)
- Message contains all trade details from producer

### 2. Re-validate Trigger
- Fetch fresh price from APIs
- Compare against last trade price
- If trigger no longer valid (price reverted), **skip silently**

### 3. Calculate Trade Amount
```
ConsecutiveCount = (same direction as last trade) ? lastCount + 1 : 0
ActualTradePercentage = TradePercentage × (Multiplier ^ ConsecutiveCount)
RawAmount = TokenBalance × ActualTradePercentage
```

### 4. Apply Min/Max Limits
- **Below Minimum**: Record 0-amount trade, notify user, skip execution
- **Above Maximum**: Cap at MaxAmount USD equivalent
- **Within Limits**: Use calculated amount

### 5. Update Oracle Prices
- Call `DEX.setPrices(baseToQuote, quoteToBase)` with fresh price
- Ensures DEX has accurate prices for the swap
- Bot wallet must be the oracle owner

### 6. Execute Trade
- Connect to blockchain via RPC
- Call `SCW.executeTrade(dexAddress, swapCalldata)`
- Bot wallet pays gas, SCW executes swap

### 7. Record & Notify
- Insert into `Trades` and `TradeMetrics` tables
- Send Telegram notification to user

## Quick Start

### 1. Create Dead Letter Queue (Optional)

```bash
npx wrangler queues create lt-trading-dlq
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Secrets

```bash
# Bot wallet private key (executes trades on SCWs)
wrangler secret put BOT_PRIVATE_KEY

# Telegram bot token for notifications
wrangler secret put TELEGRAM_BOT_TOKEN
```

### 4. Deploy

```bash
npm run deploy
```

## Trade Amount Calculation Examples

### Example 1: Normal Trade
```
Balance: 1 ETH
TradePercentage: 17%
Multiplier: 1.5
ConsecutiveCount: 2 (this is 3rd consecutive SELL)

ActualTradePercentage = 0.17 × 1.5² = 0.17 × 2.25 = 0.3825 (38.25%)
RawAmount = 1 ETH × 0.3825 = 0.3825 ETH
Price: $2,620/ETH
AmountUSD = $1,002.15

MinAmount: $100, MaxAmount: $500
Result: Capped at $500 = 0.19084 ETH
```

### Example 2: Below Minimum
```
Balance: 0.1 ETH
TradePercentage: 17%
Multiplier: 1.5
ConsecutiveCount: 0

ActualTradePercentage = 0.17 × 1.5⁰ = 0.17 (17%)
RawAmount = 0.1 ETH × 0.17 = 0.017 ETH
Price: $2,620/ETH
AmountUSD = $44.54

MinAmount: $100
Result: Below minimum → Skip trade, notify user
```

### Example 3: Reset Consecutive
```
Last trade: SELL
Current action: BUY

ConsecutiveCount = 0 (reset because direction changed)
ActualTradePercentage = TradePercentage × 1.5⁰ = TradePercentage
```

## Message Format (from Queue)

```json
{
  "userId": 123,
  "configId": 456,
  "pairId": 1,
  "chainId": 48900,
  "action": "SELL",
  "triggerPrice": 3400.50,
  "lastTradePrice": 3000.00,
  "triggerPercentage": 0.10,
  "telegramChatId": "123456789",
  "scwAddress": "0x...",
  "tradePercentage": 0.17,
  "maxAmount": 500,
  "minimumAmount": 100,
  "multiplier": 1.5,
  "chain": {
    "chainId": 48900,
    "chainName": "Zircuit",
    "rpcEndpoint": "https://...",
    "explorerUrl": "https://..."
  },
  "pair": {
    "pairName": "ETH-USDC",
    "dexAddress": "0x...",
    "baseToken": { "symbol": "ETH", "address": "0x...", "decimals": 18 },
    "quoteToken": { "symbol": "USDC", "address": "0x...", "decimals": 6 }
  }
}
```

## Database Updates

### Trades Table
```sql
INSERT INTO Trades (PairID, UserID, PriceID, Action, QuantitySent, QuantityReceived, TxHash)
```

### TradeMetrics Table
```sql
INSERT INTO TradeMetrics (TradeID, ConsecutiveCount, ActualTradePercentage)
```

## Telegram Notifications

### Trade Success
```
🎯 Trade Executed!

📊 Pair: ETH-USDC
🔄 Action: SELL
💰 Amount: 0.19084 ETH
💵 Value: $500.00
📈 Price: $2,620.00
📉 Change: 13.33%
🔗 Chain: Zircuit

⚠️ Amount capped to MaxAmount limit

🔗 View Transaction
```

### Below Minimum
```
⚠️ Trade Skipped - Below Minimum

📊 Pair: ETH-USDC
🔄 Action: SELL
💰 Calculated Amount: $44.54
🚫 Minimum Required: $100

The trade amount is below your minimum trade setting.
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| BOT_PRIVATE_KEY | Private key for bot wallet (must be oracle owner + SCW bot) | Yes |
| TELEGRAM_BOT_TOKEN | Telegram bot token | Yes |
| ENVIRONMENT | 'production', 'staging', 'development' | No |

**Note:** The `BOT_PRIVATE_KEY` wallet must be:
1. The **oracle owner** for all DEX contracts (to call `setPrices`)
2. The **whitelisted bot** for all user SCWs (to call `executeTrade`)

## Error Handling

- **Price fetch fails**: Skip silently (don't execute)
- **Trigger no longer valid**: Skip silently
- **Below minimum**: Record 0-trade, notify user
- **Trade execution fails**: Retry (up to 3 times)
- **After 3 retries**: Move to dead letter queue

## File Structure

```
lt-trading-execution/
├── src/
│   └── worker.js      # Main consumer worker
├── wrangler.toml      # Cloudflare config with queue consumer
├── package.json       # Dependencies (ethers.js)
└── README.md          # This file
```

## License

MIT