/**
 * LazaiTrader Deposit Worker - Cloudflare Worker
 * Pure blockchain backend for Smart Contract Wallet deployment
 * 
 * Responsibilities:
 * - Deploy SCW on blockchain
 * - Retrieve existing SCW addresses
 * - Return structured responses (success/error)
 * - NO Telegram interaction
 * 
 * Input format:
 * {
 *   userId: number,
 *   userWallet: string (0x...),
 *   chainId: number,
 *   rpcUrl: string
 * }
 * 
 * Output format:
 * {
 *   success: boolean,
 *   scwAddress?: string,
 *   error?: string,
 *   errorCode?: string
 * }
 */

import { ethers } from 'ethers';

// Factory Contract ABI
const FACTORY_ABI = [
  {
    inputs: [{ name: '_owner', type: 'address' }],
    name: 'createWallet',
    outputs: [{ name: 'wallet', type: 'address' }],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [{ name: '_user', type: 'address' }],
    name: 'userWallets',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ name: '_user', type: 'address' }],
    name: 'hasWallet',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function'
  }
];

export default {
  async fetch(request, env) {
    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405);
    }

    try {
      const payload = await request.json();
      let { userId, userWallet, chainId, rpcUrl } = payload;

      // Validate input
      if (!userId || !userWallet || !chainId || !rpcUrl) {
        return jsonResponse({
          success: false,
          error: 'Missing required parameters',
          errorCode: 'INVALID_INPUT'
        }, 400);
      }

      // Convert to correct types
      userId = parseInt(userId);
      chainId = parseInt(chainId);

      console.log(`[deposit] Deploying SCW for userId: ${userId}, chainId: ${chainId}`);

      if (isNaN(userId) || isNaN(chainId)) {
        return jsonResponse({
          success: false,
          error: 'userId and chainId must be numbers',
          errorCode: 'INVALID_INPUT'
        }, 400);
      }

      // Get secrets from environment (worker-level secrets)
      const botPrivateKey = env.BOT_PRIVATE_KEY;
      const factoryContractAddress = env.FACTORY_CONTRACT_ADDRESS_HYPERION;

      if (!botPrivateKey || !factoryContractAddress) {
        console.error('Missing blockchain configuration');
        console.error('BOT_PRIVATE_KEY:', botPrivateKey ? 'SET' : 'MISSING');
        console.error('FACTORY_CONTRACT_ADDRESS_HYPERION:', factoryContractAddress ? 'SET' : 'MISSING');
        return jsonResponse({
          success: false,
          error: 'Service configuration error',
          errorCode: 'CONFIG_ERROR'
        }, 500);
      }

      // Check existing SCW in database
      const existingScw = await getExistingSCW(userId, chainId, env);
      if (existingScw) {
        return jsonResponse({
          success: true,
          scwAddress: existingScw,
          isNew: false
        });
      }

      // Deploy new SCW
      let scwAddress = await deploySCW(
        userWallet,
        factoryContractAddress,
        botPrivateKey,
        rpcUrl,
        chainId
      );

      if (!scwAddress) {
        // Retry once
        console.log('🔄 First deployment attempt failed, retrying...');
        await new Promise(resolve => setTimeout(resolve, 2000));

        scwAddress = await deploySCW(
          userWallet,
          factoryContractAddress,
          botPrivateKey,
          rpcUrl,
          chainId
        );

        if (!scwAddress) {
          return jsonResponse({
            success: false,
            error: 'Failed to deploy Smart Contract Wallet after 2 attempts',
            errorCode: 'DEPLOYMENT_FAILED'
          }, 500);
        }
      }

      // Store in database
      await storeSCWInDatabase(userId, chainId, scwAddress, env);

      return jsonResponse({
        success: true,
        scwAddress: scwAddress,
        isNew: true
      });

    } catch (error) {
      console.error('Deposit worker error:', error);
      return jsonResponse({
        success: false,
        error: error.message,
        errorCode: 'INTERNAL_ERROR'
      }, 500);
    }
  }
};

