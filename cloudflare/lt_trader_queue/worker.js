/**
 * LazaiTrader Trading Queue Worker (Producer)
 *
 * This worker runs on a schedule (every 1 minute) to:
 * 1. Fetch current prices for all active trading pairs
 * 2. Check user trading configs against price movements
 * 3. Send trade messages to Cloudflare Queue when triggers are hit
 *
 * The consumer worker (lt-trading-execution) will pick up messages from the queue
 */

import { parsePrice } from '../shared/priceParser.js';
import tokenMappings from '../shared/tokenMappings.json';

// ============================================
// PRICE FETCHING UTILITIES
// ============================================

/**
 * Normalize base pair symbol from trading pair name
 * Handles cases like "tgETH-tgUSDC" -> "ETH-USDC"
 * Uses shared tokenMappings.json for consistent symbol normalization
 */
function normalizeBasePairSymbol(pairName) {
  // Remove common testnet prefixes
  let normalized = pairName
    .replace(/^tg/gi, '')
    .replace(/-tg/gi, '-')
    .replace(/^t/gi, '')
    .replace(/-t/gi, '-')
    .toUpperCase();

  const parts = normalized.split('-');
  const mappedParts = parts.map(p => tokenMappings.symbolMap[p] || p);
  return mappedParts.join('-');
}

/**
 * Fetch price from a single API endpoint
 */
async function fetchPriceFromEndpoint(endpoint) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

    const response = await fetch(endpoint.EndpointURL, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'LazaiTrader/1.0'
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    // Use ResponseSchema if available, otherwise fall back to provider-based parsing
    const schemaOrProvider = endpoint.ResponseSchema || endpoint.Provider;
    const price = parsePrice(data, schemaOrProvider);

    if (price === null || isNaN(price) || price <= 0) {
      throw new Error('Invalid price value');
    }

    return { success: true, price, provider: endpoint.Provider };
  } catch (error) {
    return { success: false, error: error.message, provider: endpoint.Provider };
  }
}

/**
 * Fetch price for a base pair symbol using fallback endpoints
 */
async function fetchPriceWithFallback(db, basePairSymbol) {
  // Get all active endpoints for this pair, ordered by priority
  const endpoints = await db.prepare(`
    SELECT * FROM PriceAPIEndpoints 
    WHERE BasePairSymbol = ? AND IsActive = 1 
    ORDER BY Priority ASC
  `).bind(basePairSymbol).all();
  
  if (!endpoints.results || endpoints.results.length === 0) {
    console.warn(`No API endpoints configured for ${basePairSymbol}`);
    return null;
  }
  
  for (const endpoint of endpoints.results) {
    const result = await fetchPriceFromEndpoint(endpoint);
    
    if (result.success) {
      // Update success timestamp and reset failure count
      await db.prepare(`
        UPDATE PriceAPIEndpoints 
        SET LastSuccessAt = datetime('now'), 
            ConsecutiveFailures = 0,
            UpdatedAt = datetime('now')
        WHERE EndpointID = ?
      `).bind(endpoint.EndpointID).run();
      
      return { price: result.price, provider: result.provider };
    } else {
      // Update failure info
      console.warn(`${endpoint.Provider} failed for ${basePairSymbol}: ${result.error}`);
      await db.prepare(`
        UPDATE PriceAPIEndpoints 
        SET LastFailureAt = datetime('now'), 
            ConsecutiveFailures = ConsecutiveFailures + 1,
            UpdatedAt = datetime('now')
        WHERE EndpointID = ?
      `).bind(endpoint.EndpointID).run();
    }
  }
  
  console.error(`All endpoints failed for ${basePairSymbol}`);
  return null;
}

// ============================================
// MAIN WORKER LOGIC
// ============================================

/**
 * Get all unique active pairs that need price fetching
 */
