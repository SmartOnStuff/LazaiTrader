/**
 * LazaiTrader Balance Worker - Cloudflare Worker
 * Fetches Smart Contract Wallet balances from blockchain
 * Saves to UserBalances table for reference
 *
 * Input: { userId, scwAddress }
 * Output: { success, balances, error }
 */

import { ethers } from 'ethers';
import { getTokenPriceUSDC, normalizeTokenSymbol } from '../shared/priceHelper.js';

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

      if (!userId || !scwAddress) {
        console.log('[balance] Missing parameters');
        return jsonResponse({
          success: false,
          error: 'Missing required parameters',
          errorCode: 'INVALID_INPUT'
        }, 400);
      }

      userId = parseInt(userId);
      console.log(`[balance] Fetching balances for user ${userId}, SCW: ${scwAddress}`);

      // Get all active chains
      const chains = await env.DB.prepare(
        'SELECT ChainID, ChainName, RPCEndpoint FROM Chains WHERE IsActive = 1 ORDER BY ChainID'
      ).all();

      if (!chains.results || chains.results.length === 0) {
        console.log('[balance] No active chains');
        return jsonResponse({
          success: false,
          error: 'No active chains configured',
          errorCode: 'NO_CHAINS'
        }, 500);
      }

      const balances = {};

      for (const chain of chains.results) {
        console.log(`[balance] Chain: ${chain.ChainName}`);

        // Get tokens for this chain
        const tokens = await env.DB.prepare(
          'SELECT TokenID, Symbol, TokenAddress, Decimals FROM Tokens WHERE ChainID = ? AND IsActive = 1 ORDER BY Symbol'
        ).bind(chain.ChainID).all();

        if (!tokens.results || tokens.results.length === 0) {
          console.log(`[balance] No tokens for chain ${chain.ChainID}`);
          continue;
        }

        balances[chain.ChainID] = {
          chainName: chain.ChainName,
          chainId: chain.ChainID,
          tokens: []
        };

        const provider = new ethers.JsonRpcProvider(chain.RPCEndpoint);

        for (const token of tokens.results) {
          try {
            const tokenContract = new ethers.Contract(
              token.TokenAddress,
              ERC20_ABI,
              provider
            );

            const balance = await tokenContract.balanceOf(scwAddress);
            const balanceFormatted = ethers.formatUnits(balance, token.Decimals);

            // Get token price in USDC (real-time, no delay)
            let priceUSDC = null;
            let balanceUSDC = null;

            // Normalize symbol to handle variants (M.USDC, GUSDC, etc.)
            const normalizedSymbol = normalizeTokenSymbol(token.Symbol);

            if (normalizedSymbol !== 'USDC') {
              const priceData = await getTokenPriceUSDC(env.DB, token.Symbol, 'USDC', 5);
              if (priceData) {
                priceUSDC = priceData.price;
                balanceUSDC = parseFloat(balanceFormatted) * priceUSDC;
              }
            } else {
              // USDC variants (USDC, M.USDC, GUSDC) - price is always 1
              priceUSDC = 1.0;
              balanceUSDC = parseFloat(balanceFormatted);
            }

            console.log(`[balance] ${token.Symbol}: ${balanceFormatted} ($${balanceUSDC ? balanceUSDC.toFixed(2) : 'N/A'})`);

            balances[chain.ChainID].tokens.push({
              symbol: token.Symbol,
              tokenAddress: token.TokenAddress,
              balance: balance.toString(),
              balanceFormatted: balanceFormatted,
              balanceUSDC: balanceUSDC,
              decimals: token.Decimals,
              tokenId: token.TokenID
            });

            // Save to UserBalances table (creates new row for historical tracking)
            try {
              await env.DB.prepare(
                `INSERT INTO UserBalances (UserID, TokenID, Balance, BalanceUSDC, PriceUSDC, CreatedAt)
                 VALUES (?, ?, ?, ?, ?, datetime('now'))`
              ).bind(userId, token.TokenID, parseFloat(balanceFormatted), balanceUSDC, priceUSDC).run();
            } catch (dbError) {
              console.error(`[balance] DB error for ${token.Symbol}:`, dbError.message);
            }

          } catch (tokenError) {
            console.error(`[balance] Error fetching ${token.Symbol}:`, tokenError.message);
            balances[chain.ChainID].tokens.push({
              symbol: token.Symbol,
              tokenAddress: token.TokenAddress,
              balance: '0',
              balanceFormatted: '0',
              decimals: token.Decimals,
              error: 'Could not fetch',
              tokenId: token.TokenID
            });
          }
        }
      }

      console.log('[balance] ✅ Complete');

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

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}