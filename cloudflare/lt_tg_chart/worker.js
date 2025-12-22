/**
 * LazaiTrader Chart Worker - Cloudflare Worker
 * Generates trade history charts using QuickChart API
 *
 * Features:
 * - Token price lines (normalized across chains - ETH from any chain is "ETH")
 * - Green dots for buys, red dots for sells on the price lines
 * - PnL calculation considering deposits and withdrawals
 *
 * Input: { userId, chatId }
 * Output: { success, chartUrl, stats, error }
 */

import { normalizeTokenSymbol, isStablecoin, getTokenChartColor } from '../shared/priceHelper.js';

const QUICKCHART_API = 'https://quickchart.io/chart';

export default {
  async fetch(request, env) {
    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405);
    }

    try {
      const payload = await request.json();
      let { userId, chatId } = payload;

      if (!userId) {
        console.log('[chart] Missing userId');
        return jsonResponse({
          success: false,
          error: 'Missing required parameter: userId',
          errorCode: 'INVALID_INPUT'
        }, 400);
      }

      userId = parseInt(userId);
      console.log(`[chart] Generating chart for user ${userId}`);

      // Get all data needed for the chart
      const [trades, deposits, withdrawals, balanceHistory] = await Promise.all([
        getUserTrades(userId, env),
        getUserDeposits(userId, env),
        getUserWithdrawals(userId, env),
        getUserBalanceHistory(userId, env)
      ]);

      if ((!trades || trades.length === 0) && (!balanceHistory || balanceHistory.length === 0)) {
        console.log('[chart] No trade or balance data found');
        return jsonResponse({
          success: false,
          error: 'No trading or balance history found',
          errorCode: 'NO_DATA'
        });
      }

      // Calculate statistics with proper PnL
      const stats = calculateStats(trades, deposits, withdrawals, balanceHistory);

      // Generate chart configuration
      const chartConfig = generateChartConfig(trades, deposits, withdrawals, balanceHistory, stats);

      // Validate chart config has data to display
      if (!chartConfig.data.datasets || chartConfig.data.datasets.length === 0) {
        console.log('[chart] No valid datasets generated');
        return jsonResponse({
          success: false,
          error: 'No valid data to display in chart',
          errorCode: 'NO_DATA'
        });
      }

      if (!chartConfig.data.labels || chartConfig.data.labels.length === 0) {
        console.log('[chart] No valid date labels generated');
        return jsonResponse({
          success: false,
          error: 'No valid date data to display in chart',
          errorCode: 'NO_DATA'
        });
      }

      // Generate chart URL using QuickChart
      const chartUrl = await generateChartUrl(chartConfig);

      console.log('[chart] Chart generated successfully');

      return jsonResponse({
        success: true,
        chartUrl: chartUrl,
        stats: stats,
        tradeCount: trades?.length || 0,
        depositCount: deposits?.length || 0,
        withdrawalCount: withdrawals?.length || 0
      });

    } catch (error) {
      console.error('[chart] Error:', error.message);
      return jsonResponse({
        success: false,
        error: error.message,
        errorCode: 'INTERNAL_ERROR'
      }, 500);
    }
  }
};

/**
 * Get user's trade history with token details
 * Normalizes token symbols across chains
 */
async function getUserTrades(userId, env) {
  try {
    const result = await env.DB.prepare(`
      SELECT
        t.TradeID,
        t.Action,
        t.QuantitySent,
        t.QuantityReceived,
        t.TxHash,
        t.CreatedAt,
        ph.Price,
        tp.PairName,
        bt.Symbol AS BaseSymbol,
        qt.Symbol AS QuoteSymbol,
        tSent.Symbol AS TokenSentSymbol,
        tReceived.Symbol AS TokenReceivedSymbol
      FROM Trades t
      INNER JOIN PriceHistory ph ON t.PriceID = ph.PriceID
      INNER JOIN TradingPairs tp ON t.PairID = tp.PairID
      INNER JOIN Tokens bt ON tp.BaseTokenID = bt.TokenID
      INNER JOIN Tokens qt ON tp.QuoteTokenID = qt.TokenID
      LEFT JOIN Tokens tSent ON t.TokenSent = tSent.TokenID
      LEFT JOIN Tokens tReceived ON t.TokenReceived = tReceived.TokenID
      WHERE t.UserID = ?
      ORDER BY t.CreatedAt ASC
    `).bind(userId).all();

    // Normalize token symbols
    const trades = (result.results || []).map(trade => ({
      ...trade,
      NormalizedBaseSymbol: normalizeTokenSymbol(trade.BaseSymbol),
      NormalizedQuoteSymbol: normalizeTokenSymbol(trade.QuoteSymbol),
      NormalizedTokenSent: trade.TokenSentSymbol ? normalizeTokenSymbol(trade.TokenSentSymbol) : null,
      NormalizedTokenReceived: trade.TokenReceivedSymbol ? normalizeTokenSymbol(trade.TokenReceivedSymbol) : null
    }));

    return trades;
  } catch (error) {
    console.error('[chart] Error fetching trades:', error.message);
    return [];
  }
}