async function getActivePairs(db) {
  const result = await db.prepare(`
    SELECT DISTINCT 
      tp.PairID,
      tp.PairName,
      tp.ChainID,
      bt.Symbol AS BaseSymbol,
      qt.Symbol AS QuoteSymbol
    FROM TradingPairs tp
    INNER JOIN UserTradingConfigs utc ON tp.PairID = utc.PairID
    INNER JOIN Users u ON utc.UserID = u.UserID
    INNER JOIN Tokens bt ON tp.BaseTokenID = bt.TokenID
    INNER JOIN Tokens qt ON tp.QuoteTokenID = qt.TokenID
    WHERE tp.IsActive = 1 
      AND utc.IsActive = 1 
      AND u.IsActive = 1
  `).all();
  
  return result.results || [];
}

/**
 * Fetch and cache prices for all unique base pair symbols
 */
async function fetchAndCachePrices(db, pairs) {
  // Get unique base pair symbols
  const basePairSymbols = new Map();
  for (const pair of pairs) {
    const baseSymbol = normalizeBasePairSymbol(pair.PairName);
    if (!basePairSymbols.has(baseSymbol)) {
      basePairSymbols.set(baseSymbol, []);
    }
    basePairSymbols.get(baseSymbol).push(pair);
  }
  
  const priceMap = new Map();
  const fetchPromises = [];
  
  for (const [basePairSymbol, relatedPairs] of basePairSymbols) {
    fetchPromises.push(
      fetchPriceWithFallback(db, basePairSymbol).then(async (result) => {
        if (result) {
          priceMap.set(basePairSymbol, result);
          
          // Cache the price
          await db.prepare(`
            INSERT INTO CachedPrices (BasePairSymbol, Price, Provider, FetchedAt)
            VALUES (?, ?, ?, datetime('now'))
            ON CONFLICT(BasePairSymbol) DO UPDATE SET
              Price = excluded.Price,
              Provider = excluded.Provider,
              FetchedAt = datetime('now')
          `).bind(basePairSymbol, result.price, result.provider).run();
          
          // Also record in PriceHistory for each related trading pair
          for (const pair of relatedPairs) {
            await db.prepare(`
              INSERT INTO PriceHistory (PairID, Price, CreatedAt)
              VALUES (?, ?, datetime('now'))
            `).bind(pair.PairID, result.price).run();
          }
        }
      })
    );
  }
  
  await Promise.all(fetchPromises);
  return priceMap;
}

/**
 * Get cached price for a pair
 */
async function getCachedPrice(db, pairName) {
  const basePairSymbol = normalizeBasePairSymbol(pairName);
  const result = await db.prepare(`
    SELECT Price, Provider, FetchedAt FROM CachedPrices
    WHERE BasePairSymbol = ?
  `).bind(basePairSymbol).first();
  
  return result;
}

/**
 * Get user's last trade for a specific pair
 */
async function getLastTrade(db, userId, pairId) {
  const result = await db.prepare(`
    SELECT 
      t.TradeID,
      t.Action,
      ph.Price,
      t.CreatedAt
    FROM Trades t
    INNER JOIN PriceHistory ph ON t.PriceID = ph.PriceID
    WHERE t.UserID = ? AND t.PairID = ?
    ORDER BY t.CreatedAt DESC
    LIMIT 1
  `).bind(userId, pairId).first();
  
  return result;
}

/**
 * Create a reference trade for new users (0 quantity, establishes price baseline)
 */
