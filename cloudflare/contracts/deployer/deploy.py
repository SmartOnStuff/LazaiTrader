#!/usr/bin/env python3
"""
Deterministic Cross-Chain Factory Deployment Script

This script deploys FactoryDeployer and LazaiWalletFactory across multiple chains
with deterministic addresses using CREATE2.

Usage:
    1. Install dependencies: pip install web3 py-solc-x
    2. Update configuration variables below
    3. Run: python deploy.py
"""

import json
import time
import traceback
from web3 import Web3
from solcx import compile_standard, install_solc

# =============================================================================
# CONFIGURATION - UPDATE THESE VALUES BEFORE RUNNING
# =============================================================================

# Bot operator address - receives factory ownership on all chains
BOT_OPERATOR = "0x50dBE40A3a792F18163f70c625ABd6B760156047"

# Deployer private key - REMOVE BEFORE COMMITTING
PRIVATE_KEY = "YOUR_PRIVATE_KEY"

# Whitelisted DEX addresses - MUST be identical and in same order on all chains
WHITELISTED_DEXES = ["0x7Fd9F1BBFF0f12822Dce087D4020310b06a01F70", "0x0792C46723d479D4C29De5D78D93C0146EdF3f5B", "0x1D980BdE3da29058c6C0b7129c8E60F8c6e439b8", "0x4704759E4a426b29615e4841B092357460925eFf"]



CHAINS = [
    {
        "name": "Zircuit Mainnet",
        "chain_id": 48900,
        "rpc_url": "https://mainnet.zircuit.com",
    },
    {
        "name": "Metis Andromeda (Mainnet)",
        "chain_id": 1088,
        "rpc_url": "https://andromeda.metis.io/?owner=1088",
    },
        {
        "name": "Zircuit Garfield Testnet",
        "chain_id": 48898,
        "rpc_url": "https://garfield-testnet.zircuit.com",
    },
    {
        "name": "Hyperion (Testnet)",
        "chain_id": 133717,
        "rpc_url": "https://hyperion-testnet.metisdevops.link",
    }

]

# Solidity compiler version
SOLC_VERSION = "0.8.20"

# =============================================================================
# CONTRACT SOURCE CODE
# =============================================================================

def get_contract_sources():
    """Load contract source files from disk."""
    import os
    base_path = os.path.dirname(os.path.abspath(__file__))

    sources = {}
    # ONLY use flattened files - these have all dependencies inlined
    contract_files = [
        "LazaiTradingWallet_flattened.sol",
        "LazaiTradingFactory_flattened.sol",
    ]
    
    for filename in contract_files:
        filepath = os.path.join(base_path, filename)
        try:
            with open(filepath, "r") as f:
                sources[filename] = {"content": f.read()}
        except FileNotFoundError:
            print(f"  ERROR: Could not find {filename}")
            print(f"  Make sure the flattened files exist in: {base_path}")
            continue

    if len(sources) < 2:
        raise FileNotFoundError(
            "Missing flattened contract files. "
            "Please ensure LazaiTradingWallet_flattened.sol and "
            "LazaiTradingFactory_flattened.sol exist in the deployer directory."
        )

    return sources


def compile_contracts():
    """Compile Solidity contracts."""
    print(f"Installing Solidity compiler {SOLC_VERSION}...")
    install_solc(SOLC_VERSION)

    print("Compiling contracts...")
    sources = get_contract_sources()
    
    print(f"  Loaded {len(sources)} source files:")
    for filename in sources.keys():
        print(f"    - {filename}")

    print("Compiling flattened contracts...")

    compiled = compile_standard(
        {
            "language": "Solidity",
            "sources": sources,
            "settings": {
                "optimizer": {"enabled": True, "runs": 200},
                "outputSelection": {
                    "*": {
                        "*": ["abi", "metadata", "evm.bytecode", "evm.sourceMap"]
                    }
                },
            },
        },
        solc_version=SOLC_VERSION,
        allow_paths=["."],
    )

    return compiled


