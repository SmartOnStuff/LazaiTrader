# Smart Contracts

Technical documentation for LazaiTrader smart contracts.

---

## Contract Overview

| Contract | Purpose | Deployed Address |
|----------|---------|------------------|
| LazaiWalletFactory | Deploy user SCWs | `0xe053618226d20AC5daA428e7558bA8aE13AeE6E0` |
| LazaiTradingWallet | User's trading wallet | Per-user (deterministic) |
| FactoryDeployer | Deterministic factory deployment | `0x558bC575E12ecCD0b315F8ECEbbC0196522246BF` |

---

## LazaiWalletFactory

### Purpose

Deploys user Smart Contract Wallets deterministically and manages the DEX whitelist.

### Key Features

- CREATE2 deployment for deterministic addresses
- Centralized DEX whitelist management
- Same address across all chains

### State Variables

```solidity
address public immutable botOperator;        // Bot wallet
bytes32 public constant WALLET_SALT_VERSION; // Salt for CREATE2
mapping(address => bool) public whitelistedDEXs;
mapping(address => address) public userWallets;
mapping(address => bool) public isValidWallet;
```

### Functions

#### createWallet

```solidity
function createWallet(address _owner) external returns (address wallet)
```

Deploys a new SCW for the given owner using CREATE2.

**Parameters:**
- `_owner`: User's EOA address

**Returns:**
- `wallet`: Deployed SCW address

**Requirements:**
- Owner cannot be zero address
- User cannot already have a wallet

#### computeWalletAddress

```solidity
function computeWalletAddress(address _owner) external view returns (address)
```

Predicts the SCW address before deployment.

#### setDEXWhitelist

```solidity
function setDEXWhitelist(address _dex, bool _status) external onlyOwner
```

Add or remove DEX from whitelist.

#### isDEXWhitelisted

```solidity
function isDEXWhitelisted(address _dex) external view returns (bool)
```

Check if DEX is whitelisted.

---

## LazaiTradingWallet

### Purpose

Non-custodial wallet for automated trading. Owner receives all withdrawals; bot operator executes trades.

### Key Features

- Immutable owner (user's EOA)
- Bot operator for trade execution
- DEX whitelist enforcement
- Reentrancy protection

### State Variables

```solidity
address public immutable owner;       // User's EOA
address public immutable botOperator; // Bot wallet
address public immutable factory;     // Factory for whitelist
```

### Functions

#### executeTrade

```solidity
function executeTrade(address _dex, bytes calldata _data)
    external
    onlyBotOperator
    onlyWhitelistedDEX(_dex)
    nonReentrant
    returns (bool success, bytes memory returnData)
```

Execute trade on whitelisted DEX.

**Modifiers:**
- `onlyBotOperator`: Only bot can call
- `onlyWhitelistedDEX`: DEX must be whitelisted
- `nonReentrant`: Prevent reentrancy

#### approveToken

```solidity
function approveToken(address _token, address _dex, uint256 _amount)
    external
    onlyBotOperator
    onlyWhitelistedDEX(_dex)
```

Approve token spending for DEX.

#### withdrawAllTokens

```solidity
function withdrawAllTokens(address _token) external onlyBotOrOwner nonReentrant
```

Withdraw all tokens to owner's EOA.

**Key Point:** Funds ALWAYS go to `owner`, regardless of caller.

#### withdrawAllNative

```solidity
function withdrawAllNative() external onlyBotOrOwner nonReentrant
```

Withdraw all native tokens to owner.

---

## FactoryDeployer

### Purpose

Helper contract for deploying the factory at a deterministic address across chains.

### Key Features

- Uses CREATE2 for factory deployment
- Allows address prediction
- Works on any EVM chain

### Functions

#### deployFactory

```solidity
function deployFactory(address _botOperator, address[] memory _defaultDEXs)
    external
    returns (address factory)
```

Deploy factory with CREATE2.

#### predictFactoryAddress

```solidity
function predictFactoryAddress(address _botOperator, address[] memory _defaultDEXs)
    external
    view
    returns (address)
```

Predict factory address before deployment.

---

## Security Considerations

### Access Control

```solidity
// Only bot can trade
modifier onlyBotOperator() {
    if (msg.sender != botOperator) revert UnauthorizedOperator();
    _;
}

// Only whitelisted DEXs
modifier onlyWhitelistedDEX(address dex) {
    if (!factory.isDEXWhitelisted(dex)) revert DEXNotWhitelisted();
    _;
}
```

### Immutable Variables

Owner and bot operator cannot be changed after deployment:

```solidity
address public immutable owner;
address public immutable botOperator;
```

### Reentrancy Protection

All external-facing functions use `nonReentrant`:

```solidity
function executeTrade(...) external nonReentrant { ... }
function withdrawAllTokens(...) external nonReentrant { ... }
```

---

## Deployment

### Prerequisites

- Deployer wallet with native tokens
- Bot operator address
- Default DEX addresses

### Using Python Script

```bash
cd contracts/deployer

# Edit deploy.py
# - Set BOT_OPERATOR
# - Set PRIVATE_KEY
# - Set WHITELISTED_DEXES
# - Set CHAINS

python deploy.py
```

### Using Remix

1. Deploy FactoryDeployer
2. Call `predictFactoryAddress()` with params
3. Call `deployFactory()` with same params
4. Verify address matches prediction
5. Transfer ownership if needed

### Verification

After deployment:
1. Verify factory address matches on all chains
2. Confirm bot operator is set correctly
3. Test wallet creation
4. Verify DEX whitelist

---

## Contract Interactions

### Creating a Wallet

```javascript
const factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, signer);
const tx = await factory.createWallet(userEOA);
const receipt = await tx.wait();
// Parse WalletCreated event for address
```

### Executing a Trade

```javascript
const scw = new ethers.Contract(SCW_ADDRESS, SCW_ABI, botSigner);

// Approve first
await scw.approveToken(tokenAddress, dexAddress, amount);

// Execute swap
const swapData = dexInterface.encodeFunctionData('swap', [...]);
await scw.executeTrade(dexAddress, swapData);
```

### Withdrawing

```javascript
const scw = new ethers.Contract(SCW_ADDRESS, SCW_ABI, ownerOrBotSigner);
await scw.withdrawAllTokens(tokenAddress);
```

---

## Gas Optimization

### Factory

- Minimal storage operations
- Efficient CREATE2 usage
- Batch whitelist updates available

### Trading Wallet

- Immutable variables (no SLOAD)
- External calls only when necessary
- SafeERC20 for token safety

---

## Upgrades

The current contracts are **not upgradeable** by design:

**Pros:**
- Maximum security
- No admin backdoor
- Immutable guarantees

**Cons:**
- Cannot fix bugs without new deployment
- Cannot add features

For major changes, new factory version would be deployed with migration path.

---

## Testing

### Local Testing

Use Hardhat or Foundry:

```bash
cd contracts
npm install
npx hardhat test
```

### Testnet Testing

Deploy to testnet first:
- Hyperion Testnet (Metis)
- Zircuit Garfield

### Test Cases

- Wallet creation
- Deterministic address verification
- Trade execution
- Withdrawal to owner only
- DEX whitelist enforcement
- Reentrancy protection

---

## Resources

- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts/)
- [CREATE2 Explained](https://docs.openzeppelin.com/cli/2.8/deploying-with-create2)
- [Solidity Documentation](https://docs.soliditylang.org/)