async function createReferenceTrade(db, userId, pairId, currentPrice) {
  // First, get the pair details to know which tokens are involved
  const pair = await db.prepare(`
    SELECT BaseTokenID, QuoteTokenID FROM TradingPairs WHERE PairID = ?
  `).bind(pairId).first();

  if (!pair) {
    throw new Error(`Failed to find trading pair ${pairId}`);
  }

  // First, insert into PriceHistory to get a PriceID
  const priceResult = await db.prepare(`
    INSERT INTO PriceHistory (PairID, Price, CreatedAt)
    VALUES (?, ?, datetime('now'))
  `).bind(pairId, currentPrice).run();

  const priceId = priceResult.meta?.last_row_id;

  if (!priceId) {
    throw new Error('Failed to insert price history for reference trade');
  }

  // Generate a unique placeholder TxHash for the reference trade
  const refTxHash = `REF-${userId}-${pairId}-${Date.now()}`;

  // Insert reference trade with 0 quantities
  // Using 'BUY' as action to satisfy CHECK constraint (BUY/SELL only)
  // QuantitySent = 0 indicates this is a reference/init trade
  // For a BUY action, we'd be sending quote token and receiving base token
  await db.prepare(`
    INSERT INTO Trades (PairID, UserID, PriceID, Action, TokenSent, TokenReceived, QuantitySent, QuantityReceived, TxHash, CreatedAt)
    VALUES (?, ?, ?, 'BUY', ?, ?, 0, 0, ?, datetime('now'))
  `).bind(pairId, userId, priceId, pair.QuoteTokenID, pair.BaseTokenID, refTxHash).run();

  return { priceId, txHash: refTxHash };
}

/**
 * Check if a trigger condition is met and determine action
 */
function checkTriggerCondition(currentPrice, lastTradePrice, lastTradeAction, triggerPercentage) {
  if (!lastTradePrice || lastTradePrice <= 0) {
    // Invalid last trade price
    return null;
  }
  
  const percentChange = ((currentPrice - lastTradePrice) / lastTradePrice) * 100;
  const absChange = Math.abs(percentChange);
  
  // TriggerPercentage is stored as decimal (e.g., 0.10 for 10%)
  const triggerThreshold = triggerPercentage * 100;
  
  if (absChange >= triggerThreshold) {
    // Determine action based on price movement
    // If price went UP by trigger%, we SELL (take profit / rebalance)
    // If price went DOWN by trigger%, we BUY (buy the dip / rebalance)
    const action = percentChange > 0 ? 'SELL' : 'BUY';
    
    return {
      triggered: true,
      action,
      percentChange,
      absChange
    };
  }
  
  return { triggered: false, percentChange, absChange };
}

/**
 * Get full config details needed for trade execution
 */
async function getFullConfigDetails(db, config) {
  // Get chain details
  const chain = await db.prepare(`
    SELECT * FROM Chains WHERE ChainID = ?
  `).bind(config.ChainID).first();
  
  // Get pair details with tokens (including DEXType for routing to correct handler)
  const pairDetails = await db.prepare(`
    SELECT
      tp.*,
      bt.TokenID AS BaseTokenID,
      bt.Symbol AS BaseSymbol,
      bt.TokenAddress AS BaseTokenAddress,
      bt.Decimals AS BaseDecimals,
      qt.TokenID AS QuoteTokenID,
      qt.Symbol AS QuoteSymbol,
      qt.TokenAddress AS QuoteTokenAddress,
      qt.Decimals AS QuoteDecimals
    FROM TradingPairs tp
    INNER JOIN Tokens bt ON tp.BaseTokenID = bt.TokenID
    INNER JOIN Tokens qt ON tp.QuoteTokenID = qt.TokenID
    WHERE tp.PairID = ?
  `).bind(config.PairID).first();
  
  return { chain, pairDetails };
}

/**
 * Process all user trading configs and send triggered trades to queue
 */
