/**
 * LazaiTrader Suggestion Worker - Cloudflare Worker
 * Generates AI-powered trading strategy suggestions for users
 *
 * Input: { userId, chatId }
 * Output: { success, suggestion, error }
 *
 * Uses data from:
 * - Trades table: User's trading history
 * - UserTradingConfigs table: User's current strategies
 * - TradingPairs table: Available trading pairs
 * - Suggestions table: Past suggestions for consistency
 */

// System prompt for the LLM - concise and focused
const SYSTEM_PROMPT = `You are LazaiTrader's friendly strategy advisor. Give brief, actionable suggestions in a warm, encouraging tone.

LazaiTrader is an automated trading bot that executes trades when price movements hit user-defined triggers. Users can configure:
- Trading pairs (e.g., ETH/USDC on different chains)
- Trigger percentage: Price change threshold to execute a trade (smaller = captures small swings but fees may eat profits; larger = fewer trades but may miss opportunities)
- Trade percentage: % of balance used per trade
- Min/Max trade amounts in USD
- Multiplier: Increases trade size on consecutive same-direction trades

Key insights to consider:
- No trades might mean: trigger too high, not enough time, or low market volatility
- Few trades with losses: trigger might be too low (fees eating profits)
- Good trades: validate current strategy, maybe suggest optimization
- Coming soon: "Boosts" for specific pairs on certain chains - extra rewards!

Keep responses SHORT (2-4 sentences max), friendly, and actionable. Use simple language. One clear suggestion per response.`;

export default {
  async fetch(request, env) {
    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405);
    }

    try {
      const payload = await request.json();
      let { userId, chatId } = payload;

      if (!userId) {
        console.log('[suggestion] Missing userId');
        return jsonResponse({
          success: false,
          error: 'Missing required parameter: userId',
          errorCode: 'INVALID_INPUT'
        }, 400);
      }

      userId = parseInt(userId);
      console.log(`[suggestion] Generating suggestion for user ${userId}`);

      // Get character limit from env (default 5000)
      const charLimit = parseInt(env.INPUT_CHAR_LIMIT || '5000');

      // Fetch all required data in parallel
      const [trades, configs, pairs, pastSuggestions, user] = await Promise.all([
        getUserTrades(userId, charLimit, env),
        getUserConfigs(userId, env),
        getAvailablePairs(env),
        getPastSuggestions(userId, charLimit, env),
        getUser(userId, env)
      ]);

      // Check if user exists
      if (!user) {
        return jsonResponse({
          success: false,
          error: 'User not found. Please register with /start first.',
          errorCode: 'USER_NOT_FOUND'
        });
      }

      // Build the context prompt
      const userContext = buildUserContext(user, trades, configs, pairs, pastSuggestions);

      // Call the LLM
      const suggestion = await callLLM(userContext, env);

      if (!suggestion) {
        return jsonResponse({
          success: false,
          error: 'Could not generate suggestion. Please try again later.',
          errorCode: 'LLM_ERROR'
        });
      }

      // Save the suggestion to database
      await saveSuggestion(userId, suggestion, userContext, env);

      console.log('[suggestion] Suggestion generated successfully');

      return jsonResponse({
        success: true,
        suggestion: suggestion
      });

    } catch (error) {
      console.error('[suggestion] Error:', error.message);
      return jsonResponse({
        success: false,
        error: error.message,
        errorCode: 'INTERNAL_ERROR'
      }, 500);
    }
  }
};

/**
 * Get user info
 */
async function getUser(userId, env) {
  try {
    return await env.DB.prepare(
      'SELECT UserID, Username, RegisteredAt, SCWAddress FROM Users WHERE UserID = ?'
    ).bind(userId).first();
  } catch (error) {
    console.error('[suggestion] Error fetching user:', error.message);
    return null;
  }
}

/**
 * Get user's trade history (limited by character count)
 */