def get_contract_data(compiled, contract_name):
    """Extract ABI and bytecode for a contract."""
    for source_file, contracts in compiled["contracts"].items():
        if contract_name in contracts:
            contract = contracts[contract_name]
            return {
                "abi": contract["abi"],
                "bytecode": contract["evm"]["bytecode"]["object"],
            }
    
    # Print available contracts for debugging
    print(f"\nAvailable contracts in compiled output:")
    for source_file, contracts in compiled["contracts"].items():
        for contract_name_found in contracts.keys():
            print(f"  - {source_file}: {contract_name_found}")
    
    raise ValueError(f"Contract {contract_name} not found in compiled output")


# =============================================================================
# DEPLOYMENT FUNCTIONS
# =============================================================================

def estimate_gas_with_fallback(w3, tx, default_gas=3000000):
    """Try to estimate gas, fall back to default if it fails."""
    try:
        estimated = w3.eth.estimate_gas(tx)
        # Add 20% buffer
        return int(estimated * 1.2)
    except Exception as e:
        print(f"  Warning: Gas estimation failed: {e}")
        print(f"  Using default gas: {default_gas}")
        return default_gas


def get_revert_reason(w3, tx_hash):
    """Try to get the revert reason from a failed transaction."""
    try:
        tx = w3.eth.get_transaction(tx_hash)
        receipt = w3.eth.get_transaction_receipt(tx_hash)
        
        # Try to replay the transaction to get the revert reason
        try:
            w3.eth.call({
                'to': tx.get('to'),
                'from': tx['from'],
                'data': tx['input'],
                'value': tx.get('value', 0),
                'gas': tx['gas'],
            }, receipt['blockNumber'] - 1)
        except Exception as call_error:
            return str(call_error)
    except Exception as e:
        return f"Could not get revert reason: {e}"
    
    return "Unknown reason"


def deploy_factory_deployer(w3, account, contract_data):
    """Deploy FactoryDeployer contract."""
    contract = w3.eth.contract(
        abi=contract_data["abi"],
        bytecode=contract_data["bytecode"]
    )

    # Check bytecode size
    bytecode_size = len(contract_data["bytecode"]) // 2  # hex string to bytes
    print(f"  FactoryDeployer bytecode size: {bytecode_size} bytes")
    
    if bytecode_size > 24576:  # EIP-170 limit
        print(f"  WARNING: Bytecode exceeds 24KB limit! ({bytecode_size} > 24576)")

    # Get current gas price
    gas_price = w3.eth.gas_price
    print(f"  Gas price: {w3.from_wei(gas_price, 'gwei')} gwei")

    # Build transaction (without gas first for estimation)
    tx_params = {
        "from": account.address,
        "nonce": w3.eth.get_transaction_count(account.address),
        "gasPrice": gas_price,
    }

    # Try to estimate gas
    try:
        constructor_tx = contract.constructor(BOT_OPERATOR).build_transaction(tx_params)
        estimated_gas = w3.eth.estimate_gas(constructor_tx)
        gas_limit = int(estimated_gas * 1.2)  # 20% buffer
        print(f"  Estimated gas: {estimated_gas}, using: {gas_limit}")
    except Exception as e:
        print(f"  Gas estimation failed: {e}")
        gas_limit = 5000000
        print(f"  Using fallback gas limit: {gas_limit}")

    # Check if we have enough balance
    balance = w3.eth.get_balance(account.address)
    required = gas_limit * gas_price
    print(f"  Required balance: {w3.from_wei(required, 'ether')} ETH")
    
    if balance < required:
        raise Exception(f"Insufficient balance. Have: {w3.from_wei(balance, 'ether')} ETH, Need: {w3.from_wei(required, 'ether')} ETH")

    # Build final transaction
    tx = contract.constructor(BOT_OPERATOR).build_transaction({
        "from": account.address,
        "nonce": w3.eth.get_transaction_count(account.address),
        "gas": gas_limit,
        "gasPrice": gas_price,
    })

    # Sign and send
    signed_tx = account.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed_tx.raw_transaction)

    print(f"  Deploying FactoryDeployer... TX: {tx_hash.hex()}")
    
    # Wait for receipt with timeout
    try:
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=300)
    except Exception as e:
        print(f"  Timeout waiting for receipt: {e}")
        raise

    # Check status
    print(f"  Transaction status: {receipt['status']} (1=success, 0=failed)")
    print(f"  Gas used: {receipt['gasUsed']} / {gas_limit}")
    
    if receipt['gasUsed'] == gas_limit:
        print(f"  WARNING: All gas was consumed - likely out of gas error")

    if receipt["status"] != 1:
        # Try to get more details
        print(f"  Transaction failed!")
        print(f"  Block number: {receipt['blockNumber']}")
        print(f"  Transaction hash: {tx_hash.hex()}")
        
        # Try to get revert reason
        revert_reason = get_revert_reason(w3, tx_hash)
        print(f"  Revert reason: {revert_reason}")
        
        raise Exception(f"FactoryDeployer deployment failed. Reason: {revert_reason}")

    print(f"  Contract deployed at: {receipt['contractAddress']}")
    return receipt["contractAddress"]