async function processConfigs(db, queue) {
  // Get all active user trading configs with full details
  const configs = await db.prepare(`
    SELECT
      utc.ConfigID,
      utc.UserID,
      utc.PairID,
      utc.TradePercentage,
      utc.TriggerPercentage,
      utc.MaxAmount,
      utc.MinimumAmount,
      utc.Multiplier,
      u.TelegramChatID,
      u.SCWAddress,
      u.UserWallet,
      tp.PairName,
      tp.ChainID,
      tp.DEXAddress,
      tp.DEXType
    FROM UserTradingConfigs utc
    INNER JOIN Users u ON utc.UserID = u.UserID
    INNER JOIN TradingPairs tp ON utc.PairID = tp.PairID
    WHERE utc.IsActive = 1 AND u.IsActive = 1 AND tp.IsActive = 1
  `).all();
  
  if (!configs.results || configs.results.length === 0) {
    console.log('No active trading configs found');
    return { processed: 0, triggered: 0 };
  }
  
  let processed = 0;
  let triggered = 0;
  const queueMessages = [];
  
  for (const config of configs.results) {
    processed++;
    
    // Get cached price for this pair
    const cachedPrice = await getCachedPrice(db, config.PairName);
    if (!cachedPrice) {
      console.warn(`[SKIP] No cached price for ${config.PairName}, config ${config.ConfigID}`);
      continue;
    }
    
    const currentPrice = cachedPrice.Price;
    
    // Get user's last trade for this pair
    const lastTrade = await getLastTrade(db, config.UserID, config.PairID);
    
    // Handle new users without any trades
    if (!lastTrade) {
      try {
        const ref = await createReferenceTrade(db, config.UserID, config.PairID, currentPrice);
        console.log(`[NEW USER] Created reference trade for user ${config.UserID}, pair ${config.PairName} at price ${currentPrice} (txHash: ${ref.txHash})`);
      } catch (err) {
        console.error(`[ERROR] Failed to create reference trade for user ${config.UserID}, pair ${config.PairID}: ${err.message}`);
      }
      continue; // Skip this run, they'll be evaluated next cycle
    }
    
    // Check if trigger condition is met
    const triggerResult = checkTriggerCondition(
      currentPrice,
      lastTrade?.Price,
      lastTrade?.Action,
      config.TriggerPercentage
    );
    
    if (!triggerResult) {
      console.warn(`[SKIP] Invalid trigger check for user ${config.UserID}, pair ${config.PairName} (lastTradePrice: ${lastTrade?.Price})`);
      continue;
    }
    
    if (!triggerResult.triggered) {
      console.log(`[NO TRIGGER] User ${config.UserID}, pair ${config.PairName}: ${triggerResult.percentChange.toFixed(2)}% change (need ${config.TriggerPercentage * 100}%)`);
      continue;
    }
    
    // Get full details for execution
    const { chain, pairDetails } = await getFullConfigDetails(db, config);
    
    // Build queue message with all data needed for execution
    const queueMessage = {
      // Identifiers
      userId: config.UserID,
      configId: config.ConfigID,
      pairId: config.PairID,
      chainId: config.ChainID,
      
      // Trade action
      action: triggerResult.action,
      
      // Price info
      triggerPrice: currentPrice,
      lastTradePrice: lastTrade?.Price || null,
      lastTradeId: lastTrade?.TradeID || null,
      triggerPercentage: config.TriggerPercentage,
      actualChangePercent: triggerResult.percentChange,
      
      // User details
      telegramChatId: config.TelegramChatID,
      scwAddress: config.SCWAddress,
      userWallet: config.UserWallet,
      
      // Trading config
      tradePercentage: config.TradePercentage,
      maxAmount: config.MaxAmount,
      minimumAmount: config.MinimumAmount,
      multiplier: config.Multiplier,
      
      // Chain details
      chain: {
        chainId: chain.ChainID,
        chainName: chain.ChainName,
        rpcEndpoint: chain.RPCEndpoint,
        explorerUrl: chain.ExplorerURL,
        nativeCurrency: chain.NativeCurrency
      },
      
      // Pair details
      pair: {
        pairName: pairDetails.PairName,
        dexAddress: pairDetails.DEXAddress,
        dexType: pairDetails.DEXType || 'LazaiSwap', // Default for backwards compatibility
        baseToken: {
          tokenId: pairDetails.BaseTokenID,
          symbol: pairDetails.BaseSymbol,
          address: pairDetails.BaseTokenAddress,
          decimals: pairDetails.BaseDecimals
        },
        quoteToken: {
          tokenId: pairDetails.QuoteTokenID,
          symbol: pairDetails.QuoteSymbol,
          address: pairDetails.QuoteTokenAddress,
          decimals: pairDetails.QuoteDecimals
        }
      },
      
      // Metadata
      queuedAt: new Date().toISOString(),
      priority: Math.floor(triggerResult.absChange) // Higher change = higher priority
    };
    
    queueMessages.push(queueMessage);
    triggered++;
    
    console.log(`Queuing ${triggerResult.action} for user ${config.UserID}, pair ${config.PairName}: ${triggerResult.percentChange.toFixed(2)}% change`);
  }
  
  // Send all messages to the Cloudflare Queue
  if (queueMessages.length > 0) {
    // Send messages in batches (Queue supports batch sending)
    const batchSize = 100; // Cloudflare Queue max batch size
    for (let i = 0; i < queueMessages.length; i += batchSize) {
      const batch = queueMessages.slice(i, i + batchSize);
      
      // Use sendBatch for multiple messages
      await queue.sendBatch(
        batch.map(msg => ({
          body: msg,
          // Optional: set content type
          contentType: 'json'
        }))
      );
    }
    
    console.log(`Sent ${queueMessages.length} messages to queue`);
  }
  
  return { processed, triggered };
}