/**
 * Get user's deposit history
 */
async function getUserDeposits(userId, env) {
  try {
    const result = await env.DB.prepare(`
      SELECT
        d.DepositID,
        d.Amount,
        d.Status,
        d.CreatedAt,
        d.ConfirmedAt,
        t.Symbol AS TokenSymbol
      FROM DepositTransactions d
      LEFT JOIN Tokens t ON d.TokenAddress = t.TokenAddress AND d.ChainID = t.ChainID
      WHERE d.UserID = ? AND d.Status = 'confirmed'
      ORDER BY d.CreatedAt ASC
    `).bind(userId).all();

    return (result.results || []).map(d => ({
      ...d,
      NormalizedSymbol: d.TokenSymbol ? normalizeTokenSymbol(d.TokenSymbol) : 'UNKNOWN'
    }));
  } catch (error) {
    console.error('[chart] Error fetching deposits:', error.message);
    return [];
  }
}

/**
 * Get user's withdrawal history
 */
async function getUserWithdrawals(userId, env) {
  try {
    const result = await env.DB.prepare(`
      SELECT
        w.WithdrawalID,
        w.Amount,
        w.AmountFormatted,
        w.Status,
        w.WithdrawnAt,
        t.Symbol AS TokenSymbol
      FROM Withdrawals w
      LEFT JOIN Tokens t ON w.TokenID = t.TokenID
      WHERE w.UserID = ? AND w.Status = 'confirmed'
      ORDER BY w.WithdrawnAt ASC
    `).bind(userId).all();

    return (result.results || []).map(w => ({
      ...w,
      NormalizedSymbol: w.TokenSymbol ? normalizeTokenSymbol(w.TokenSymbol) : 'UNKNOWN',
      AmountParsed: w.AmountFormatted ? parseFloat(w.AmountFormatted) : parseFloat(w.Amount)
    }));
  } catch (error) {
    console.error('[chart] Error fetching withdrawals:', error.message);
    return [];
  }
}

/**
 * Get user's balance history with USDC values
 * Groups by normalized token symbol
 */
async function getUserBalanceHistory(userId, env) {
  try {
    const result = await env.DB.prepare(`
      SELECT
        ub.BalanceID,
        ub.Balance,
        ub.BalanceUSDC,
        ub.PriceUSDC,
        ub.CreatedAt,
        t.Symbol AS TokenSymbol
      FROM UserBalances ub
      INNER JOIN Tokens t ON ub.TokenID = t.TokenID
      WHERE ub.UserID = ?
      ORDER BY ub.CreatedAt ASC
    `).bind(userId).all();

    return (result.results || []).map(b => ({
      ...b,
      NormalizedSymbol: normalizeTokenSymbol(b.TokenSymbol)
    }));
  } catch (error) {
    console.error('[chart] Error fetching balance history:', error.message);
    return [];
  }
}

/**
 * Calculate trading statistics including PnL with deposits/withdrawals consideration
 */
