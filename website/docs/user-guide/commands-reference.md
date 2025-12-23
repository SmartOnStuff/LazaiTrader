# Commands Reference

Complete list of all LazaiTrader bot commands and their functions.

---

## Quick Reference

| Command | Description |
|---------|-------------|
| `/start` | Register with LazaiTrader |
| `/deposit` | Get your SCW deposit address |
| `/balance` | Check your portfolio balances |
| `/config` | Configure a trading strategy |
| `/myconfig` | View your active strategies |
| `/deleteconfig` | Remove a strategy |
| `/withdraw` | Withdraw funds to your wallet |
| `/chart` | View trading history and PnL |
| `/suggestion` | Get strategy suggestions |
| `/contribute` | Share trading data |
| `/help` | Show help menu |

---

## Account Commands

### /start

**Purpose:** Register a new account or welcome back existing users.

**New Users:**
- Prompts for wallet address
- Creates your account
- Links your Telegram to your EOA

**Returning Users:**
- Shows welcome message
- Displays registered wallet
- Quick links to common actions

---

### /help

**Purpose:** Display available commands and quick guidance.

**Shows:**
- List of all commands
- Brief description of each
- Links to documentation

---

## Wallet Commands

### /deposit

**Purpose:** Deploy your Smart Contract Wallet and show deposit address.

**First Use:**
- Deploys SCW on all active chains
- Shows your deposit address
- Lists supported tokens

**Subsequent Uses:**
- Shows existing deposit address
- Current balances
- Supported chains

---

### /balance

**Purpose:** Check your current token balances and portfolio value.

**Shows:**
- Token holdings per chain
- USD value per token
- Total portfolio value
- Last update time

---

### /withdraw

**Purpose:** Send funds from your SCW to your registered wallet.

**Process:**
1. Select chain
2. Select token (or all)
3. Confirm withdrawal
4. Receive funds in your EOA

**Note:** Withdrawals always go to your registered wallet address.

---

## Strategy Commands

### /config

**Purpose:** Create or update a trading strategy.

**Parameters:**
| Setting | Range | Description |
|---------|-------|-------------|
| Trigger % | 1-50% | Price change to trigger |
| Trade % | 1-100% | Balance portion per trade |
| Min Amount | $1+ | Minimum trade in USD |
| Max Amount | $1+ | Maximum trade in USD |
| Multiplier | 1.0-3.0 | Consecutive trade scaling |

---

### /myconfig

**Purpose:** View all your active trading strategies.

**Shows:**
- Strategy settings per pair
- Active/inactive status
- Creation date

---

### /deleteconfig

**Purpose:** Remove an existing trading strategy.

**Process:**
1. Shows list of strategies
2. Select one to delete
3. Confirm deletion
4. Trading stops for that pair

---

## Analytics Commands

### /chart

**Purpose:** View trading performance and history.

**Shows:**
- Visual price chart with trade markers
- Total trades and buy/sell breakdown
- Portfolio value over time
- PnL (profit and loss)

---

### /suggestion

**Purpose:** Get AI-powered strategy suggestions.

**Based on:**
- Your trading history
- Current market conditions
- Community performance

:::info
Feature is being enhanced. More sophisticated suggestions coming soon.
:::

---

### /contribute

**Purpose:** Opt-in to share anonymized trading data.

**Benefits:**
- Help improve the platform
- Enable community analytics
- Support strategy suggestions

**Privacy:**
- Data is anonymized
- No personal information shared
- Opt-out anytime

---

## Command Flow Examples

### New User Setup

```
/start
→ Enter wallet address
→ Registration complete

/deposit
→ SCW deployed
→ Deposit address shown

(Send tokens to SCW)

/balance
→ Verify deposit arrived

/config
→ Select pair
→ Enter parameters
→ Strategy active!
```

### Daily Check

```
/balance
→ See holdings

/chart
→ Review performance

/myconfig
→ Verify strategies
```

### Withdraw and Leave

```
/withdraw
→ Select chain
→ Select "All Tokens"
→ Confirm

/deleteconfig
→ Remove all strategies

(Funds in your wallet)
```

---

## Error Messages

### Common Errors

| Error | Meaning | Solution |
|-------|---------|----------|
| "Not registered" | No account found | Run `/start` first |
| "No SCW deployed" | Wallet not created | Run `/deposit` first |
| "No balance" | Empty wallet | Deposit funds first |
| "Invalid input" | Wrong format | Check the required format |
| "Strategy not found" | No config for pair | Create with `/config` |

---

## Tips

:::tip
**Shortcut:** You can type commands without the `/` in private chats with the bot.
:::

:::tip
**Menu:** Telegram shows command suggestions when you type `/` - tap to select.
:::

:::tip
**Help:** Add "help" after most commands for specific guidance (e.g., `/config help`).
:::