// ============================================
// WORKER ENTRY POINTS
// ============================================

export default {
  /**
   * Scheduled handler - runs every 1 minute
   * This is the main entry point for the producer worker
   */
  async scheduled(event, env, ctx) {
    console.log('=== Trading Queue Producer Started ===');
    console.log(`Trigger: ${event.cron}`);
    
    const startTime = Date.now();
    
    try {
      const db = env.DB;
      const queue = env.TRADING_QUEUE;
      
      if (!queue) {
        throw new Error('TRADING_QUEUE binding not configured');
      }
      
      // Step 1: Get all active pairs
      console.log('Step 1: Fetching active pairs...');
      const pairs = await getActivePairs(db);
      console.log(`Found ${pairs.length} active pairs`);
      
      if (pairs.length === 0) {
        console.log('No active pairs to process');
        return;
      }
      
      // Step 2: Fetch and cache prices
      console.log('Step 2: Fetching prices...');
      const priceMap = await fetchAndCachePrices(db, pairs);
      console.log(`Cached prices for ${priceMap.size} unique base pairs`);
      
      // Step 3: Process configs and send to queue
      console.log('Step 3: Processing trading configs...');
      const { processed, triggered } = await processConfigs(db, queue);
      console.log(`Processed ${processed} configs, triggered ${triggered} trades`);
      
      const duration = Date.now() - startTime;
      console.log(`=== Producer completed in ${duration}ms ===`);
      
    } catch (error) {
      console.error('Producer worker error:', error);
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
        worker: 'lt-trading-queue (producer)',
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
    
    // Get status (cached prices)
    if (url.pathname === '/status') {
      const db = env.DB;
      
      const cachedPrices = await db.prepare(`
        SELECT * FROM CachedPrices
      `).all();
      
      const activeConfigs = await db.prepare(`
        SELECT COUNT(*) as count FROM UserTradingConfigs WHERE IsActive = 1
      `).first();
      
      return new Response(JSON.stringify({
        worker: 'lt-trading-queue (producer)',
        activeConfigs: activeConfigs?.count || 0,
        cachedPrices: cachedPrices?.results || [],
        timestamp: new Date().toISOString()
      }, null, 2), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Test send to queue
    if (url.pathname === '/test-queue' && request.method === 'POST') {
      const authHeader = request.headers.get('Authorization');
      if (authHeader !== `Bearer ${env.WORKER_SECRET}`) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      const queue = env.TRADING_QUEUE;
      if (!queue) {
        return new Response(JSON.stringify({ error: 'Queue not configured' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Send test message
      await queue.send({
        type: 'test',
        message: 'Test message from producer',
        timestamp: new Date().toISOString()
      });
      
      return new Response(JSON.stringify({ 
        status: 'test message sent',
        timestamp: new Date().toISOString() 
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({ 
      error: 'Not found',
      worker: 'lt-trading-queue (producer)',
      endpoints: ['/health', '/trigger (POST)', '/status', '/test-queue (POST)']
    }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};