def predict_factory_address(w3, deployer_address, deployer_abi):
    """Call predictFactoryAddress to get expected factory address."""
    deployer = w3.eth.contract(address=deployer_address, abi=deployer_abi)
    predicted = deployer.functions.predictFactoryAddress(
        BOT_OPERATOR,
        WHITELISTED_DEXES
    ).call()
    return predicted


def deploy_factory(w3, account, deployer_address, deployer_abi):
    """Deploy LazaiWalletFactory via FactoryDeployer."""
    deployer = w3.eth.contract(address=deployer_address, abi=deployer_abi)

    gas_price = w3.eth.gas_price

    # Try to estimate gas
    try:
        estimated_gas = deployer.functions.deployFactory(
            BOT_OPERATOR,
            WHITELISTED_DEXES
        ).estimate_gas({"from": account.address})
        gas_limit = int(estimated_gas * 1.2)
        print(f"  Estimated gas for factory deployment: {estimated_gas}, using: {gas_limit}")
    except Exception as e:
        print(f"  Gas estimation failed for factory deployment: {e}")
        gas_limit = 5000000
        print(f"  Using fallback gas limit: {gas_limit}")

    # Build transaction
    tx = deployer.functions.deployFactory(
        BOT_OPERATOR,
        WHITELISTED_DEXES
    ).build_transaction({
        "from": account.address,
        "nonce": w3.eth.get_transaction_count(account.address),
        "gas": gas_limit,
        "gasPrice": gas_price,
    })

    # Sign and send
    signed_tx = account.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed_tx.raw_transaction)

    print(f"  Deploying Factory via CREATE2... TX: {tx_hash.hex()}")
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=300)

    print(f"  Transaction status: {receipt['status']}")
    print(f"  Gas used: {receipt['gasUsed']} / {gas_limit}")

    if receipt["status"] != 1:
        revert_reason = get_revert_reason(w3, tx_hash)
        raise Exception(f"Factory deployment failed. Reason: {revert_reason}")

    # Parse FactoryDeployed event to get factory address
    factory_deployed_event = deployer.events.FactoryDeployed()
    logs = factory_deployed_event.process_receipt(receipt)

    if logs:
        return logs[0]["args"]["factory"]

    raise Exception("Could not find FactoryDeployed event in receipt")


# =============================================================================
# MAIN DEPLOYMENT FLOW
# =============================================================================

