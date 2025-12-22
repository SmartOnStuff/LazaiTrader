/**
 * Price Helper Utilities
 *
 * Helper functions for fetching and caching token prices with time-based logic
 */

import { parsePrice } from './priceParser.js';
import tokenMappings from './tokenMappings.json';

/**
 * Normalize token symbol for price lookups
 * Maps wrapped/testnet tokens to their canonical symbols
 */
export function normalizeTokenSymbol(symbol) {
  const upperSymbol = symbol.toUpperCase();
  return tokenMappings.symbolMap[upperSymbol] || upperSymbol;
}

/**
 * Check if a token symbol is a stablecoin
 */
export function isStablecoin(symbol) {
  const upperSymbol = symbol.toUpperCase();
  return tokenMappings.stablecoins.includes(upperSymbol) ||
         tokenMappings.stablecoins.includes(normalizeTokenSymbol(upperSymbol));
}

/**
 * Get chart color for a token
 */
export function getTokenChartColor(symbol) {
  const normalizedSymbol = normalizeTokenSymbol(symbol);
  return tokenMappings.chartColors[normalizedSymbol] || tokenMappings.chartColors.DEFAULT;
}

/**
 * Get token price in USDC with ±5 minute caching
 *
 * @param {Object} db - D1 database instance
 * @param {string} tokenSymbol - Token symbol (e.g., "ETH", "WBTC", "M.USDC")
 * @param {string} quoteSymbol - Quote symbol (default: "USDC")
 * @param {number} timeRangeMinutes - Time range for cached price lookup (default: 5)
 * @returns {Promise<Object|null>} Price object with {price, fetchedAt, isCached} or null
 */
export async function getTokenPriceUSDC(db, tokenSymbol, quoteSymbol = 'USDC', timeRangeMinutes = 5) {
  // Normalize symbols (e.g., "WETH" -> "ETH", "M.USDC" -> "USDC")
  const normalizedToken = normalizeTokenSymbol(tokenSymbol);
  const normalizedQuote = normalizeTokenSymbol(quoteSymbol);

  // If both normalize to the same symbol (e.g., M.USDC-USDC -> USDC-USDC), price is 1
  if (normalizedToken === normalizedQuote) {
    return {
      price: 1.0,
      fetchedAt: new Date().toISOString(),
      provider: 'normalized',
      isCached: false,
      basePairSymbol: `${normalizedToken}-${normalizedQuote}`
    };
  }

  const basePairSymbol = `${normalizedToken}-${normalizedQuote}`;

  // Check if we have a recent price within the time range
  const cachedPrice = await db.prepare(`
    SELECT Price, FetchedAt, Provider
    FROM CachedPrices
    WHERE BasePairSymbol = ?
      AND datetime(FetchedAt) >= datetime('now', '-${timeRangeMinutes} minutes')
    ORDER BY FetchedAt DESC
    LIMIT 1
  `).bind(basePairSymbol).first();

  if (cachedPrice) {
    // We have a recent price, use it
    return {
      price: cachedPrice.Price,
      fetchedAt: cachedPrice.FetchedAt,
      provider: cachedPrice.Provider,
      isCached: true,
      basePairSymbol
    };
  }

  // No recent price, fetch a new one
  const fetchedPrice = await fetchPriceWithFallback(db, basePairSymbol);

  if (fetchedPrice) {
    // Cache the newly fetched price
    await db.prepare(`
      INSERT INTO CachedPrices (BasePairSymbol, Price, Provider, FetchedAt)
      VALUES (?, ?, ?, datetime('now'))
      ON CONFLICT(BasePairSymbol) DO UPDATE SET
        Price = excluded.Price,
        Provider = excluded.Provider,
        FetchedAt = datetime('now')
    `).bind(basePairSymbol, fetchedPrice.price, fetchedPrice.provider).run();

    return {
      price: fetchedPrice.price,
      fetchedAt: new Date().toISOString(),
      provider: fetchedPrice.provider,
      isCached: false,
      basePairSymbol
    };
  }

  // Failed to fetch price
  console.error(`Failed to get price for ${basePairSymbol}`);
  return null;
}

/**
 * Fetch price from a single API endpoint
 * (Copied from lt_trader_queue/worker.js for reusability)
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
 * (Copied from lt_trader_queue/worker.js for reusability)
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

/**
 * Get prices for multiple tokens at once
 *
 * @param {Object} db - D1 database instance
 * @param {Array<string>} tokenSymbols - Array of token symbols
 * @param {string} quoteSymbol - Quote symbol (default: "USDC")
 * @param {number} timeRangeMinutes - Time range for cached price lookup (default: 5)
 * @returns {Promise<Map<string, Object>>} Map of tokenSymbol -> price object
 */
export async function getBulkTokenPricesUSDC(db, tokenSymbols, quoteSymbol = 'USDC', timeRangeMinutes = 5) {
  const priceMap = new Map();

  // Fetch all prices in parallel
  const fetchPromises = tokenSymbols.map(async (tokenSymbol) => {
    const priceData = await getTokenPriceUSDC(db, tokenSymbol, quoteSymbol, timeRangeMinutes);
    if (priceData) {
      priceMap.set(tokenSymbol, priceData);
    }
  });

  await Promise.all(fetchPromises);

  return priceMap;
}
