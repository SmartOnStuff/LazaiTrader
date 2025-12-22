/**
 * LazaiSwap DEX Handler
 *
 * Handles oracle price updates and swap execution for LazaiSwap DEX.
 * LazaiSwap uses a simple swap(tokenIn, amountIn) interface with
 * oracle-based pricing that needs to be updated before each trade.
 */

import { ethers } from 'ethers';

// ============================================
// ABIs
// ============================================

const LAZAISWAP_DEX_ABI = [
  'function swap(address tokenInAddr, uint256 amountIn)',
  'function setPrices(uint256 _baseToQuote, uint256 _quoteToBase)'
];

// ============================================
// ORACLE PRICE UPDATE
// ============================================

/**
 * Calculate oracle prices from USD price
 * Both tokens are 18 decimals, contract expects 1e18 scaling for price ratios
 */
function calculateOraclePrices(priceUSD) {
  // Price base to quote (e.g., ETH price in USDC terms)
  const priceBaseToQuote = BigInt(Math.floor(priceUSD * 1e18));
  // Price quote to base (inverse)
  const priceQuoteToBase = BigInt(Math.floor((1 / priceUSD) * 1e18));

  return { priceBaseToQuote, priceQuoteToBase };
}

/**
 * Update DEX oracle prices before executing trade
 * This ensures the DEX has accurate prices for the swap
 *
 * @param {ethers.Wallet} oracleOwnerWallet - Wallet with permission to update oracle
 * @param {string} dexAddress - LazaiSwap DEX contract address
 * @param {number} priceUSD - Current USD price of base token
 * @returns {Object} Result with success, txHash, and price values
 */
export async function updateOraclePrices(
  oracleOwnerWallet,
  dexAddress,
  priceUSD
) {
  const { priceBaseToQuote, priceQuoteToBase } = calculateOraclePrices(priceUSD);

  const dex = new ethers.Contract(dexAddress, LAZAISWAP_DEX_ABI, oracleOwnerWallet);

  console.log(`[LAZAISWAP:ORACLE] Updating prices: baseToQuote=${priceBaseToQuote}, quoteToBase=${priceQuoteToBase}`);

  const tx = await dex.setPrices(priceBaseToQuote, priceQuoteToBase, {
    gasLimit: 200000
  });

  const receipt = await tx.wait();

  return {
    success: receipt.status === 1,
    txHash: receipt.hash,
    priceBaseToQuote: priceBaseToQuote.toString(),
    priceQuoteToBase: priceQuoteToBase.toString()
  };
}

/**
 * Execute swap on LazaiSwap DEX through SCW
 *
 * @param {ethers.Contract} scwContract - SCW contract instance connected to bot wallet
 * @param {string} dexAddress - LazaiSwap DEX contract address
 * @param {string} tokenInAddress - Address of token being sold
 * @param {BigInt} amountInWei - Amount to swap in wei
 * @returns {Object} Result with success, txHash, and gasUsed
 */
export async function executeSwap(
  scwContract,
  dexAddress,
  tokenInAddress,
  amountInWei
) {
  console.log(`[LAZAISWAP:EXECUTE] DEX: ${dexAddress}`);
  console.log(`[LAZAISWAP:EXECUTE] Token In: ${tokenInAddress}`);
  console.log(`[LAZAISWAP:EXECUTE] Amount Wei: ${amountInWei.toString()}`);

  // Encode swap call data using ABI coder directly
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  const swapSelector = ethers.id('swap(address,uint256)').slice(0, 10); // Function selector
  const encodedParams = abiCoder.encode(
    ['address', 'uint256'],
    [tokenInAddress, amountInWei]
  );
  const swapData = swapSelector + encodedParams.slice(2); // Remove '0x' from params

  console.log(`[LAZAISWAP:EXECUTE] Swap selector: ${swapSelector}`);
  console.log(`[LAZAISWAP:EXECUTE] Swap data length: ${swapData.length}`);

  // Execute trade through SCW
  const tx = await scwContract.executeTrade(dexAddress, swapData, {
    gasLimit: 500000
  });

  console.log(`[LAZAISWAP:EXECUTE] TX Hash: ${tx.hash}`);

  const receipt = await tx.wait();

  return {
    success: receipt.status === 1,
    txHash: receipt.hash,
    gasUsed: receipt.gasUsed.toString()
  };
}

/**
 * Get DEX handler info
 */
export function getInfo() {
  return {
    name: 'LazaiSwap',
    type: 'LazaiSwap',
    description: 'Simple oracle-based DEX with setPrices + swap interface',
    requiresOracleUpdate: true
  };
}
