/**
 * DEX Handler Registry
 *
 * Central module for routing to the appropriate DEX handler based on DEXType.
 * Add new DEX integrations by:
 * 1. Creating a new handler file in this directory
 * 2. Importing and registering it in DEX_HANDLERS below
 */

import * as lazaiswap from './lazaiswap.js';
import * as camelotYakRouter from './camelot_yak_router.js';

// ============================================
// DEX HANDLER REGISTRY
// ============================================

/**
 * Registry of all supported DEX handlers
 * Key must match the DEXType value in the TradingPairs table
 */
const DEX_HANDLERS = {
  'LazaiSwap': lazaiswap,
  'CamelotYakRouter': camelotYakRouter
};

// ============================================
// PUBLIC API
// ============================================

/**
 * Get the DEX handler for a given DEX type
 *
 * @param {string} dexType - DEXType value from TradingPairs table
 * @returns {Object|null} DEX handler module or null if not found
 */
export function getHandler(dexType) {
  const handler = DEX_HANDLERS[dexType];
  if (!handler) {
    console.error(`[DEX] Unknown DEX type: ${dexType}`);
    return null;
  }
  return handler;
}

/**
 * Check if a DEX type is supported
 *
 * @param {string} dexType - DEXType to check
 * @returns {boolean} True if supported
 */
export function isSupported(dexType) {
  return dexType in DEX_HANDLERS;
}

/**
 * Get list of all supported DEX types
 *
 * @returns {string[]} Array of supported DEX type names
 */
export function getSupportedTypes() {
  return Object.keys(DEX_HANDLERS);
}

/**
 * Get info for all supported DEX handlers
 *
 * @returns {Object[]} Array of handler info objects
 */
export function getAllHandlerInfo() {
  return Object.entries(DEX_HANDLERS).map(([type, handler]) => ({
    type,
    ...handler.getInfo()
  }));
}