async function getUserTrades(userId, charLimit, env) {
  try {
    const result = await env.DB.prepare(`
      SELECT
        t.Action,
        t.QuantitySent,
        t.QuantityReceived,
        t.CreatedAt,
        ph.Price,
        tp.PairName,
        c.ChainName,
        bt.Symbol AS BaseSymbol,
        qt.Symbol AS QuoteSymbol
      FROM Trades t
      INNER JOIN PriceHistory ph ON t.PriceID = ph.PriceID
      INNER JOIN TradingPairs tp ON t.PairID = tp.PairID
      INNER JOIN Chains c ON tp.ChainID = c.ChainID
      INNER JOIN Tokens bt ON tp.BaseTokenID = bt.TokenID
      INNER JOIN Tokens qt ON tp.QuoteTokenID = qt.TokenID
      WHERE t.UserID = ?
      ORDER BY t.CreatedAt DESC
      LIMIT 50
    `).bind(userId).all();

    const trades = result.results || [];

    // Truncate to character limit
    return truncateData(trades, charLimit);
  } catch (error) {
    console.error('[suggestion] Error fetching trades:', error.message);
    return [];
  }
}

/**
 * Get user's current trading configurations
 */
async function getUserConfigs(userId, env) {
  try {
    const result = await env.DB.prepare(`
      SELECT
        utc.TradePercentage,
        utc.TriggerPercentage,
        utc.MaxAmount,
        utc.MinimumAmount,
        utc.Multiplier,
        utc.IsActive,
        utc.CreatedAt,
        tp.PairName,
        c.ChainName,
        bt.Symbol AS BaseSymbol,
        qt.Symbol AS QuoteSymbol
      FROM UserTradingConfigs utc
      INNER JOIN TradingPairs tp ON utc.PairID = tp.PairID
      INNER JOIN Chains c ON tp.ChainID = c.ChainID
      INNER JOIN Tokens bt ON tp.BaseTokenID = bt.TokenID
      INNER JOIN Tokens qt ON tp.QuoteTokenID = qt.TokenID
      WHERE utc.UserID = ?
      ORDER BY utc.CreatedAt DESC
    `).bind(userId).all();

    return result.results || [];
  } catch (error) {
    console.error('[suggestion] Error fetching configs:', error.message);
    return [];
  }
}

/**
 * Get available trading pairs
 */
async function getAvailablePairs(env) {
  try {
    const result = await env.DB.prepare(`
      SELECT
        tp.PairName,
        c.ChainName,
        bt.Symbol AS BaseSymbol,
        qt.Symbol AS QuoteSymbol,
        tp.DEXType
      FROM TradingPairs tp
      INNER JOIN Chains c ON tp.ChainID = c.ChainID
      INNER JOIN Tokens bt ON tp.BaseTokenID = bt.TokenID
      INNER JOIN Tokens qt ON tp.QuoteTokenID = qt.TokenID
      WHERE tp.IsActive = 1
      ORDER BY c.ChainName, tp.PairName
    `).all();

    return result.results || [];
  } catch (error) {
    console.error('[suggestion] Error fetching pairs:', error.message);
    return [];
  }
}

/**
 * Get past suggestions for this user (for consistency)
 */
async function getPastSuggestions(userId, charLimit, env) {
  try {
    const result = await env.DB.prepare(`
      SELECT Suggestion, CreatedAt
      FROM Suggestions
      WHERE UserID = ?
      ORDER BY CreatedAt DESC
      LIMIT 5
    `).bind(userId).all();

    const suggestions = result.results || [];

    // Truncate to character limit
    return truncateData(suggestions, charLimit);
  } catch (error) {
    console.error('[suggestion] Error fetching past suggestions:', error.message);
    return [];
  }
}

/**
 * Truncate array data to stay within character limit
 */
function truncateData(dataArray, charLimit) {
  if (!dataArray || dataArray.length === 0) return [];

  let result = [];
  let totalChars = 0;

  for (const item of dataArray) {
    const itemStr = JSON.stringify(item);
    if (totalChars + itemStr.length > charLimit) {
      break;
    }
    result.push(item);
    totalChars += itemStr.length;
  }

  return result;
}

/**
 * Build the user context prompt for the LLM
 */
