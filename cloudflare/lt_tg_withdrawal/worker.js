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

// SCW Contract ABI - Complete from LazaiTradingWallet contract
const SCW_ABI = [
  {
    inputs: [
      { internalType: 'address', name: '_token', type: 'address' }
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
  },
  {
    inputs: [
      { internalType: 'address', name: '_token', type: 'address' }
    ],
    name: 'withdrawAllTokens',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      { internalType: 'address', name: '_token', type: 'address' }
    ],
    name: 'getTokenBalance',
    outputs: [
      { internalType: 'uint256', name: 'balance', type: 'uint256' }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'getNativeBalance',
    outputs: [
      { internalType: 'uint256', name: 'balance', type: 'uint256' }
    ],
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
      let { userId, userWallet, scwAddress, tokenAddress, chainId, rpcUrl } = payload;

      // Validate input
      if (!userId || !userWallet || !scwAddress || chainId === undefined || !rpcUrl) {
        console.log('[withdrawal] Missing required parameters:', {
          userId, userWallet, scwAddress, tokenAddress, chainId, rpcUrl
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

      console.log(`[withdrawal] Processing withdrawal for userId: ${userId}, SCW: ${scwAddress}, Token: ${tokenAddress}, Chain: ${chainId}`);

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

      // Fetch balance BEFORE withdrawal to record the amount
      let withdrawnAmount = '0';
      try {
        if (tokenAddress === ethers.ZeroAddress) {
          // Get native balance
          const nativeBalance = await scwContract.getNativeBalance();
          withdrawnAmount = nativeBalance.toString();
          console.log(`[withdrawal] Native balance: ${withdrawnAmount}`);
        } else {
          // Get token balance
          const tokenBalance = await scwContract.getTokenBalance(tokenAddress);
          withdrawnAmount = tokenBalance.toString();
          console.log(`[withdrawal] Token balance: ${withdrawnAmount}`);
        }
      } catch (balanceError) {
        console.warn(`[withdrawal] Could not fetch balance: ${balanceError.message}`);
        // Continue anyway - we'll use '0' as placeholder
        withdrawnAmount = '0';
      }

      let tx;
      
      // Check if withdrawing native only or a specific token
      if (tokenAddress === ethers.ZeroAddress) {
        // Withdraw native balance only
        console.log(`[withdrawal] Executing withdrawAllNative on SCW`);
        try {
          tx = await scwContract.withdrawAllNative();
          console.log(`[withdrawal] withdrawAllNative transaction sent: ${tx.hash}`);
        } catch (contractError) {
          console.error('[withdrawal] withdrawAllNative failed:', contractError.message);
          return jsonResponse({
            success: false,
            error: `Failed to execute native withdrawal: ${contractError.message}`,
            errorCode: 'WITHDRAWAL_FAILED'
          }, 500);
        }
      } else {
        // Withdraw specific token (includes native in same tx with withdrawAll)
        console.log(`[withdrawal] Executing withdrawAll(${tokenAddress}) on SCW`);
        try {
          tx = await scwContract.withdrawAll(tokenAddress);
          console.log(`[withdrawal] withdrawAll(token) transaction sent: ${tx.hash}`);
        } catch (contractError) {
          console.error('[withdrawal] withdrawAll failed:', contractError.message);
          return jsonResponse({
            success: false,
            error: `Failed to execute withdrawal: ${contractError.message}`,
            errorCode: 'WITHDRAWAL_FAILED'
          }, 500);
        }
      }
      
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

      // Store withdrawal in database with actual amount
      await storeWithdrawalInDatabase(userId, scwAddress, tx.hash, tokenAddress, withdrawnAmount, chainId, env);

      return jsonResponse({
        success: true,
        txHash: tx.hash,
        to: userWallet,
        tokenAddress: tokenAddress,
        chainId: chainId,
        amount: withdrawnAmount
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
async function storeWithdrawalInDatabase(userId, scwAddress, txHash, tokenAddress, withdrawnAmount, chainId, env) {
  try {
    console.log(`[storeWithdrawalInDatabase] Recording withdrawal for user ${userId}, token: ${tokenAddress}, amount: ${withdrawnAmount}`);
    
    // Get user wallet
    const user = await env.DB.prepare(
      'SELECT UserWallet FROM Users WHERE UserID = ?'
    ).bind(userId).first();

    if (!user) {
      console.error('[storeWithdrawalInDatabase] User not found:', userId);
      return;
    }

    // Get token info if not native
    let tokenId = null;
    if (tokenAddress !== ethers.ZeroAddress) {
      const token = await env.DB.prepare(
        'SELECT TokenID FROM Tokens WHERE TokenAddress = ?'
      ).bind(tokenAddress).first();
      
      if (token) {
        tokenId = token.TokenID;
      }
    }

    // Insert withdrawal record with actual amount
    await env.DB.prepare(
      `INSERT INTO Withdrawals (UserID, SCWAddress, TokenID, TokenAddress, Amount, RecipientAddress, TxHash, ChainID, Status, WithdrawnAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', datetime('now'))`
    ).bind(
      userId, 
      scwAddress, 
      tokenId, 
      tokenAddress === ethers.ZeroAddress ? null : tokenAddress, 
      withdrawnAmount,
      user.UserWallet, 
      txHash, 
      chainId
    ).run();

    console.log(`[storeWithdrawalInDatabase] ✓ Withdrawal recorded: ${txHash} (${withdrawnAmount} wei)`);
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