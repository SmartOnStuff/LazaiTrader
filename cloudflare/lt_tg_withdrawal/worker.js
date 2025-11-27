/**
 * LazaiTrader Withdrawal Worker - Cloudflare Worker
 * Pure blockchain backend for SCW withdrawal operations
 * 
 * Responsibilities:
 * - Initiate withdrawal from Smart Contract Wallet
 * - Execute token transfers from SCW to user's EOA (calls withdrawAll on SCW)
 * - Return structured responses (success/error)
 * - NO Telegram interaction
 * 
 * Input format:
 * {
 *   userId: number,
 *   userWallet: string (0x... EOA to receive funds),
 *   scwAddress: string (0x... Smart Contract Wallet),
 *   chainId: number,
 *   rpcUrl: string
 * }
 * 
 * Output format:
 * {
 *   success: boolean,
 *   txHash?: string,
 *   error?: string,
 *   errorCode?: string
 * }
 */

import { ethers } from 'ethers';

// SCW Contract ABI - only the functions we need
const SCW_ABI = [
  {
    inputs: [
      { name: '_token', type: 'address' }
    ],
    name: 'withdrawAll',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [],
    name: 'withdrawAllNative',
    outputs: [],
    stateMutability: 'nonpayable',
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
      let { userId, userWallet, scwAddress, chainId, rpcUrl } = payload;

      // Validate input
      if (!userId || !userWallet || !scwAddress || !chainId || !rpcUrl) {
        console.log('[withdrawal] Missing required parameters:', {
          userId, userWallet, scwAddress, chainId, rpcUrl
        });
        return jsonResponse({
          success: false,
          error: 'Missing required parameters',
          errorCode: 'INVALID_INPUT'
        }, 400);
      }

      // Convert types
      userId = parseInt(userId);
      chainId = parseInt(chainId);

      console.log(`[withdrawal] Processing withdrawal for userId: ${userId}, SCW: ${scwAddress}, Chain: ${chainId}`);

      // Get bot private key for executing withdrawal
      const botPrivateKey = env.BOT_PRIVATE_KEY;
      if (!botPrivateKey) {
        console.error('BOT_PRIVATE_KEY not configured');
        return jsonResponse({
          success: false,
          error: 'Service configuration error',
          errorCode: 'CONFIG_ERROR'
        }, 500);
      }

      // Initialize provider and signer
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const signer = new ethers.Wallet(botPrivateKey, provider);

      console.log(`[withdrawal] Connected to chain ${chainId}, bot account: ${signer.address}`);

      // Create SCW contract instance
      const scwContract = new ethers.Contract(scwAddress, SCW_ABI, signer);

      // Execute withdrawAll (no parameters needed - withdraws everything to owner)
      console.log(`[withdrawal] Executing withdrawAll on SCW for all tokens and native balance`);
      const tx = await scwContract.withdrawAll(ethers.ZeroAddress); // address(0) = skip token withdrawal, withdraw all native
      
      console.log(`[withdrawal] Transaction sent: ${tx.hash}`);

      // Wait for transaction confirmation (5 minute timeout)
      console.log(`[withdrawal] Waiting for confirmation...`);
      const receipt = await waitForTransaction(provider, tx.hash, 300000);

      if (!receipt) {
        console.error('[withdrawal] Transaction timeout');
        return jsonResponse({
          success: false,
          error: 'Withdrawal transaction timeout',
          errorCode: 'TX_TIMEOUT'
        }, 500);
      }

      if (receipt.status !== 1) {
        console.error(`[withdrawal] Transaction failed with status ${receipt.status}`);
        return jsonResponse({
          success: false,
          error: 'Withdrawal transaction failed',
          errorCode: 'TX_FAILED'
        }, 500);
      }

      console.log(`[withdrawal] ✅ Withdrawal successful: ${tx.hash}`);

      // Store withdrawal in database
      await storeWithdrawalInDatabase(userId, scwAddress, tx.hash, chainId, env);

      return jsonResponse({
        success: true,
        txHash: tx.hash,
        to: userWallet,
        chainId: chainId
      });

    } catch (error) {
      console.error('[withdrawal] Error:', error.message);
      return jsonResponse({
        success: false,
        error: error.message,
        errorCode: 'INTERNAL_ERROR'
      }, 500);
    }
  }
};

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
    console.error('[waitForTransaction] Error:', error.message);
    return null;
  }
}

/**
 * Store withdrawal record in database
 */
async function storeWithdrawalInDatabase(userId, scwAddress, txHash, chainId, env) {
  try {
    console.log(`[storeWithdrawalInDatabase] Recording withdrawal for user ${userId}`);
    
    // Get user wallet
    const user = await env.DB.prepare(
      'SELECT UserWallet FROM Users WHERE UserID = ?'
    ).bind(userId).first();

    if (!user) {
      console.error('[storeWithdrawalInDatabase] User not found:', userId);
      return;
    }

    // Insert withdrawal record (single record for all tokens on chain)
    await env.DB.prepare(
      `INSERT INTO Withdrawals (UserID, SCWAddress, TokenID, TokenAddress, Amount, RecipientAddress, TxHash, ChainID, Status, WithdrawnAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', datetime('now'))`
    ).bind(userId, scwAddress, null, null, null, user.UserWallet, txHash, chainId).run();

    console.log(`[storeWithdrawalInDatabase] ✓ Withdrawal recorded: ${txHash}`);
  } catch (error) {
    console.error('[storeWithdrawalInDatabase] Error:', error);
    // Don't throw - withdrawal was successful, just logging failed
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