/**
 * LazaiTrader Balance Tracker Worker (Scheduled)
 *
 * This worker runs on a schedule to:
 * 1. Check balances for all active users on all active chains/tokens
 * 2. Store balance snapshots with USDC values
 * 3. Detect deposits by comparing with previous snapshots
 * 4. Track deposits in DepositTransactions table
 *
 * Schedule: Every 5 minutes
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
  }
];

// ============================================
// BALANCE FETCHING UTILITIES
// ============================================

/**
 * Get all active users with SCW addresses
 */
async function getActiveUsers(db) {
  const result = await db.prepare(`
    SELECT UserID, Username, SCWAddress, UserWallet
    FROM Users
    WHERE IsActive = 1 AND SCWAddress IS NOT NULL
  `).all();

  return result.results || [];
}

/**
 * Get all active chains
 */
async function getActiveChains(db) {
  const result = await db.prepare(`
    SELECT ChainID, ChainName, RPCEndpoint
    FROM Chains
    WHERE IsActive = 1
    ORDER BY ChainID
  `).all();

  return result.results || [];
}

/**
 * Get all active tokens for a specific chain
 */
async function getActiveTokens(db, chainId) {
  const result = await db.prepare(`
    SELECT TokenID, Symbol, TokenAddress, Decimals
    FROM Tokens
    WHERE ChainID = ? AND IsActive = 1
    ORDER BY Symbol
  `).bind(chainId).all();

  return result.results || [];
}

/**
 * Fetch balance for a single token
 */
async function fetchTokenBalance(provider, tokenAddress, scwAddress, decimals) {
  try {
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    const balance = await tokenContract.balanceOf(scwAddress);
    const balanceFormatted = ethers.formatUnits(balance, decimals);
    return parseFloat(balanceFormatted);
  } catch (error) {
    console.error(`Error fetching balance for ${tokenAddress}:`, error.message);
    return 0;
  }
}

/**
 * Get the most recent balance entry for a user/token
 */
async function getPreviousSnapshot(db, userId, tokenId) {
  const result = await db.prepare(`
    SELECT Balance, BalanceUSDC, CreatedAt
    FROM UserBalances
    WHERE UserID = ? AND TokenID = ?
    ORDER BY CreatedAt DESC
    LIMIT 1
  `).bind(userId, tokenId).first();

  return result;
}

/**
 * Calculate balance changes from trades between two timestamps
 */
async function getTradeBalanceChanges(db, userId, tokenId, sinceTimestamp) {
  // Get all trades for this user and token since the timestamp
  const trades = await db.prepare(`
    SELECT
      t.Action,
      t.TokenSent,
      t.TokenReceived,
      t.QuantitySent,
      t.QuantityReceived,
      t.CreatedAt
    FROM Trades t
    WHERE t.UserID = ?
      AND (t.TokenSent = ? OR t.TokenReceived = ?)
      AND t.CreatedAt > ?
    ORDER BY t.CreatedAt ASC
  `).bind(userId, tokenId, tokenId, sinceTimestamp).all();

  let netChange = 0;

  for (const trade of (trades.results || [])) {
    if (trade.TokenReceived === tokenId) {
      // This token was received, add to balance
      netChange += trade.QuantityReceived;
    }
    if (trade.TokenSent === tokenId) {
      // This token was sent, subtract from balance
      netChange -= trade.QuantitySent;
    }
  }

  return netChange;
}

/**
 * Calculate balance changes from withdrawals between two timestamps
 */
async function getWithdrawalBalanceChanges(db, userId, tokenId, sinceTimestamp) {
  const withdrawals = await db.prepare(`
    SELECT Amount, AmountFormatted, Status, WithdrawnAt
    FROM Withdrawals
    WHERE UserID = ?
      AND TokenID = ?
      AND WithdrawnAt > ?
      AND Status = 'confirmed'
    ORDER BY WithdrawnAt ASC
  `).bind(userId, tokenId, sinceTimestamp).all();

  let totalWithdrawn = 0;

  for (const withdrawal of (withdrawals.results || [])) {
    // Use AmountFormatted if available, otherwise parse Amount
    const amount = withdrawal.AmountFormatted
      ? parseFloat(withdrawal.AmountFormatted)
      : parseFloat(withdrawal.Amount);

    if (!isNaN(amount)) {
      totalWithdrawn += amount;
    }
  }

  return totalWithdrawn;
}