function calculateStats(trades, deposits, withdrawals, balanceHistory) {
  const stats = {
    totalTrades: trades?.length || 0,
    totalDeposits: deposits?.length || 0,
    totalWithdrawals: withdrawals?.length || 0,
    buyCount: 0,
    sellCount: 0,
    // Track USDC values for PnL
    totalDepositedUSDC: 0,
    totalWithdrawnUSDC: 0,
    currentPortfolioUSDC: 0,
    pnlAbsolute: 0,
    pnlPercentage: 0,
    firstTradeDate: null,
    lastTradeDate: null,
    tokensTraded: new Set()
  };

  if (!trades || trades.length === 0) {
    return stats;
  }

  // Process trades
  trades.forEach(trade => {
    if (trade.Action === 'BUY') {
      stats.buyCount++;
    } else if (trade.Action === 'SELL') {
      stats.sellCount++;
    }
    stats.tokensTraded.add(trade.NormalizedBaseSymbol);
  });

  // Set date range
  stats.firstTradeDate = trades[0]?.CreatedAt;
  stats.lastTradeDate = trades[trades.length - 1]?.CreatedAt;

  // Calculate deposits in USDC (approximate - use stablecoins or latest prices)
  if (deposits && deposits.length > 0) {
    deposits.forEach(d => {
      if (isStablecoin(d.NormalizedSymbol)) {
        stats.totalDepositedUSDC += d.Amount || 0;
      }
      // For non-stablecoins, we'd need historical prices - simplified for now
    });
  }

  // Calculate withdrawals in USDC
  if (withdrawals && withdrawals.length > 0) {
    withdrawals.forEach(w => {
      if (isStablecoin(w.NormalizedSymbol)) {
        stats.totalWithdrawnUSDC += w.AmountParsed || 0;
      }
    });
  }

  // Calculate current portfolio value from latest balances
  if (balanceHistory && balanceHistory.length > 0) {
    // Get latest balance per token
    const latestBalances = new Map();
    balanceHistory.forEach(b => {
      const existing = latestBalances.get(b.NormalizedSymbol);
      if (!existing || new Date(b.CreatedAt) > new Date(existing.CreatedAt)) {
        latestBalances.set(b.NormalizedSymbol, b);
      }
    });

    // Sum up USDC values
    latestBalances.forEach(b => {
      if (b.BalanceUSDC && b.BalanceUSDC > 0) {
        stats.currentPortfolioUSDC += b.BalanceUSDC;
      }
    });
  }

  // PnL = Current Value + Withdrawals - Deposits
  // This properly accounts for:
  // - Money deposited (cost basis)
  // - Money withdrawn (realized gains)
  // - Current holdings (unrealized gains)
  stats.pnlAbsolute = stats.currentPortfolioUSDC + stats.totalWithdrawnUSDC - stats.totalDepositedUSDC;

  if (stats.totalDepositedUSDC > 0) {
    stats.pnlPercentage = (stats.pnlAbsolute / stats.totalDepositedUSDC) * 100;
  }

  // Convert Set to Array for serialization
  stats.tokensTraded = Array.from(stats.tokensTraded);

  return stats;
}

/**
 * Generate QuickChart configuration
 * Main feature: Portfolio value line (total USD value over time)
 * Secondary: Token price lines (faded 20%), buy/sell/deposit/withdrawal markers
 */
