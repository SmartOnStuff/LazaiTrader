# Local Development

Setting up your local environment for LazaiTrader development.

---

## Prerequisites

### Required Software

| Software | Version | Purpose |
|----------|---------|---------|
| Node.js | 18+ | Runtime |
| npm | 9+ | Package manager |
| Git | Latest | Version control |
| Wrangler | Latest | Cloudflare CLI |

### Accounts Needed

| Account | Purpose |
|---------|---------|
| Cloudflare | Workers, D1, Queues |
| Telegram | Bot testing |
| GitHub | Repository access |

---

## Initial Setup

### 1. Clone Repository

```bash
git clone <repository-url>
cd LazaiTraderPRIV/cloudflare
```

### 2. Install Wrangler

```bash
npm install -g wrangler
wrangler login
```

### 3. Install Dependencies

```bash
# Install for all workers
for dir in lt_tg lt_tg_start lt_tg_deposit lt_tg_withdrawal \
           lt_tg_balance lt_tg_chart lt_trader_queue \
           lt_trader_execute lt_balance_tracker; do
  cd $dir && npm install && cd ..
done
```

---

## Database Setup

### Create Local D1

```bash
# Create local database
wrangler d1 create lazaitrader-local

# Apply schema
wrangler d1 execute lazaitrader-local --local \
  --file=database/schema.sql
```

### Seed Test Data

```sql
-- Insert test chain
INSERT INTO Chains (ChainID, ChainName, RPCEndpoint, ExplorerURL, NativeCurrency)
VALUES (1088, 'Metis Andromeda', 'https://andromeda.metis.io', 'https://explorer.metis.io', 'METIS');

-- Insert test tokens
INSERT INTO Tokens (ChainID, Symbol, TokenAddress, Decimals)
VALUES
  (1088, 'WETH', '0x420000000000000000000000000000000000000A', 18),
  (1088, 'm.USDC', '0xEA32A96608495e54156Ae48931A7c20f0dcc1a21', 6);
```

### Configure Worker

Update `wrangler.toml` for local development:

```toml
[[d1_databases]]
binding = "DB"
database_name = "lazaitrader-local"
database_id = "local"
```

---

## Worker Setup

### Main Bot (lt_tg)

```bash
cd lt_tg

# Copy example config
cp wrangler.toml.example wrangler.toml

# Set secrets
wrangler secret put BOT_TOKEN

# Run locally
npm run dev
```

### Local Telegram Testing

For webhook testing, use ngrok:

```bash
# Install ngrok
npm install -g ngrok

# Expose local server
ngrok http 8787

# Set webhook to ngrok URL
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -d "url=https://your-ngrok-url.ngrok.io"
```

---

## Environment Variables

### Secrets (via Wrangler)

```bash
# Bot token
wrangler secret put BOT_TOKEN

# Blockchain private key (for testing)
wrangler secret put BOT_PRIVATE_KEY

# Worker authentication
wrangler secret put WORKER_SECRET
```

### Local .dev.vars

For local development, create `.dev.vars`:

```
BOT_TOKEN=your_test_bot_token
BOT_PRIVATE_KEY=your_test_private_key
WORKER_SECRET=local_secret
```

{% hint style="warning" %}
Never commit `.dev.vars` or real secrets to Git!
{% endhint %}

---

## Running Workers Locally

### Single Worker

```bash
cd lt_tg
npm run dev
# Runs on http://localhost:8787
```

### Multiple Workers

Open separate terminals:

```bash
# Terminal 1
cd lt_tg && npm run dev -- --port 8787

# Terminal 2
cd lt_tg_start && npm run dev -- --port 8788

# Terminal 3
cd lt_trader_queue && npm run dev -- --port 8789
```

### Service Bindings Locally

Local service bindings require running multiple workers. Update `wrangler.toml`:

```toml
[[services]]
binding = "START_WORKER"
service = "lt-tg-start"
environment = "development"
```

---

## Testing Workflow

### 1. Test Telegram Commands

```bash
# Start main bot
cd lt_tg && npm run dev

# Send commands to your test bot
# /start, /balance, /config, etc.
```

### 2. Test Database Operations

```bash
# Query local D1
wrangler d1 execute lazaitrader-local --local \
  --command="SELECT * FROM Users"
```

### 3. Test Blockchain Interactions

Use testnet chains:
- Hyperion Testnet (Chain ID: 133717)
- Zircuit Garfield (Chain ID: 48898)

---

## Common Development Tasks

### Adding a New Command

1. Add handler in `lt_tg/worker.js`
2. Create helper function if needed
3. Update command list
4. Test locally

### Modifying Database

1. Create migration file
2. Test on local D1
3. Update `schema.sql`
4. Document changes

### Adding New Worker

1. Create directory structure
2. Add `wrangler.toml`
3. Add `package.json`
4. Implement `worker.js`
5. Add service binding to main bot

---

## Debugging

### Worker Logs

```bash
# Local logs appear in terminal
npm run dev

# Remote logs
wrangler tail
```

### D1 Queries

```bash
# Run query
wrangler d1 execute lazaitrader-local --local \
  --command="SELECT * FROM Trades LIMIT 10"
```

### Blockchain Debugging

Use block explorers:
- [Metis Explorer](https://explorer.metis.io)
- [Hyperion Testnet Explorer](https://hyperion-testnet-explorer.metisdevops.link)

---

## Deployment

### Development Environment

```bash
npm run deploy:dev
```

### Staging Environment

```bash
npm run deploy:staging
```

### Production

```bash
npm run deploy
```

---

## Troubleshooting

### Wrangler Not Finding Config

```bash
# Ensure you're in correct directory
pwd
ls wrangler.toml
```

### D1 Connection Issues

```bash
# Check database exists
wrangler d1 list

# Recreate if needed
wrangler d1 create lazaitrader-local
```

### Service Binding Errors

Ensure all bound workers are running locally or deployed.

### Telegram Webhook Not Working

1. Check ngrok is running
2. Verify webhook URL is set
3. Check bot token is correct

---

## Resources

- [Wrangler Commands](https://developers.cloudflare.com/workers/wrangler/commands/)
- [D1 Documentation](https://developers.cloudflare.com/d1/)
- [Workers Local Development](https://developers.cloudflare.com/workers/local-development/)
