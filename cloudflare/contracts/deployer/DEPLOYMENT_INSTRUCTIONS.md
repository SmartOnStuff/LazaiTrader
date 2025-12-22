# Deterministic Cross-Chain Factory Deployment

## Quick Start (Python Script)

For automated deployment across multiple chains, use the Python script:

```bash
# Install dependencies
pip install web3 py-solc-x

# Edit deploy.py and update configuration:
# - BOT_OPERATOR: Your bot operator address
# - PRIVATE_KEY: Your deployer wallet private key
# - WHITELISTED_DEXES: List of DEX addresses to whitelist
# - CHAINS: List of chains to deploy to

# Run deployment
python deploy.py
```

The script will:
1. Compile all contracts
2. Deploy FactoryDeployer on each chain
3. Deploy LazaiWalletFactory via CREATE2 (deterministic address)
4. Transfer factory ownership to BOT_OPERATOR
5. Verify all factory addresses match across chains
6. Save results to `deployment_results.json`

### Configuration Variables

| Variable | Type | Description |
|----------|------|-------------|
| `BOT_OPERATOR` | `str` | Single wallet address that will own all factories |
| `PRIVATE_KEY` | `str` | Deployer's private key (remove before committing!) |
| `WHITELISTED_DEXES` | `list[str]` | List of DEX addresses to whitelist |
| `CHAINS` | `list[dict]` | Chain configs with name, chain_id, rpc_url |

---

## Manual Deployment (Remix)

If you prefer manual deployment via Remix, follow the instructions below.

## The Key Insight

**FactoryDeployer can be at different addresses on each chain** (that's fine - it's just a helper).

**BUT the LazaiWalletFactory it deploys WILL be at the same address on each chain** because:
- FactoryDeployer uses CREATE2 with a fixed salt: `FACTORY_CREATION_SALT`
- CREATE2 address depends on: `[deployer_address, salt, bytecode_hash]`
- The bytecode is identical across chains (same Solidity code, same constructor args)
- So: `same_factory_bytecode + same_salt = same_factory_address` (regardless of deployer's address!)

---

## Files to Add to Remix

Create these 3 files in Remix (in order):

1. **LazaiTradingWallet.sol**
2. **LazaiWalletFactory.sol**  
3. **FactoryDeployer.sol**

---

## Deployment on Chain 1 (Zircuit / Metis)

### Step 1: Calculate Predicted Address
1. Deploy **FactoryDeployer** to Remix (empty constructor)
2. Call `predictFactoryAddress()` with:
   ```
   _botOperator: 0x... (your bot address)
   _defaultDEXs: [0xabc..., 0xdef...] (your DEX addresses)
   ```
3. **SAVE the returned address** - this is where factory WILL be deployed

**Example output:**
```
Predicted Factory Address: 0x1234567890123456789012345678901234567890
```

### Step 2: Deploy Factory
1. Still in **FactoryDeployer**, call `deployFactory()` with same parameters:
   ```
   _botOperator: 0x... (SAME as above)
   _defaultDEXs: [0xabc..., 0xdef...] (SAME as above, SAME ORDER)
   ```
2. Check the transaction receipt
3. **VERIFY the factory address matches prediction**

You now have:
```
Chain 1 Factory Address: 0x1234567890123456789012345678901234567890
```

### Step 3: Test Wallet Creation
1. Go to **LazaiWalletFactory** deployed contract
2. Call `createWallet()` with a test owner:
   ```
   _owner: 0x9999999999999999999999999999999999999999
   ```
3. Check event logs for wallet address
4. **SAVE this wallet address**

```
Chain 1 Wallet Address (for owner 0x9999...): 0xabcdef123...
```

---

## Deployment on Chain 2 (Zircuit / Metis / Mainnet)

### Step 1: Switch Networks
- In Remix, change RPC to Chain 2
- **Use the same account** (same private key as Chain 1)

### Step 2: Predict Factory Address
1. Deploy **FactoryDeployer** to Remix on Chain 2
2. Call `predictFactoryAddress()` with **IDENTICAL parameters**:
   ```
   _botOperator: 0x... (SAME address as Chain 1)
   _defaultDEXs: [0xabc..., 0xdef...] (SAME addresses, SAME ORDER)
   ```

**CRITICAL:** Compare this address to Chain 1's prediction!

```
Chain 2 Predicted: 0x1234567890123456789012345678901234567890
Chain 1 Predicted: 0x1234567890123456789012345678901234567890
                   ✅ MUST MATCH
```

### Step 3: Deploy Factory
1. Call `deployFactory()` on Chain 2 with same parameters
2. Verify factory address matches Chain 1

```
Chain 2 Factory Address: 0x1234567890123456789012345678901234567890
                        ✅ MATCHES Chain 1
```

### Step 4: Test Wallet Creation
1. Go to **LazaiWalletFactory** on Chain 2
2. Call `createWallet()` with **SAME owner** as Chain 1:
   ```
   _owner: 0x9999999999999999999999999999999999999999
   ```
3. Check wallet address

```
Chain 2 Wallet Address (same owner): 0xabcdef123...
                                      ✅ MATCHES Chain 1
```

---

## Verification Checklist

Before calling `deployFactory()`, verify predictions match:

```
✅ Chain 1 Factory Prediction
   Address: 0x1234...

✅ Chain 2 Factory Prediction  
   Address: 0x1234...
   
   MATCH? 🎯 YES → Proceed to deploy
```

After deployment, verify wallets match:

```
✅ Chain 1 Wallet (owner 0x9999...)
   Address: 0xabcd...

✅ Chain 2 Wallet (same owner)
   Address: 0xabcd...
   
   MATCH? 🎯 YES → Success!
```

---

## Common Mistakes to Avoid

❌ **Using different DEX addresses** on different chains
   → All params must be IDENTICAL

❌ **Changing order of _defaultDEXs array**
   → `[A, B]` on Chain 1 but `[B, A]` on Chain 2
   → This changes the bytecode hash!

❌ **Using different _botOperator**
   → Must be the same address on all chains

❌ **Not deploying FactoryDeployer on each chain**
   → You need a new FactoryDeployer on each chain (but it's just a helper)
   → The factory it creates will be at same address

---

## Why This Works

CREATE2 formula: `deployed_address = keccak256(0xff, deployer, salt, keccak256(bytecode))`

With our setup:
- `0xff` = CREATE2 opcode constant (same everywhere)
- `deployer` = FactoryDeployer address (different per chain - OK!)
- `salt` = `FACTORY_CREATION_SALT` (same constant - 🔑 KEY)
- `bytecode` = LazaiWalletFactory bytecode (same code - same params - ✅)

Result: **Same factory address across all chains!**

---

## After Verification

Once you confirm wallets match on both chains:
1. Deploy on 3rd chain (Ethereum Mainnet)
2. Create wallets with same owners
3. All addresses should be identical across all 3 chains
4. Profit! 🚀

---

## Support

If factory addresses don't match:
1. Double-check `_botOperator` is identical
2. Double-check `_defaultDEXs` array is identical and in same order
3. Verify you're calling with same parameters on both chains
4. Check console for any errors
