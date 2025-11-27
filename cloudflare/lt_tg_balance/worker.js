/**
 * LazaiTrader Balance Worker - Cloudflare Worker
 * Fetches Smart Contract Wallet balances from blockchain
 * 
 * Responsibilities:
 * - Fetch token balances from SCW
 * - Group balances by blockchain chain
 * - Return formatted balance data
 * - NO Telegram interaction
 * 
 * Input format:
 * {
 *   userId: number,
 *   scwAddress: string (0x... Smart Contract Wallet)
 * }
 * 
 * Output format:
 * {
 *   success: boolean,
 *   balances?: {
 *     [chainId]: {
 *       chainName: string,
 *       chainId: number,
 *       tokens: [
 *         {
 *           symbol: string,
 *           tokenAddress: string,
 *           balance: string (in wei),
 *           balanceFormatted: string (human readable),
 *           decimals: number
 *         }
 *       ]
 *     }
 *   },
 *   error?: string,
 *   errorCode?: string
 * }
 */

import { ethers } from 'ethers';

// ERC20 Token ABI
const ERC20_ABI = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'symbol',
    outputs: [{ name: '', type: 'string' }],
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
      let { userId, scwAddress } = payload;

      // Validate input
      if (!userId || !scwAddress) {
        console.log('[balance] Missing required parameters:', { userId, scwAddress });
        return jsonResponse({
          success: false,
          error: 'Missing required parameters',
          errorCode: 'INVALID_INPUT'
        }, 400);
      }

      userId = parseInt(userId);

      console.log(`[balance] Fetching balances for userId: ${userId}, SCW: ${scwAddress}`);

      // Get all active chains and their tokens from database
      const chains = await env.DB.prepare(
        'SELECT ChainID, ChainName, RPCEndpoint FROM Chains WHERE IsActive = 1 ORDER BY ChainID'
      ).all();

      if (!chains.results || chains.results.length === 0) {
        console.log('[balance] No active chains found');
        return jsonResponse({
          success: false,
          error: 'No active chains configured',
          errorCode: 'NO_CHAINS'
        }, 500);
      }

      // Fetch tokens for each chain
      const balances = {};

      for (const chain of chains.results) {
        console.log(`[balance] Processing chain: ${chain.ChainName} (${chain.ChainID})`);

        // Get tokens for this chain
        const tokens = await env.DB.prepare(
          'SELECT TokenID, Symbol, TokenAddress, Decimals FROM Tokens WHERE ChainID = ? AND IsActive = 1 ORDER BY Symbol'
        ).bind(chain.ChainID).all();

        if (!tokens.results || tokens.results.length === 0) {
          console.log(`[balance] No tokens found for chain ${chain.ChainID}`);
          continue;
        }

        // Initialize chain balances
        balances[chain.ChainID] = {
          chainName: chain.ChainName,
          chainId: chain.ChainID,
          tokens: []
        };

        // Fetch balance for each token
        const provider = new ethers.JsonRpcProvider(chain.RPCEndpoint);

        for (const token of tokens.results) {
          try {
            const tokenContract = new ethers.Contract(
              token.TokenAddress,
              ERC20_ABI,
              provider
            );

            // Get balance
            const balance = await tokenContract.balanceOf(scwAddress);
            
            // Format balance
            const balanceFormatted = ethers.formatUnits(balance, token.Decimals);

            console.log(`[balance] ${token.Symbol}: ${balance.toString()} (${balanceFormatted})`);

            balances[chain.ChainID].tokens.push({
              symbol: token.Symbol,
              tokenAddress: token.TokenAddress,
              balance: balance.toString(),
              balanceFormatted: balanceFormatted,
              decimals: token.Decimals,
              tokenId: token.TokenID
            });

          } catch (tokenError) {
            console.error(`[balance] Error fetching ${token.Symbol} balance:`, tokenError.message);
            // Continue with other tokens
            balances[chain.ChainID].tokens.push({
              symbol: token.Symbol,
              tokenAddress: token.TokenAddress,
              balance: '0',
              balanceFormatted: '0',
              decimals: token.Decimals,
              error: 'Could not fetch balance',
              tokenId: token.TokenID
            });
          }
        }
      }

      console.log('[balance] ✅ Balance fetch complete');

      return jsonResponse({
        success: true,
        balances: balances,
        scwAddress: scwAddress
      });

    } catch (error) {
      console.error('[balance] Error:', error.message);
      return jsonResponse({
        success: false,
        error: error.message,
        errorCode: 'INTERNAL_ERROR'
      }, 500);
    }
  }
};

/**
 * Helper: Return JSON response
 */
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}