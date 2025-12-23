# Contributing

Guidelines for contributing to LazaiTrader.

---

## How to Contribute

We welcome contributions from the community! Here's how you can help:

### Types of Contributions

| Type | Description |
|------|-------------|
| **Bug fixes** | Fix issues in existing code |
| **Features** | Add new functionality |
| **Documentation** | Improve docs and guides |
| **Testing** | Add test coverage |
| **Security** | Report vulnerabilities |

---

## Getting Started

### 1. Fork the Repository

Create your own fork to work on.

### 2. Clone Your Fork

```bash
git clone https://github.com/YOUR_USERNAME/LazaiTraderPRIV.git
cd LazaiTraderPRIV
```

### 3. Set Up Development Environment

See [Local Development](local-development) for detailed setup instructions.

### 4. Create a Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/bug-description
```

---

## Development Process

### Making Changes

1. **Write clean code** - Follow existing patterns
2. **Add comments** - Explain complex logic
3. **Test locally** - Ensure functionality works
4. **Update docs** - If behavior changes

### Code Style

#### JavaScript

```javascript
// Use async/await
async function fetchPrice(symbol) {
  const response = await fetch(url);
  return response.json();
}

// Use descriptive names
const userTradingConfig = await getConfig(userId);

// Handle errors properly
try {
  await executeTrade(params);
} catch (error) {
  console.error('Trade failed:', error.message);
  throw error;
}
```

#### Solidity

```solidity
// Use NatSpec comments
/**
 * @notice Execute a trade on a whitelisted DEX
 * @param _dex DEX contract address
 * @param _data Encoded swap function call
 */
function executeTrade(address _dex, bytes calldata _data) external;
```

---

## Pull Request Process

### 1. Commit Your Changes

```bash
# Use descriptive commit messages
git commit -m "feat: add support for new token type"
git commit -m "fix: correct price calculation for edge case"
git commit -m "docs: update contributing guidelines"
```

### Commit Message Format

```
type: short description

Longer explanation if needed.

Fixes #123
```

Types:
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation
- `refactor` - Code refactoring
- `test` - Adding tests
- `chore` - Maintenance

### 2. Push to Your Fork

```bash
git push origin feature/your-feature-name
```

### 3. Create Pull Request

1. Go to the original repository
2. Click "New Pull Request"
3. Select your branch
4. Fill out the PR template

### PR Template

```markdown
## Description
Brief description of changes.

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation
- [ ] Other

## Testing
How was this tested?

## Checklist
- [ ] Code follows project style
- [ ] Self-reviewed
- [ ] Documented changes
- [ ] No breaking changes
```

---

## Review Process

### What We Look For

| Aspect | Details |
|--------|---------|
| **Functionality** | Does it work correctly? |
| **Code quality** | Clean, readable, maintainable |
| **Security** | No vulnerabilities introduced |
| **Performance** | Efficient implementation |
| **Documentation** | Changes documented |

### Responding to Feedback

- Address all comments
- Push additional commits
- Request re-review when ready

---

## Development Guidelines

### Workers

- Keep workers focused (single responsibility)
- Use service bindings for internal communication
- Handle errors gracefully
- Log appropriately (not sensitive data)

### Database

- Use migrations for schema changes
- Add indexes for queried columns
- Update schema.sql to match production

### Smart Contracts

- Follow OpenZeppelin patterns
- Prioritize security over gas optimization
- Document all functions
- Consider upgrade paths

---

## Security Considerations

### Sensitive Data

Never commit:
- API keys
- Private keys
- Passwords
- Database credentials

Use Wrangler secrets:
```bash
wrangler secret put SECRET_NAME
```

### Code Review Focus

- Input validation
- Access control
- Reentrancy protection
- Integer overflow/underflow

### Reporting Vulnerabilities

For security issues, please contact us privately rather than creating a public issue.

---

## Testing Requirements

### Before Submitting PR

- [ ] Run locally and verify functionality
- [ ] Test edge cases
- [ ] Check for regressions
- [ ] Verify on testnet (if blockchain changes)

### Test Data

Use testnet chains and test tokens for development:
- Hyperion Testnet (Metis)
- Zircuit Garfield Testnet

---

## Areas Seeking Help

### High Priority

- Additional test coverage
- Documentation improvements
- Gas optimization for contracts
- Additional DEX integrations

### Nice to Have

- Multi-language support
- Enhanced error messages
- Performance monitoring
- Analytics features

---

## Recognition

Contributors will be:
- Credited in release notes
- Added to contributors list
- Eligible for any future rewards/grants

---

## Questions?

- Open an issue for discussion
- Review existing code for patterns
- Check documentation first

Thank you for contributing to LazaiTrader!
