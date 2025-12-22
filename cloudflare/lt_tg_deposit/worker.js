/**
 * LazaiTrader Deposit Worker - Cloudflare Worker
 * Pure blockchain backend for Smart Contract Wallet deployment
 * 
 * Deploys SCW on ALL supported chains using deterministic CREATE2
 * Same factory address + same SCW address across all chains
 * 
 * Input format:
 * {
 *   userId: number,
 *   userWallet: string (0x...)
 * }
 * 
 * Output format:
 * {
 *   success: boolean,
 *   scwAddress?: string,
 *   deployments?: [{ chainId, chainName, status, txHash?, error? }],
 *   error?: string,
 *   errorCode?: string
 * }
 */

import { ethers } from 'ethers';

// Factory Contract ABI (same on all chains)
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
      let { userId, userWallet } = payload;

      // Validate input
      if (!userId || !userWallet) {
        return jsonResponse({
          success: false,
          error: 'Missing required parameters: userId, userWallet',
          errorCode: 'INVALID_INPUT'
        }, 400);
      }

      // Convert to correct types
      userId = parseInt(userId);

      if (isNaN(userId)) {
        return jsonResponse({
          success: false,
          error: 'userId must be a number',
          errorCode: 'INVALID_INPUT'
        }, 400);
      }

      console.log(`[deposit] Deploying SCW for userId: ${userId}, wallet: ${userWallet}`);

      // Get secrets from environment
      const botPrivateKey = env.BOT_PRIVATE_KEY;
      const factoryAddress = env.FACTORY_CONTRACT_ADDRESS; // Same on all chains

      if (!botPrivateKey || !factoryAddress) {
        console.error('Missing blockchain configuration');
        return jsonResponse({
          success: false,
          error: 'Service configuration error',
          errorCode: 'CONFIG_ERROR'
        }, 500);
      }

      // Get all supported chains from database
      const chains = await getSupportedChains(env);
      
      if (!chains || chains.length === 0) {
        return jsonResponse({
          success: false,
          error: 'No supported chains configured',
          errorCode: 'CONFIG_ERROR'
        }, 500);
      }

      console.log(`[deposit] Found ${chains.length} supported chains`);

      // Check if user already has SCW in Users table
      const existingScw = await getExistingSCW(userId, env);
      
      if (existingScw) {
        console.log(`[deposit] User already has SCW: ${existingScw} - returning existing`);
        
        // User already has SCW, just return it - no deployment needed
        return jsonResponse({
          success: true,
          scwAddress: existingScw,
          isNew: false,
          message: 'SCW already exists',
          deployments: chains.map(c => ({
            chainId: c.ChainID,
            chainName: c.ChainName,
            status: 'already_deployed'
          }))
        });
      }
      
      // Only reach here if user has NO SCW yet
      // New user - deploy on all chains
      const results = await deployOnChains(
        userWallet,
        factoryAddress,
        botPrivateKey,
        chains,
        env
      );

      // Get SCW address from first successful deployment
      const successfulDeployment = results.find(r => r.status === 'deployed' || r.status === 'already_exists');
      
      if (!successfulDeployment || !successfulDeployment.scwAddress) {
        return jsonResponse({
          success: false,
          error: 'Failed to deploy SCW on any chain',
          errorCode: 'DEPLOYMENT_FAILED',
          deployments: results
        }, 500);
      }

      const scwAddress = successfulDeployment.scwAddress;

      // Update user record with SCW address
      await updateUserSCW(userId, scwAddress, env);

      // Store all successful deployments
      for (const result of results) {
        if (result.status === 'deployed' || result.status === 'already_exists') {
          await storeSCWDeployment(userId, result.chainId, scwAddress, result.txHash, env);
        }
      }

      const allSuccessful = results.every(r => r.status === 'deployed' || r.status === 'already_exists');

      return jsonResponse({
        success: true,
        scwAddress: scwAddress,
        isNew: true,
        deployments: results,
        message: allSuccessful 
          ? `SCW deployed on all ${chains.length} chains` 
          : `SCW deployed on ${results.filter(r => r.status !== 'failed').length}/${chains.length} chains`
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
 * Get all supported chains from database
 */
async function getSupportedChains(env) {
  try {
    const result = await env.DB.prepare(
      'SELECT ChainID, ChainName, RPCEndpoint FROM Chains WHERE IsActive = 1'
    ).all();
    
    return result.results || [];
  } catch (error) {
    console.error('Error fetching chains:', error);
    return [];
  }
}

/**
 * Check if SCW already exists for user
 */
async function getExistingSCW(userId, env) {
  try {
    const result = await env.DB.prepare(
      'SELECT SCWAddress FROM Users WHERE UserID = ?'
    ).bind(userId).first();

    return result?.SCWAddress || null;
  } catch (error) {
    console.error('Error checking existing SCW:', error);
    return null;
  }
}

/**
 * Get list of chains where SCW is already deployed
 */
async function getDeployedChains(userId, env) {
  try {
    const result = await env.DB.prepare(
      'SELECT ChainID FROM SCWDeployments WHERE UserID = ? AND DeploymentStatus = ?'
    ).bind(userId, 'success').all();

    return result.results?.map(r => r.ChainID) || [];
  } catch (error) {
    console.error('Error fetching deployed chains:', error);
    return [];
  }
}

/**
 * Deploy SCW on multiple chains (parallel with concurrency limit)
 */
async function deployOnChains(userWallet, factoryAddress, botPrivateKey, chains, env) {
  const results = [];

  // Deploy in batches of 2 to avoid overwhelming RPC nodes and worker timeouts
  const batchSize = 2;

  console.log(`[deployOnChains] Processing ${chains.length} chains in batches of ${batchSize}`);

  for (let i = 0; i < chains.length; i += batchSize) {
    const batch = chains.slice(i, i + batchSize);
    console.log(`[deployOnChains] Batch ${Math.floor(i / batchSize) + 1}: ${batch.map(c => c.ChainName).join(', ')}`);

    const batchResults = await Promise.all(
      batch.map(chain => deploySCWOnChain(
        userWallet,
        factoryAddress,
        botPrivateKey,
        chain
      ))
    );

    results.push(...batchResults);

    // Small delay between batches to avoid rate limiting
    if (i + batchSize < chains.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  console.log(`[deployOnChains] Completed. Success: ${results.filter(r => r.status !== 'failed').length}, Failed: ${results.filter(r => r.status === 'failed').length}`);

  return results;
}

/**
 * Deploy SCW on a single chain with retry logic
 */
async function deploySCWOnChain(userWallet, factoryAddress, botPrivateKey, chain, retryCount = 0) {
  const { ChainID: chainId, ChainName: chainName, RPCEndpoint: rpcUrl } = chain;
  const maxRetries = 2;

  try {
    console.log(`🚀 [${chainName}] Deploying SCW... (attempt ${retryCount + 1}/${maxRetries + 1})`);

    // Add timeout to provider creation
    const provider = new ethers.JsonRpcProvider(rpcUrl, undefined, {
      staticNetwork: true // Prevent network detection calls
    });

    const signer = new ethers.Wallet(botPrivateKey, provider);

    const factoryContract = new ethers.Contract(
      factoryAddress,
      FACTORY_ABI,
      signer
    );

    // Check if wallet already exists on-chain with timeout
    console.log(`🔍 [${chainName}] Checking if wallet exists...`);
    const hasWallet = await Promise.race([
      factoryContract.hasWallet(userWallet),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout checking wallet existence')), 10000))
    ]);

    if (hasWallet) {
      const existingWallet = await Promise.race([
        factoryContract.userWallets(userWallet),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout getting wallet address')), 10000))
      ]);
      console.log(`✓ [${chainName}] SCW already exists: ${existingWallet}`);
      return {
        chainId,
        chainName,
        status: 'already_exists',
        scwAddress: existingWallet
      };
    }

    // Deploy new SCW
    console.log(`📝 [${chainName}] Creating wallet...`);
    const tx = await Promise.race([
      factoryContract.createWallet(userWallet),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout sending transaction')), 30000))
    ]);
    console.log(`✓ [${chainName}] TX sent: ${tx.hash}`);

    // Wait for confirmation with extended timeout
    const receipt = await waitForTransaction(provider, tx.hash, 180000); // 3 minutes

    if (!receipt || receipt.status !== 1) {
      console.error(`❌ [${chainName}] Transaction failed or timed out`);
      return {
        chainId,
        chainName,
        status: 'failed',
        error: 'Transaction failed or timeout',
        txHash: tx.hash
      };
    }

    // Get deployed SCW address
    const scwAddress = await Promise.race([
      factoryContract.userWallets(userWallet),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout getting deployed address')), 10000))
    ]);

    if (!scwAddress || scwAddress === ethers.ZeroAddress) {
      console.error(`❌ [${chainName}] Failed to retrieve SCW address`);
      return {
        chainId,
        chainName,
        status: 'failed',
        error: 'Failed to retrieve SCW address',
        txHash: tx.hash
      };
    }

    console.log(`✅ [${chainName}] SCW deployed: ${scwAddress}`);
    return {
      chainId,
      chainName,
      status: 'deployed',
      scwAddress,
      txHash: tx.hash
    };

  } catch (error) {
    console.error(`❌ [${chainName}] Deployment error (attempt ${retryCount + 1}):`, error.message);

    // Retry on specific errors
    if (retryCount < maxRetries && (
      error.message.includes('Timeout') ||
      error.message.includes('network') ||
      error.message.includes('connection') ||
      error.message.includes('ETIMEDOUT') ||
      error.message.includes('ECONNREFUSED')
    )) {
      console.log(`🔄 [${chainName}] Retrying in 2 seconds...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      return deploySCWOnChain(userWallet, factoryAddress, botPrivateKey, chain, retryCount + 1);
    }

    return {
      chainId,
      chainName,
      status: 'failed',
      error: error.message,
      errorDetail: error.stack
    };
  }
}

/**
 * Wait for transaction with timeout
 */
async function waitForTransaction(provider, txHash, timeoutMs = 120000) {
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
 * Update user's SCW address in Users table
 */
async function updateUserSCW(userId, scwAddress, env) {
  try {
    await env.DB.prepare(
      'UPDATE Users SET SCWAddress = ?, UpdatedAt = datetime(\'now\') WHERE UserID = ?'
    ).bind(scwAddress, userId).run();
    
    console.log(`✓ Updated user ${userId} SCW: ${scwAddress}`);
  } catch (error) {
    console.error('Error updating user SCW:', error);
  }
}

/**
 * Store SCW deployment record
 */
async function storeSCWDeployment(userId, chainId, scwAddress, txHash, env) {
  try {
    await env.DB.prepare(
      `INSERT INTO SCWDeployments (UserID, ChainID, SCWAddress, TxHash, DeploymentStatus, DeployedAt) 
       VALUES (?, ?, ?, ?, 'success', datetime('now'))
       ON CONFLICT(UserID, ChainID) DO UPDATE SET
         SCWAddress = excluded.SCWAddress,
         TxHash = excluded.TxHash,
         DeploymentStatus = 'success',
         UpdatedAt = datetime('now')`
    ).bind(userId, chainId, scwAddress, txHash || null).run();

    console.log(`✓ Stored deployment for user ${userId} on chain ${chainId}`);
  } catch (error) {
    console.error('Error storing SCW deployment:', error);
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