function buildUserContext(user, trades, configs, pairs, pastSuggestions) {
  let context = '';

  // User info
  const registeredDate = user.RegisteredAt ? new Date(user.RegisteredAt).toLocaleDateString() : 'Unknown';
  const hasWallet = !!user.SCWAddress;
  context += `USER: Registered ${registeredDate}, Wallet: ${hasWallet ? 'Active' : 'Not deployed'}\n\n`;

  // Current configurations
  if (configs.length === 0) {
    context += `STRATEGIES: None configured yet\n\n`;
  } else {
    context += `STRATEGIES (${configs.length}):\n`;
    for (const cfg of configs) {
      const status = cfg.IsActive ? 'Active' : 'Paused';
      context += `- ${cfg.ChainName} ${cfg.BaseSymbol}/${cfg.QuoteSymbol}: Trigger ${(cfg.TriggerPercentage * 100).toFixed(1)}%, Trade ${(cfg.TradePercentage * 100).toFixed(1)}%, Min $${cfg.MinimumAmount}, Max $${cfg.MaxAmount}, Multiplier ${cfg.Multiplier}x [${status}]\n`;
    }
    context += '\n';
  }

  // Trade history summary
  if (trades.length === 0) {
    context += `TRADES: No trades executed yet\n\n`;
  } else {
    const buyCount = trades.filter(t => t.Action === 'BUY').length;
    const sellCount = trades.filter(t => t.Action === 'SELL').length;
    const firstTrade = trades[trades.length - 1]?.CreatedAt;
    const lastTrade = trades[0]?.CreatedAt;

    context += `TRADES (${trades.length} total): ${buyCount} buys, ${sellCount} sells\n`;
    context += `Period: ${firstTrade ? new Date(firstTrade).toLocaleDateString() : 'N/A'} to ${lastTrade ? new Date(lastTrade).toLocaleDateString() : 'N/A'}\n`;

    // Show recent trades (last 5)
    const recentTrades = trades.slice(0, 5);
    context += `Recent:\n`;
    for (const trade of recentTrades) {
      context += `- ${trade.Action} ${trade.BaseSymbol}/${trade.QuoteSymbol} @ ${trade.Price} (${new Date(trade.CreatedAt).toLocaleDateString()})\n`;
    }
    context += '\n';
  }

  // Available pairs
  if (pairs.length > 0) {
    context += `AVAILABLE PAIRS (${pairs.length}): `;
    const pairSummary = pairs.map(p => `${p.ChainName}:${p.BaseSymbol}/${p.QuoteSymbol}`).join(', ');
    context += pairSummary + '\n\n';
  }

  // Past suggestions (for consistency)
  if (pastSuggestions.length > 0) {
    context += `PAST SUGGESTIONS:\n`;
    for (const sug of pastSuggestions.slice(0, 3)) {
      const date = new Date(sug.CreatedAt).toLocaleDateString();
      context += `- [${date}]: "${sug.Suggestion.substring(0, 100)}${sug.Suggestion.length > 100 ? '...' : ''}"\n`;
    }
    context += '\n';
  }

  return context;
}

/**
 * Call the LLM (DeepSeek) to generate a suggestion
 */
async function callLLM(userContext, env) {
  const endpoint = env.LLM_ENDPOINT || 'https://api.deepseek.com/v1/chat/completions';
  const apiKey = env.LLM_API_KEY;

  if (!apiKey) {
    console.error('[suggestion] LLM_API_KEY not configured');
    return null;
  }

  const prompt = `Based on this user's trading data, give one brief, friendly suggestion:\n\n${userContext}\n\nYour suggestion (2-4 sentences max):`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt }
        ],
        max_tokens: 200,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[suggestion] LLM API error:', response.status, errorText);
      return null;
    }

    const result = await response.json();

    // Extract the suggestion from the response
    const suggestion = result.choices?.[0]?.message?.content?.trim();

    if (!suggestion) {
      console.error('[suggestion] Empty response from LLM');
      return null;
    }

    return suggestion;
  } catch (error) {
    console.error('[suggestion] Error calling LLM:', error.message);
    return null;
  }
}

/**
 * Save the suggestion to database
 */
async function saveSuggestion(userId, suggestion, inputData, env) {
  try {
    // Truncate input data to avoid storing too much
    const truncatedInput = inputData.length > 2000
      ? inputData.substring(0, 2000) + '...[truncated]'
      : inputData;

    await env.DB.prepare(`
      INSERT INTO Suggestions (UserID, Suggestion, InputData, CreatedAt)
      VALUES (?, ?, ?, datetime('now'))
    `).bind(userId, suggestion, truncatedInput).run();

    console.log('[suggestion] Saved suggestion to database');
  } catch (error) {
    console.error('[suggestion] Error saving suggestion:', error.message);
    // Don't throw - we still want to return the suggestion to the user
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
