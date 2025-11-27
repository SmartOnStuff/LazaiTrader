# LazaiTrader Telegram Bot - Cloudflare Worker

A simple Telegram bot menu interface deployed as a Cloudflare Worker. All menu items currently return "TODO" messages as placeholders.

## Features

- ✅ Webhook-based Telegram bot (no polling needed)
- ✅ Serverless deployment on Cloudflare Workers
- ✅ Menu structure with inline keyboards
- ✅ All commands return TODO placeholders
- ✅ No backend integration (pure UI/menu)

## Commands

- `/start` - Show welcome message and main menu
- `/wallet` - TODO: Show wallet addresses
- `/balance` - TODO: Check balances
- `/withdraw` - TODO: Withdraw funds
- `/config` - Show trading pair selection menu (TODO)
- `/myconfig` - TODO: View strategies
- `/deleteconfig` - Show delete config menu (TODO)
- `/chart` - TODO: View trade history
- `/contribute` - TODO: Share trading data
- `/suggestion` - TODO: Get strategy suggestions
- `/help` - Show available commands

## Prerequisites

1. **Cloudflare Account** - Sign up at [cloudflare.com](https://cloudflare.com)
2. **Telegram Bot Token** - Create a bot via [@BotFather](https://t.me/botfather)
3. **Node.js** - Install from [nodejs.org](https://nodejs.org)
4. **Wrangler CLI** - Cloudflare Workers CLI tool

## Setup Instructions

### 1. Install Dependencies

```bash
cd cloudflare/lt_tg
npm install
```

### 2. Configure Wrangler

Login to Cloudflare:

```bash
npx wrangler login
```

### 3. Set Bot Token

Add your Telegram Bot Token as a secret:

```bash
npx wrangler secret put BOT_TOKEN
```

When prompted, paste your bot token from BotFather.

### 4. Deploy to Cloudflare Workers

```bash
npm run deploy
```

This will deploy your worker and give you a URL like:
```
https://lazaitrader-tg-bot.your-subdomain.workers.dev
```

### 5. Set Telegram Webhook

Tell Telegram to send updates to your worker:

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://lazaitrader-tg-bot.your-subdomain.workers.dev"}'
```

Replace:
- `<YOUR_BOT_TOKEN>` with your actual bot token
- `lazaitrader-tg-bot.your-subdomain.workers.dev` with your actual worker URL

### 6. Test Your Bot

Open Telegram and send `/start` to your bot. You should see the welcome message and menu!

## Development

### Local Development

Test your worker locally:

```bash
npm run dev
```

This starts a local server on `http://localhost:8787`

**Note:** For local testing with Telegram, you'll need to use a tunneling service like [ngrok](https://ngrok.com) to expose your local server.

### View Logs

Monitor your worker in real-time:

```bash
npm run tail
```

## Project Structure

```
cloudflare/lt_tg/
├── worker.js          # Main Cloudflare Worker code
├── wrangler.toml      # Cloudflare Workers configuration
├── package.json       # Node.js dependencies
└── README.md          # This file
```

## How It Works

1. **Webhook**: Telegram sends updates to your Cloudflare Worker URL
2. **Worker**: Processes the update and routes to appropriate handler
3. **Response**: Worker calls Telegram API to send messages back
4. **TODO Placeholders**: All actions currently return "TODO" messages

## Next Steps (Future Implementation)

To add actual functionality, you'll need to:

1. **Add Storage**: Use Cloudflare KV or D1 for user data
2. **Add API Integration**: Connect to blockchain APIs
3. **Add Business Logic**: Implement wallet management, trading, etc.
4. **Add Authentication**: Verify user ownership of wallets
5. **Add Security**: Rate limiting, input validation, etc.

## Troubleshooting

### Bot doesn't respond

1. Check webhook is set correctly:
   ```bash
   curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo"
   ```

2. Check worker logs:
   ```bash
   npm run tail
   ```

3. Verify bot token is set:
   ```bash
   npx wrangler secret list
   ```

### Deploy fails

- Make sure you're logged in: `npx wrangler login`
- Check your wrangler.toml configuration
- Verify you have a Cloudflare account with Workers enabled

### Webhook errors

- Ensure your worker URL is HTTPS (Cloudflare provides this automatically)
- Check that your worker is deployed and accessible
- Verify the webhook URL matches your worker URL exactly

## Resources

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)

## License

MIT