function generateChartConfig(trades, deposits, withdrawals, balanceHistory, stats) {
  const datasets = [];
  const allDates = new Set();

  // Collect all dates from all data sources
  if (balanceHistory && balanceHistory.length > 0) {
    balanceHistory.forEach(b => {
      const formattedDate = formatDate(b.CreatedAt);
      if (formattedDate) allDates.add(formattedDate);
    });
  }

  if (trades && trades.length > 0) {
    trades.forEach(t => {
      const formattedDate = formatDate(t.CreatedAt);
      if (formattedDate) allDates.add(formattedDate);
    });
  }

  if (deposits && deposits.length > 0) {
    deposits.forEach(d => {
      const formattedDate = formatDate(d.CreatedAt);
      if (formattedDate) allDates.add(formattedDate);
    });
  }

  if (withdrawals && withdrawals.length > 0) {
    withdrawals.forEach(w => {
      const formattedDate = formatDate(w.WithdrawnAt);
      if (formattedDate) allDates.add(formattedDate);
    });
  }

  // Sort dates
  const sortedDates = Array.from(allDates).filter(d => d !== null).sort();

  if (sortedDates.length === 0) {
    return { type: 'line', data: { labels: [], datasets: [] } };
  }

  // ============================================
  // 1. MAIN LINE: Portfolio Value (Total USD)
  // ============================================
  if (balanceHistory && balanceHistory.length > 0) {
    // Calculate total portfolio value per date
    const portfolioByDate = new Map();

    // Group balances by date, then sum all tokens for that date
    balanceHistory.forEach(b => {
      const date = formatDate(b.CreatedAt);
      if (!date) return;

      if (!portfolioByDate.has(date)) {
        portfolioByDate.set(date, new Map());
      }

      // Track latest balance per token per date
      const tokenBalances = portfolioByDate.get(date);
      const existing = tokenBalances.get(b.NormalizedSymbol);
      if (!existing || new Date(b.CreatedAt) > new Date(existing.CreatedAt)) {
        tokenBalances.set(b.NormalizedSymbol, b);
      }
    });

    // Calculate total portfolio value for each date
    const portfolioData = sortedDates.map(date => {
      const tokenBalances = portfolioByDate.get(date);
      if (!tokenBalances) return null;

      let total = 0;
      tokenBalances.forEach(b => {
        if (b.BalanceUSDC && b.BalanceUSDC > 0) {
          total += b.BalanceUSDC;
        }
      });

      return total > 0 ? total : null;
    });

    // Add portfolio line as the MAIN prominent line
    if (portfolioData.some(p => p !== null)) {
      datasets.push({
        label: 'Portfolio Value (USD)',
        data: portfolioData,
        borderColor: '#8B5CF6',
        backgroundColor: '#8B5CF620',
        fill: true,
        tension: 0.2,
        spanGaps: true,
        pointRadius: 3,
        borderWidth: 3,
        yAxisID: 'y'
      });
    }
  }

  // ============================================
  // 2. FADED TOKEN PRICE LINES (20% opacity)
  // ============================================
  const balancesByToken = new Map();

  if (balanceHistory && balanceHistory.length > 0) {
    balanceHistory.forEach(b => {
      // Skip stablecoins for price lines
      if (isStablecoin(b.NormalizedSymbol)) return;
      // Skip if no price data
      if (!b.PriceUSDC || b.PriceUSDC <= 0) return;

      if (!balancesByToken.has(b.NormalizedSymbol)) {
        balancesByToken.set(b.NormalizedSymbol, []);
      }
      balancesByToken.get(b.NormalizedSymbol).push(b);
    });
  }

  // Create faded price line datasets for each token
  balancesByToken.forEach((balances, tokenSymbol) => {
    const baseColor = getTokenChartColor(tokenSymbol);
    // Convert hex to rgba with 20% opacity
    const fadedColor = hexToRgba(baseColor, 0.2);

    // Create price line data
    const priceData = sortedDates.map(date => {
      const dayBalances = balances.filter(b => formatDate(b.CreatedAt) === date);
      if (dayBalances.length > 0) {
        return dayBalances[dayBalances.length - 1].PriceUSDC;
      }
      return null;
    });

    if (priceData.some(p => p !== null)) {
      datasets.push({
        label: `${tokenSymbol} Price`,
        data: priceData,
        borderColor: fadedColor,
        backgroundColor: 'transparent',
        fill: false,
        tension: 0.1,
        spanGaps: true,
        pointRadius: 0,
        borderWidth: 1,
        yAxisID: 'y1'
      });
    }
  });

  // ============================================
  // 3. BUY/SELL MARKERS (on portfolio value line)
  // ============================================
  if (trades && trades.length > 0) {
    // Get portfolio values for marker positioning
    const portfolioValues = datasets.find(d => d.label === 'Portfolio Value (USD)')?.data || [];

    // Collect all buys and sells
    const buyDates = [];
    const sellDates = [];

    trades.forEach(trade => {
      const date = formatDate(trade.CreatedAt);
      if (trade.Action === 'BUY') {
        buyDates.push(date);
      } else {
        sellDates.push(date);
      }
    });

    // Buy markers (green dots)
    const buyData = sortedDates.map((date, idx) => {
      if (buyDates.includes(date)) {
        return portfolioValues[idx] || null;
      }
      return null;
    });

    if (buyData.some(b => b !== null)) {
      datasets.push({
        label: 'Buy',
        data: buyData,
        borderColor: '#22c55e',
        backgroundColor: '#22c55e',
        pointRadius: 8,
        pointStyle: 'circle',
        showLine: false,
        yAxisID: 'y'
      });
    }

    // Sell markers (red dots)
    const sellData = sortedDates.map((date, idx) => {
      if (sellDates.includes(date)) {
        return portfolioValues[idx] || null;
      }
      return null;
    });

    if (sellData.some(s => s !== null)) {
      datasets.push({
        label: 'Sell',
        data: sellData,
        borderColor: '#ef4444',
        backgroundColor: '#ef4444',
        pointRadius: 8,
        pointStyle: 'circle',
        showLine: false,
        yAxisID: 'y'
      });
    }
  }

  // ============================================
  // 4. DEPOSIT MARKERS (Yellow)
  // ============================================
  if (deposits && deposits.length > 0) {
    const portfolioValues = datasets.find(d => d.label === 'Portfolio Value (USD)')?.data || [];

    const depositDates = deposits.map(d => formatDate(d.CreatedAt));

    const depositData = sortedDates.map((date, idx) => {
      if (depositDates.includes(date)) {
        return portfolioValues[idx] || null;
      }
      return null;
    });

    if (depositData.some(d => d !== null)) {
      datasets.push({
        label: 'Deposit',
        data: depositData,
        borderColor: '#EAB308',
        backgroundColor: '#EAB308',
        pointRadius: 10,
        pointStyle: 'triangle',
        showLine: false,
        yAxisID: 'y'
      });
    }
  }

  // ============================================
  // 5. WITHDRAWAL MARKERS (Black)
  // ============================================
  if (withdrawals && withdrawals.length > 0) {
    const portfolioValues = datasets.find(d => d.label === 'Portfolio Value (USD)')?.data || [];

    const withdrawalDates = withdrawals.map(w => formatDate(w.WithdrawnAt));

    const withdrawalData = sortedDates.map((date, idx) => {
      if (withdrawalDates.includes(date)) {
        return portfolioValues[idx] || null;
      }
      return null;
    });

    if (withdrawalData.some(w => w !== null)) {
      datasets.push({
        label: 'Withdrawal',
        data: withdrawalData,
        borderColor: '#000000',
        backgroundColor: '#000000',
        pointRadius: 10,
        pointStyle: 'rectRot',
        showLine: false,
        yAxisID: 'y'
      });
    }
  }

  // Build title with PnL
  const pnlSign = stats.pnlPercentage >= 0 ? '+' : '';
  const title = stats.totalTrades > 0
    ? `Portfolio Value | PnL: ${pnlSign}${stats.pnlPercentage.toFixed(2)}% ($${stats.pnlAbsolute.toFixed(2)}) | Trades: ${stats.totalTrades}`
    : 'Portfolio Value';

  // Check if we have price data for secondary axis
  const hasPriceData = balancesByToken.size > 0;

  return {
    type: 'line',
    data: {
      labels: sortedDates,
      datasets: datasets
    },
    options: {
      responsive: true,
      title: {
        display: true,
        text: title,
        fontSize: 14,
        fontStyle: 'bold'
      },
      legend: {
        position: 'bottom',
        labels: {
          boxWidth: 12,
          filter: function(item) {
            // Show Portfolio, Buy, Sell, Deposit, Withdrawal in legend
            // Hide individual token price lines
            const showLabels = ['Portfolio Value (USD)', 'Buy', 'Sell', 'Deposit', 'Withdrawal'];
            return showLabels.includes(item.text);
          }
        }
      },
      scales: {
        xAxes: [{
          display: true,
          scaleLabel: {
            display: true,
            labelString: 'Date'
          },
          ticks: {
            maxRotation: 45,
            minRotation: 45
          }
        }],
        yAxes: [
          {
            id: 'y',
            type: 'linear',
            display: true,
            position: 'left',
            scaleLabel: {
              display: true,
              labelString: 'Portfolio Value (USD)'
            }
          },
          ...(hasPriceData ? [{
            id: 'y1',
            type: 'linear',
            display: true,
            position: 'right',
            scaleLabel: {
              display: true,
              labelString: 'Token Price (USD)'
            },
            gridLines: {
              drawOnChartArea: false
            }
          }] : [])
        ]
      }
    }
  };
}

