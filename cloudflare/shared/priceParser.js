/**
 * Shared Price Parser Utility
 *
 * Handles parsing of API responses using configurable schemas stored in database.
 * Supports various response formats without code changes.
 */

/**
 * Parse price from API response using schema configuration
 *
 * @param {Object} data - The JSON response from the API
 * @param {string|Object} schemaOrProvider - Either ResponseSchema JSON string or legacy provider name
 * @returns {number|null} - Parsed price or null if parsing fails
 */
export function parsePrice(data, schemaOrProvider) {
  try {
    // Handle legacy provider-based parsing for backwards compatibility
    if (typeof schemaOrProvider === 'string' && !schemaOrProvider.startsWith('{')) {
      return parsePriceLegacy(schemaOrProvider, data);
    }

    // Parse schema if it's a JSON string
    const schema = typeof schemaOrProvider === 'string'
      ? JSON.parse(schemaOrProvider)
      : schemaOrProvider;

    if (!schema || !schema.pricePath) {
      console.error('[PRICE PARSER] Invalid schema: missing pricePath');
      return null;
    }

    // Parse using schema path
    const price = extractValueByPath(data, schema.pricePath);

    if (price === null || price === undefined) {
      console.error(`[PRICE PARSER] Failed to extract price using path: ${schema.pricePath}`);
      return null;
    }

    const numericPrice = parseFloat(price);

    if (isNaN(numericPrice) || numericPrice <= 0) {
      console.error(`[PRICE PARSER] Invalid price value: ${price}`);
      return null;
    }

    return numericPrice;

  } catch (e) {
    console.error(`[PRICE PARSER] Parsing error: ${e.message}`);
    return null;
  }
}

/**
 * Extract value from nested object using dot-notation path
 * Supports:
 * - Simple paths: "price"
 * - Nested paths: "data.amount"
 * - Dynamic keys: "*.usd" (gets first key's value, then navigates to 'usd')
 * - Array indices: "pairs.0.priceUsd"
 *
 * @param {Object} obj - The object to extract from
 * @param {string} path - The path to the value
 * @returns {any|null} - The extracted value or null
 */
function extractValueByPath(obj, path) {
  if (!obj || !path) return null;

  const parts = path.split('.');
  let current = obj;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];

    if (current === null || current === undefined) {
      return null;
    }

    // Handle dynamic key (wildcard)
    if (part === '*') {
      const keys = Object.keys(current);
      if (keys.length === 0) return null;
      current = current[keys[0]]; // Get first key's value
      continue;
    }

    // Handle array index
    if (/^\d+$/.test(part)) {
      const index = parseInt(part, 10);
      if (!Array.isArray(current) || index >= current.length) {
        return null;
      }
      current = current[index];
      continue;
    }

    // Handle regular property
    if (!current.hasOwnProperty(part)) {
      return null;
    }

    current = current[part];
  }

  return current;
}

/**
 * Legacy provider-based parsing (for backwards compatibility)
 *
 * @param {string} provider - Provider name (binance, coinbase, etc)
 * @param {Object} data - API response data
 * @returns {number|null} - Parsed price or null
 */
function parsePriceLegacy(provider, data) {
  try {
    switch (provider.toLowerCase()) {
      case 'binance':
        return parseFloat(data.price);

      case 'coinbase':
        return parseFloat(data.data?.amount);

      case 'coingecko':
        // CoinGecko returns { ethereum: { usd: 3000 } } format
        const keys = Object.keys(data);
        if (keys.length > 0) {
          const tokenData = data[keys[0]];
          const priceKeys = Object.keys(tokenData);
          if (priceKeys.length > 0) {
            return parseFloat(tokenData[priceKeys[0]]);
          }
        }
        return null;

      case 'dexscreener':
        // DEXScreener returns pairs array
        if (data.pairs && data.pairs.length > 0) {
          return parseFloat(data.pairs[0].priceUsd);
        }
        return null;

      default:
        // Try common formats
        if (data.price) return parseFloat(data.price);
        if (data.last) return parseFloat(data.last);
        if (data.result?.price) return parseFloat(data.result.price);
        return null;
    }
  } catch (e) {
    console.error(`[PRICE PARSER LEGACY] Failed to parse price from ${provider}:`, e);
    return null;
  }
}

/**
 * Validate and test a response schema against sample data
 *
 * @param {Object} sampleData - Sample API response
 * @param {Object} schema - Response schema to test
 * @returns {Object} - {valid: boolean, price: number|null, error: string|null}
 */
export function validateSchema(sampleData, schema) {
  try {
    const price = parsePrice(sampleData, schema);

    if (price === null) {
      return {
        valid: false,
        price: null,
        error: 'Failed to extract price from sample data'
      };
    }

    if (isNaN(price) || price <= 0) {
      return {
        valid: false,
        price,
        error: `Invalid price value: ${price}`
      };
    }

    return {
      valid: true,
      price,
      error: null
    };

  } catch (e) {
    return {
      valid: false,
      price: null,
      error: e.message
    };
  }
}