/**
 * Detect if there's a deposit based on balance change vs trades/withdrawals
 */
async function detectAndRecordDeposit(db, userId, tokenId, chainId, scwAddress, currentBalance, previousSnapshot) {
  if (!previousSnapshot) {
    // First snapshot, no deposit detection
    return;
  }

  const previousBalance = previousSnapshot.Balance;
  const balanceChange = currentBalance - previousBalance;

  // If balance decreased or stayed the same, no deposit
  if (balanceChange <= 0) {
    return;
  }

  // Calculate expected balance change from trades and withdrawals
  const tradeChange = await getTradeBalanceChanges(db, userId, tokenId, previousSnapshot.CreatedAt);
  const withdrawalChange = await getWithdrawalBalanceChanges(db, userId, tokenId, previousSnapshot.CreatedAt);

  // Expected balance = previous + trades - withdrawals
  const expectedBalance = previousBalance + tradeChange - withdrawalChange;
  const unexplainedChange = currentBalance - expectedBalance;

  // If there's a significant unexplained increase (> 0.000001 to account for rounding)
  if (unexplainedChange > 0.000001) {
    console.log(`[DEPOSIT DETECTED] User ${userId}, Token ${tokenId}: +${unexplainedChange}`);

    // Get token details for logging
    const token = await db.prepare(`
      SELECT Symbol, TokenAddress FROM Tokens WHERE TokenID = ?
    `).bind(tokenId).first();

    // Record deposit in DepositTransactions
    try {
      await db.prepare(`
        INSERT INTO DepositTransactions (
          UserID, ChainID, SCWAddress, TokenAddress, Amount, Status, CreatedAt, ConfirmedAt
        ) VALUES (?, ?, ?, ?, ?, 'confirmed', datetime('now'), datetime('now'))
      `).bind(
        userId,
        chainId,
        scwAddress,
        token?.TokenAddress || 'unknown',
        unexplainedChange
      ).run();

      console.log(`[DEPOSIT RECORDED] ${unexplainedChange} ${token?.Symbol || 'tokens'} for user ${userId}`);
    } catch (error) {
      console.error(`[DEPOSIT ERROR] Failed to record deposit:`, error.message);
    }
  }
}

// ============================================
// MAIN WORKER LOGIC
// ============================================

/**
 * Process balance snapshots for all users
 */