/**
 * Convert hex color to rgba with opacity
 */
function hexToRgba(hex, opacity) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return hex;

  const r = parseInt(result[1], 16);
  const g = parseInt(result[2], 16);
  const b = parseInt(result[3], 16);

  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/**
 * Generate chart URL using QuickChart API
 */
async function generateChartUrl(chartConfig) {
  if (!chartConfig || typeof chartConfig !== 'object') {
    console.error('[chart] Invalid chart config');
    throw new Error('Invalid chart configuration');
  }

  const chartJson = JSON.stringify(chartConfig);
  console.log('[chart] Chart config size:', chartJson.length, 'bytes');

  try {
    const response = await fetch('https://quickchart.io/chart/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chart: chartConfig,
        width: 800,
        height: 400,
        backgroundColor: 'white',
        format: 'png'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[chart] QuickChart API error:', response.status, errorText);
      return `${QUICKCHART_API}?c=${encodeURIComponent(chartJson)}&w=800&h=400&bkg=white`;
    }

    const result = await response.json();

    if (result.success === false || result.error) {
      console.error('[chart] QuickChart returned error:', result.error || 'Unknown error');
      return `${QUICKCHART_API}?c=${encodeURIComponent(chartJson)}&w=800&h=400&bkg=white`;
    }

    return result.url || `${QUICKCHART_API}?c=${encodeURIComponent(chartJson)}&w=800&h=400&bkg=white`;
  } catch (error) {
    console.error('[chart] Error calling QuickChart API:', error.message);
    return `${QUICKCHART_API}?c=${encodeURIComponent(chartJson)}&w=800&h=400&bkg=white`;
  }
}

/**
 * Format date for display
 */
function formatDate(dateString) {
  if (!dateString) return null;
  try {
    const date = new Date(dateString);
    return date.toISOString().split('T')[0]; // YYYY-MM-DD format
  } catch (e) {
    return dateString;
  }
}

/**
 * JSON response helper
 */
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
