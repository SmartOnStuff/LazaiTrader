# For Developers

Welcome to the LazaiTrader developer documentation. This section covers how to contribute to the project, set up a local development environment, and understand the codebase.

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Cloudflare account
- Wrangler CLI (`npm install -g wrangler`)
- Git

### Repository Structure

```
cloudflare/
├── lt_tg/                  # Main Telegram bot
├── lt_tg_start/            # Registration worker
├── lt_tg_deposit/          # SCW deployment
├── lt_tg_withdrawal/       # Withdrawal handling
├── lt_tg_balance/          # Balance fetching
├── lt_tg_chart/            # Chart generation
├── lt_trader_queue/        # Trade queue producer
├── lt_trader_execute/      # Trade executor
├── lt_balance_tracker/     # Balance tracker
├── contracts/              # Smart contracts
│   └── deployer/           # Deployment tools
├── database/               # Schema and migrations
│   ├── schema.sql
│   └── migrations/
├── shared/                 # Shared utilities
│   ├── priceHelper.js
│   ├── priceParser.js
│   └── tokenMappings.json
└── docs/                   # This documentation
```

---

## Quick Links

- [Contributing](contributing) - How to contribute
- [Local Development](local-development) - Setting up your environment
- [Workers Reference](workers-reference) - Worker documentation
- [Smart Contracts](smart-contracts) - Contract details

---

## Development Workflow

### 1. Clone the Repository

```bash
git clone <repository-url>
cd LazaiTraderPRIV/cloudflare
```

### 2. Install Dependencies

```bash
# For each worker
cd lt_tg && npm install && cd ..
cd lt_trader_queue && npm install && cd ..
# ... repeat for other workers
```

### 3. Configure Wrangler

```bash
wrangler login
```

### 4. Set Up Local D1

```bash
# Create local database
wrangler d1 execute lazaitrader --local --file=database/schema.sql
```

### 5. Run Locally

```bash
cd lt_tg
npm run dev
```

---

## Architecture Overview

### Worker Communication

```
┌─────────────────┐
│     lt_tg       │ ◄── Telegram Webhooks
│   (Main Bot)    │
└────────┬────────┘
         │ Service Bindings
         ▼
┌─────────────────┐  ┌─────────────────┐
│  lt_tg_start    │  │  lt_tg_deposit  │
│ (Registration)  │  │ (SCW Deploy)    │
└─────────────────┘  └─────────────────┘
```

### Data Flow

```
User Input → Worker → D1 Database → Blockchain
                ↑           ↓
              Queue    Price APIs
```

---

## Key Concepts

### Service Bindings

Internal worker-to-worker communication:

```toml
# wrangler.toml
[[services]]
binding = "START_WORKER"
service = "lt-tg-start"
```

### D1 Bindings

Database access:

```toml
[[d1_databases]]
binding = "DB"
database_name = "lazaitrader"
database_id = "your-database-id"
```

### Queue Bindings

Async message passing:

```toml
[[queues.producers]]
queue = "lt-trading-queue"
binding = "TRADING_QUEUE"
```

---

## Code Standards

### JavaScript/Node.js

- ES modules (`import`/`export`)
- Async/await for promises
- JSDoc comments for functions
- Consistent error handling

### Solidity

- Solidity 0.8.20+
- OpenZeppelin libraries
- NatSpec documentation
- Gas optimization

### Git Workflow

- Feature branches
- Descriptive commit messages
- PR reviews required
- CI/CD checks

---

## Testing

### Local Testing

```bash
# Run worker locally
npm run dev

# Use ngrok for Telegram webhooks
ngrok http 8787
```

### Database Testing

```bash
# Local D1
wrangler d1 execute lazaitrader --local --command="SELECT * FROM Users"
```

### Contract Testing

```bash
cd contracts/deployer
# Use Remix or Hardhat for testing
```

---

## Deployment

### Workers

```bash
# Production
npm run deploy

# Staging (if configured)
npm run deploy:staging
```

### Database Migrations

```bash
# Apply migration
wrangler d1 execute lazaitrader --file=database/migrations/001_migration.sql
```

### Smart Contracts

See [Smart Contracts](smart-contracts) for deployment instructions.

---

## Common Tasks

### Adding a New Token

1. Insert into `Tokens` table
2. Update price API endpoints
3. Test price fetching

### Adding a Trading Pair

1. Ensure tokens exist
2. Insert into `TradingPairs`
3. Configure DEX address
4. Test trade execution

### Adding a New Chain

1. Deploy factory contract
2. Insert into `Chains` table
3. Deploy tokens and pairs
4. Update worker configurations

---

## Resources

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Cloudflare D1 Docs](https://developers.cloudflare.com/d1/)
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts/)

---

## Getting Help

- Review existing code for patterns
- Check inline comments and JSDoc
- Open issues for questions
- Join developer discussions