/**
 * Check if SCW already exists in database
 */
async function getExistingSCW(userId, chainId, env) {
  try {
    console.log(`[getExistingSCW] Checking for SCW: userId=${userId} (${typeof userId}), chainId=${chainId} (${typeof chainId})`);
    
    const result = await env.DB.prepare(
      'SELECT SCWAddress FROM SCWDeployments WHERE UserID = ? AND ChainID = ?'
    ).bind(userId, chainId).first();

    console.log(`[getExistingSCW] Query result:`, result);
    return result?.SCWAddress || null;
  } catch (error) {
    console.error('Error checking existing SCW:', error);
    return null;
  }
}

/**
 * Deploy Smart Contract Wallet on blockchain
 */
async function deploySCW(userWallet, factoryAddress, botPrivateKey, rpcUrl, chainId) {
  try {
    console.log(`🚀 Deploying SCW for user on chain ${chainId}`);

    // Initialize ethers.js
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const signer = new ethers.Wallet(botPrivateKey, provider);

    console.log(`✓ Connected to RPC`);
    console.log(`✓ Bot account: ${signer.address}`);

    // Initialize factory contract
    const factoryContract = new ethers.Contract(
      factoryAddress,
      FACTORY_ABI,
      signer
    );

    // Check if wallet already exists on-chain
    const hasWallet = await factoryContract.hasWallet(userWallet);

    if (hasWallet) {
      const existingWallet = await factoryContract.userWallets(userWallet);
      console.log(`✓ SCW already exists on-chain: ${existingWallet}`);
      return existingWallet;
    }

    // Deploy new SCW
    console.log('📝 Creating transaction...');
    const tx = await factoryContract.createWallet(userWallet);
    console.log(`✓ Transaction sent: ${tx.hash}`);

    // Wait for transaction (5 minute timeout)
    console.log('⏳ Waiting for confirmation (max 5 minutes)...');
    const receipt = await waitForTransaction(provider, tx.hash, 300000);

    if (!receipt) {
      console.error('❌ Transaction timeout');
      return null;
    }

    if (receipt.status !== 1) {
      console.error(`❌ Transaction failed with status ${receipt.status}`);
      return null;
    }

    console.log(`✓ Transaction confirmed: ${tx.hash}`);

    // Get deployed SCW address
    const scwAddress = await factoryContract.userWallets(userWallet);

    if (!scwAddress || scwAddress === '0x0000000000000000000000000000000000000000') {
      console.error('❌ Failed to retrieve SCW address');
      return null;
    }

    console.log(`✅ SCW deployed successfully: ${scwAddress}`);
    return scwAddress;

  } catch (error) {
    console.error('❌ SCW deployment error:', error.message);
    return null;
  }
}

/**
 * Wait for transaction with timeout
 */
async function waitForTransaction(provider, txHash, timeoutMs = 300000) {
  try {
    return await Promise.race([
      provider.waitForTransaction(txHash),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), timeoutMs)
      )
    ]);
  } catch (error) {
    console.error('Transaction wait error:', error.message);
    return null;
  }
}

/**
 * Store SCW in database
 */
async function storeSCWInDatabase(userId, chainId, scwAddress, env) {
  try {
    // Update Users table
    await env.DB.prepare(
      'UPDATE Users SET SCWAddress = ? WHERE UserID = ?'
    ).bind(scwAddress, userId).run();

    // Insert into SCWDeployments
    await env.DB.prepare(
      `INSERT INTO SCWDeployments (UserID, ChainID, SCWAddress, DeploymentStatus, DeployedAt) 
       VALUES (?, ?, ?, 'success', datetime('now'))`
    ).bind(userId, chainId, scwAddress).run();

    console.log(`✓ SCW stored in database for user ${userId}`);
  } catch (error) {
    console.error('Error storing SCW in database:', error);
    // Don't throw - SCW was deployed successfully, just DB logging failed
  }
}

/**
 * Helper: Return JSON response
 */
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}