def deploy_to_chain(chain_config, compiled_contracts):
    """Deploy all contracts to a single chain."""
    print(f"\n{'='*60}")
    print(f"Deploying to {chain_config['name']} (Chain ID: {chain_config['chain_id']})")
    print(f"{'='*60}")

    # Connect to chain
    w3 = Web3(Web3.HTTPProvider(chain_config["rpc_url"]))
    if not w3.is_connected():
        raise Exception(f"Failed to connect to {chain_config['name']}")

    print(f"  Connected to {chain_config['name']}")
    
    # Check chain ID matches
    actual_chain_id = w3.eth.chain_id
    print(f"  Expected chain ID: {chain_config['chain_id']}, Actual: {actual_chain_id}")
    
    if actual_chain_id != chain_config['chain_id']:
        print(f"  WARNING: Chain ID mismatch!")

    # Setup account
    account = w3.eth.account.from_key(PRIVATE_KEY)
    balance = w3.eth.get_balance(account.address)
    print(f"  Deployer: {account.address}")
    print(f"  Balance: {w3.from_wei(balance, 'ether')} ETH")

    if balance == 0:
        raise Exception(f"No balance on {chain_config['name']}")

    # Get contract data
    deployer_data = get_contract_data(compiled_contracts, "FactoryDeployer")
    print(f"  FactoryDeployer ABI has {len(deployer_data['abi'])} entries")

    # Step 1: Deploy FactoryDeployer
    deployer_address = deploy_factory_deployer(w3, account, deployer_data)
    print(f"  FactoryDeployer deployed at: {deployer_address}")

    # Step 2: Predict factory address
    predicted_address = predict_factory_address(w3, deployer_address, deployer_data["abi"])
    print(f"  Predicted Factory address: {predicted_address}")

    # Step 3: Deploy Factory via CREATE2
    factory_address = deploy_factory(w3, account, deployer_address, deployer_data["abi"])
    print(f"  Factory deployed at: {factory_address}")

    # Verify prediction matched
    if predicted_address.lower() != factory_address.lower():
        raise Exception(f"Address mismatch! Predicted: {predicted_address}, Actual: {factory_address}")

    print(f"  ✓ Prediction verified!")

    return {
        "chain": chain_config["name"],
        "chain_id": chain_config["chain_id"],
        "deployer_address": deployer_address,
        "factory_address": factory_address,
    }


def main():
    """Main deployment function."""
    print("="*60)
    print("DETERMINISTIC CROSS-CHAIN FACTORY DEPLOYMENT")
    print("="*60)
    print(f"\nBot Operator: {BOT_OPERATOR}")
    print(f"Whitelisted DEXes: {WHITELISTED_DEXES}")
    print(f"Chains: {[c['name'] for c in CHAINS]}")

    # Validate configuration
    if PRIVATE_KEY == "your_private_key_here":
        print("\nERROR: Please update PRIVATE_KEY in the configuration")
        return

    if BOT_OPERATOR == "0x1234567890123456789012345678901234567890":
        print("\nERROR: Please update BOT_OPERATOR in the configuration")
        return

    # Compile contracts
    compiled = compile_contracts()
    print("Contracts compiled successfully!")
    
    # Print available contracts
    print("\nCompiled contracts:")
    for source_file, contracts in compiled["contracts"].items():
        for contract_name in contracts.keys():
            bytecode_len = len(contracts[contract_name]["evm"]["bytecode"]["object"]) // 2
            print(f"  - {contract_name} ({bytecode_len} bytes)")

    # Deploy to each chain
    results = []
    for chain in CHAINS:
        try:
            result = deploy_to_chain(chain, compiled)
            results.append(result)
        except Exception as e:
            print(f"\nERROR deploying to {chain['name']}: {e}")
            traceback.print_exc()
            results.append({
                "chain": chain["name"],
                "chain_id": chain["chain_id"],
                "error": str(e),
            })

        # Small delay between chains
        time.sleep(2)

    # Print summary
    print("\n" + "="*60)
    print("DEPLOYMENT SUMMARY")
    print("="*60)

    factory_addresses = set()
    for result in results:
        print(f"\n{result['chain']} (Chain ID: {result['chain_id']}):")
        if "error" in result:
            print(f"  ERROR: {result['error']}")
        else:
            print(f"  FactoryDeployer: {result['deployer_address']}")
            print(f"  Factory: {result['factory_address']}")
            factory_addresses.add(result["factory_address"].lower())

    # Verify all factory addresses match
    print("\n" + "="*60)
    if len(factory_addresses) == 1:
        print("SUCCESS! All factory addresses match across chains!")
        print(f"Universal Factory Address: {list(factory_addresses)[0]}")
    elif len(factory_addresses) > 1:
        print("WARNING: Factory addresses do not match across chains!")
        print("This may indicate different parameters were used.")
    print("="*60)

    # Save results to file
    output_file = "deployment_results.json"
    with open(output_file, "w") as f:
        json.dump({
            "bot_operator": BOT_OPERATOR,
            "whitelisted_dexes": WHITELISTED_DEXES,
            "deployments": results,
        }, f, indent=2)
    print(f"\nResults saved to {output_file}")


if __name__ == "__main__":
    main()