async function processBalanceSnapshots(db) {
  const users = await getActiveUsers(db);
  const chains = await getActiveChains(db);

  if (users.length === 0) {
    console.log('No active users found');
    return { users: 0, snapshots: 0, deposits: 0 };
  }

  if (chains.length === 0) {
    console.log('No active chains found');
    return { users: 0, snapshots: 0, deposits: 0 };
  }

  let totalSnapshots = 0;
  let totalDeposits = 0;

  for (const user of users) {
    console.log(`Processing user ${user.UserID} (${user.Username || 'unknown'})`);

    for (const chain of chains) {
      const tokens = await getActiveTokens(db, chain.ChainID);

      if (tokens.length === 0) {
        continue;
      }

      // Create provider for this chain
      const provider = new ethers.JsonRpcProvider(chain.RPCEndpoint);

      for (const token of tokens) {
        try {
          // Fetch current balance from blockchain
          const currentBalance = await fetchTokenBalance(
            provider,
            token.TokenAddress,
            user.SCWAddress,
            token.Decimals
          );

          // Get previous snapshot
          const previousSnapshot = await getPreviousSnapshot(db, user.UserID, token.TokenID);

          // Get token price in USDC (uses ±5 min caching)
          let priceUSDC = null;
          let balanceUSDC = null;

          // Normalize symbol to handle variants (M.USDC, GUSDC, etc.)
          const normalizedSymbol = normalizeTokenSymbol(token.Symbol);

          if (normalizedSymbol !== 'USDC') {
            const priceData = await getTokenPriceUSDC(db, token.Symbol, 'USDC', 5);
            if (priceData) {
              priceUSDC = priceData.price;
              balanceUSDC = currentBalance * priceUSDC;
            }
          } else {
            // USDC variants (USDC, M.USDC, GUSDC) - price is always 1
            priceUSDC = 1.0;
            balanceUSDC = currentBalance;
          }

          // Insert into UserBalances (creates new row for historical tracking)
          await db.prepare(`
            INSERT INTO UserBalances (UserID, TokenID, Balance, BalanceUSDC, PriceUSDC, CreatedAt)
            VALUES (?, ?, ?, ?, ?, datetime('now'))
          `).bind(
            user.UserID,
            token.TokenID,
            currentBalance,
            balanceUSDC,
            priceUSDC
          ).run();

          totalSnapshots++;

          // Detect deposits
          await detectAndRecordDeposit(
            db,
            user.UserID,
            token.TokenID,
            chain.ChainID,
            user.SCWAddress,
            currentBalance,
            previousSnapshot
          );

        } catch (error) {
          console.error(`Error processing ${token.Symbol} for user ${user.UserID}:`, error.message);
        }
      }
    }
  }

  return {
    users: users.length,
    snapshots: totalSnapshots,
    deposits: totalDeposits
  };
}

// ============================================
// WORKER ENTRY POINTS
// ============================================

export default {
  /**
   * Scheduled handler - runs every 5 minutes
   */
  async scheduled(event, env, ctx) {
    console.log('=== Balance Tracker Started ===');
    console.log(`Trigger: ${event.cron}`);

    const startTime = Date.now();

    try {
      const db = env.DB;

      const result = await processBalanceSnapshots(db);

      const duration = Date.now() - startTime;
      console.log(`=== Balance Tracker completed in ${duration}ms ===`);
      console.log(`Processed ${result.users} users, ${result.snapshots} snapshots, ${result.deposits} deposits`);

    } catch (error) {
      console.error('Balance Tracker error:', error);
      throw error;
    }
  },

  /**
   * HTTP handler for manual triggers and health checks
   */
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Health check
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({
        status: 'ok',
        worker: 'lt-balance-tracker',
        timestamp: new Date().toISOString()
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Manual trigger (POST only, with auth check)
    if (url.pathname === '/trigger' && request.method === 'POST') {
      const authHeader = request.headers.get('Authorization');
      if (authHeader !== `Bearer ${env.WORKER_SECRET}`) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Run the scheduled logic
      await this.scheduled({ cron: 'manual' }, env, ctx);

      return new Response(JSON.stringify({
        status: 'triggered',
        timestamp: new Date().toISOString()
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get status
    if (url.pathname === '/status') {
      const db = env.DB;

      const totalBalances = await db.prepare(`
        SELECT COUNT(*) as count FROM UserBalances
      `).first();

      const recentBalances = await db.prepare(`
        SELECT COUNT(*) as count FROM UserBalances
        WHERE CreatedAt >= datetime('now', '-1 hour')
      `).first();

      const totalDeposits = await db.prepare(`
        SELECT COUNT(*) as count FROM DepositTransactions
      `).first();

      return new Response(JSON.stringify({
        worker: 'lt-balance-tracker',
        totalBalances: totalBalances?.count || 0,
        recentBalances: recentBalances?.count || 0,
        totalDeposits: totalDeposits?.count || 0,
        timestamp: new Date().toISOString()
      }, null, 2), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      error: 'Not found',
      worker: 'lt-balance-tracker',
      endpoints: ['/health', '/trigger (POST)', '/status']
    }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
