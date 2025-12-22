/**
 * Test script for price parser with real API response samples
 *
 * Run with: node test_price_parser.js
 */

import { parsePrice, validateSchema } from './priceParser.js';

// Sample API responses (from user's test data)
const testCases = [
  {
    name: 'Binance ETH-USDC',
    provider: 'binance',
    schema: { pricePath: 'price', format: 'simple' },
    response: { symbol: 'ETHUSDC', price: '2927.54000000' },
    expectedPrice: 2927.54
  },
  {
    name: 'Binance ETH-BTC',
    provider: 'binance',
    schema: { pricePath: 'price', format: 'simple' },
    response: { symbol: 'ETHBTC', price: '0.03399000' },
    expectedPrice: 0.03399
  },
  {
    name: 'Binance BTC-USDC',
    provider: 'binance',
    schema: { pricePath: 'price', format: 'simple' },
    response: { symbol: 'BTCUSDC', price: '86101.83000000' },
    expectedPrice: 86101.83
  },
  {
    name: 'Coinbase ETH-USDC',
    provider: 'coinbase',
    schema: { pricePath: 'data.amount', format: 'nested' },
    response: { data: { amount: '2931.735', base: 'ETH', currency: 'USDC' } },
    expectedPrice: 2931.735
  },
  {
    name: 'Coinbase ETH-BTC',
    provider: 'coinbase',
    schema: { pricePath: 'data.amount', format: 'nested' },
    response: { data: { amount: '0.033995', base: 'ETH', currency: 'BTC' } },
    expectedPrice: 0.033995
  },
  {
    name: 'CoinGecko ETH-USD',
    provider: 'coingecko',
    schema: { pricePath: '*.usd', format: 'dynamic_key' },
    response: { ethereum: { usd: 2931.27 } },
    expectedPrice: 2931.27
  },
  {
    name: 'DexScreener METIS-USDC',
    provider: 'dexscreener',
    schema: { pricePath: 'pairs.0.priceUsd', format: 'array' },
    response: {
      schemaVersion: '1.0.0',
      pairs: [
        {
          chainId: 'metis',
          dexId: 'netswap',
          priceUsd: '5.57',
          priceNative: '5.5754'
        }
      ]
    },
    expectedPrice: 5.57
  }
];

console.log('=== Price Parser Test Suite ===\n');

let passed = 0;
let failed = 0;

for (const testCase of testCases) {
  console.log(`Testing: ${testCase.name}`);

  // Test with schema
  const priceFromSchema = parsePrice(testCase.response, testCase.schema);
  const schemaMatches = Math.abs(priceFromSchema - testCase.expectedPrice) < 0.0001;

  console.log(`  Schema-based parsing: ${priceFromSchema} (expected: ${testCase.expectedPrice})`);
  console.log(`  Schema: ${JSON.stringify(testCase.schema)}`);

  // Test with legacy provider name
  const priceFromProvider = parsePrice(testCase.response, testCase.provider);
  const providerMatches = Math.abs(priceFromProvider - testCase.expectedPrice) < 0.0001;

  console.log(`  Legacy provider parsing: ${priceFromProvider} (expected: ${testCase.expectedPrice})`);

  // Validate schema
  const validation = validateSchema(testCase.response, testCase.schema);
  console.log(`  Schema validation: ${validation.valid ? '✓ VALID' : '✗ INVALID'}`);

  if (validation.error) {
    console.log(`  Error: ${validation.error}`);
  }

  const testPassed = schemaMatches && providerMatches && validation.valid;

  if (testPassed) {
    console.log(`  ✓ PASSED\n`);
    passed++;
  } else {
    console.log(`  ✗ FAILED\n`);
    failed++;
  }
}

console.log('=== Test Results ===');
console.log(`Passed: ${passed}/${testCases.length}`);
console.log(`Failed: ${failed}/${testCases.length}`);

if (failed === 0) {
  console.log('\n✓ All tests passed!');
  process.exit(0);
} else {
  console.log('\n✗ Some tests failed');
  process.exit(1);
}
