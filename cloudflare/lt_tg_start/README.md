# LazaiTrader Registration Worker

Internal microservice that handles user registration and wallet verification.

## Security Model

### Service Binding Architecture

This worker is **ONLY** accessible via Service Binding from the main `lt_tg` worker. It is **NOT** publicly accessible.

**Security Features:**
- ✅ No public routes - cannot be called directly from internet
- ✅ Only callable by `lt_tg` worker via Service Binding
- ✅ D1 database access restricted to workers only
- ✅ Wallet address validation and sanitization
- ✅ Duplicate registration prevention
- ✅ Session-based registration flow tracking

### How Service Bindings Work

```
Internet → Telegram API → lt_tg worker → (Service Binding) → lt_tg_start worker → D1 Database
```

- Users interact with Telegram
- Telegram sends webhooks to `lt_tg`
- `lt_tg` routes registration requests to `lt_tg_start` via internal Service Binding
- `lt_tg_start` handles registration logic and database operations
- No direct public access to `lt_tg_start`

## Features

### User Registration Flow

1. **New User - /start command**
   - Shows friendly intro to LazaiTrader
   - Explains wallet requirements in non-technical terms
   - Requests EOA (Ethereum wallet) address
   - Creates registration session

2. **Wallet Verification**
   - Validates Ethereum address format
   - Checks for duplicate registrations
   - Stores user data in D1 database
   - Sends confirmation with next steps

3. **Returning User - /start command**
   - Welcome back message
   - Shows registered wallet address
   - Quick links to main features

## Database Tables Used

### Users
Stores registered user information:
- `UserID` - Telegram user ID
- `UserWallet` - EOA wallet address
- `TelegramChatID` - Telegram chat ID
- `Username` - Telegram username
- `RegisteredAt` - Registration timestamp
- `SCWAddress` - Smart Contract Wallet (added later)

### RegistrationSessions
Temporary session tracking:
- `UserID` - Telegram user ID
- `State` - Current state ('awaiting_wallet')
- `CreatedAt` - Session creation time
- Automatically deleted after successful registration

## Setup Instructions

### 1. Prerequisites

- D1 database named `lazaitrader` must be created
- `lt_tg` worker must be deployed first
- Both workers need BOT_TOKEN secret

### 2. Run Database Migration

Add the RegistrationSessions table:

```bash
wrangler d1 execute lazaitrader --file=../database/migration_registration_sessions.sql
```

### 3. Update Configuration

Edit `wrangler.toml` and replace `YOUR_DATABASE_ID_HERE` with your actual D1 database ID:

```toml
[[d1_databases]]
binding = "DB"
database_name = "lazaitrader"
database_id = "abc123..."  # Your actual database ID
```

### 4. Set Bot Token

```bash
wrangler secret put BOT_TOKEN
```

Paste the same bot token used in `lt_tg` worker.

### 5. Deploy Worker

```bash
npm run deploy
```

### 6. Update Main Worker

Ensure `lt_tg/wrangler.toml` has the Service Binding:

```toml
[[services]]
binding = "START_WORKER"
service = "lt-tg-start"
```

### 7. Redeploy Main Worker

```bash
cd ../lt_tg
npm run deploy
```

## API Interface

This worker is called internally by `lt_tg` via Service Binding.

### Request Format

```javascript
POST https://internal/start
Content-Type: application/json

{
  "action": "start" | "verify_wallet",
  "chatId": 123456789,
  "userId": 123456789,
  "username": "telegram_username",
  "text": "0x..." // for verify_wallet action
}
```

### Response Format

```javascript
{
  "success": true,
  "registered": true | false,
  "awaiting": "wallet" // if awaiting input
}
```

## Validation Logic

### Ethereum Address Validation

```javascript
✅ Must start with "0x"
✅ Must be exactly 42 characters
✅ Must contain only hex characters (0-9, A-F)
✅ Case-insensitive comparison for duplicates
```

### Duplicate Prevention

```javascript
✅ Check UserID - one account per Telegram user
✅ Check UserWallet - one account per wallet address
```

## Error Handling

The worker handles various error scenarios:

1. **Invalid Wallet Format**
   - User-friendly error message
   - Example of correct format
   - Prompt to try again

2. **Duplicate Wallet**
   - Clear explanation
   - Suggest alternative wallet
   - Contact support option

3. **Database Errors**
   - Generic error message to user
   - Detailed error logged for debugging
   - Graceful fallback

## User Experience

### Non-Technical User Friendly

Messages are designed for users who may not understand crypto terminology:

- ❌ "Provide your EOA address"
- ✅ "Send me your Ethereum wallet address (like your crypto bank account number)"

- ❌ "0x address required"
- ✅ "It starts with '0x' - copy it from your MetaMask or Trust Wallet app"

### Clear Next Steps

After registration, users immediately know:
- What they just did (registered)
- What they have (wallet linked)
- What to do next (set up strategy with /config)
- How to get help (/help command)

## Testing

### Test New Registration

1. Send `/start` to bot
2. Send a valid Ethereum address
3. Verify success message
4. Check database: `wrangler d1 execute lazaitrader --command="SELECT * FROM Users"`

### Test Duplicate Prevention

1. Register with wallet A
2. Try to register again with same wallet → Should reject
3. Different user tries wallet A → Should reject

### Test Invalid Wallet

1. Send `/start`
2. Send invalid address: "not-a-wallet"
3. Should show helpful error
4. Send valid address → Should succeed

## Security Best Practices

### What This Worker Does

✅ **Validates** - Checks wallet address format
✅ **Sanitizes** - Normalizes addresses (lowercase)
✅ **Protects** - Prevents duplicate registrations
✅ **Logs** - Records errors for debugging
✅ **Isolates** - No public access via Service Binding

### What This Worker Does NOT Do

❌ Does not store private keys
❌ Does not have withdrawal permissions
❌ Does not deploy smart contracts (separate worker)
❌ Does not access user funds

## Monitoring

### View Logs

```bash
wrangler tail lt-tg-start
```

### Key Metrics to Monitor

- Registration success rate
- Validation error frequency
- Duplicate wallet attempts
- Database query performance

## Troubleshooting

### Worker not receiving requests

1. Check Service Binding in `lt_tg/wrangler.toml`
2. Verify both workers deployed
3. Check `lt_tg` logs for routing errors

### Database errors

1. Verify D1 binding in `wrangler.toml`
2. Check database ID is correct
3. Ensure migration was run
4. Test with: `wrangler d1 execute lazaitrader --command="SELECT 1"`

### Bot not responding

1. Check BOT_TOKEN is set correctly
2. Verify Telegram API accessible
3. Check worker logs: `wrangler tail`

## Resources

- [Cloudflare Service Bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/)
- [D1 Database Docs](https://developers.cloudflare.com/d1/)
- [Telegram Bot API](https://core.telegram.org/bots/api)
