/**
 * Camelot Yak Router DEX Handler
 *
 * Handles swap execution through Camelot's Yak Router aggregator.
 * Yak Router finds optimal swap paths across multiple DEXes.
 * No oracle update needed - uses real market prices from liquidity pools.
 */

import { ethers } from 'ethers';

// ============================================
// ABIs
// ============================================

// Yak Router interface for finding best swap path and executing
const YAK_ROUTER_ABI = [
  // Query for best swap path - returns amounts, adapters, path, AND recipients
  'function findBestPath(uint256 _amountIn, address _tokenIn, address _tokenOut, address[] _trustedTokens, uint256 _maxSteps) view returns (tuple(uint256[] amounts, address[] adapters, address[] path, address[] recipients))',
  // Execute swap with no splits - takes complete trade struct with recipients
  'function swapNoSplit(tuple(uint256 amountIn, uint256 amountOut, address[] path, address[] adapters, address[] recipients) _trade, uint256 _fee, address _to) returns ()'
];

// ERC20 ABI for checking allowances
const ERC20_ABI = [
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)'
];

// ============================================
// QUERY FUNCTIONS
// ============================================

/**
 * Find the best swap path using Yak Router
 *
 * @param {ethers.Provider} provider - Ethereum provider
 * @param {string} routerAddress - Yak Router contract address
 * @param {BigInt} amountIn - Amount to swap in wei
 * @param {string} tokenIn - Input token address
 * @param {string} tokenOut - Output token address
 * @param {number} maxSteps - Maximum number of hops (default 3)
 * @returns {Object} Best path with amounts, adapters, path, and recipients
 */
export async function findBestPath(
  provider,
  routerAddress,
  amountIn,
  tokenIn,
  tokenOut,
  maxSteps = 3
) {
  const router = new ethers.Contract(routerAddress, YAK_ROUTER_ABI, provider);

  console.log(`[CAMELOT:QUERY] Finding best path for ${amountIn} from ${tokenIn} to ${tokenOut}`);

  try {
    // Call with empty trustedTokens array - router will use defaults
    const result = await router.findBestPath(amountIn, tokenIn, tokenOut, [], maxSteps);

    console.log(`[CAMELOT:QUERY] Raw result from findBestPath:`);
    console.log(`[CAMELOT:QUERY]   amounts: ${result.amounts ? result.amounts.length : 'undefined'} items`);
    console.log(`[CAMELOT:QUERY]   adapters: ${result.adapters ? result.adapters.length : 'undefined'} items`);
    console.log(`[CAMELOT:QUERY]   path: ${result.path ? result.path.length : 'undefined'} items`);
    console.log(`[CAMELOT:QUERY]   recipients: ${result.recipients ? result.recipients.length : 'undefined'} items`);

    // Validate result has required fields
    if (!result.amounts || !result.adapters || !result.path) {
      console.error(`[CAMELOT:QUERY] Router returned incomplete data`);
      return {
        success: false,
        error: 'Router findBestPath returned incomplete data'
      };
    }

    // Check if recipients exists - some router versions may not return it
    if (!result.recipients) {
      console.warn(`[CAMELOT:QUERY] WARNING: Router did not return recipients array`);
      console.warn(`[CAMELOT:QUERY] This may indicate an ABI mismatch with the deployed contract`);
    }

    return {
      success: true,
      amounts: result.amounts.map(a => a.toString()),
      adapters: result.adapters,
      path: result.path,
      recipients: result.recipients || [],  // Fallback to empty array if missing
      amountOut: result.amounts[result.amounts.length - 1]
    };
  } catch (error) {
    console.error(`[CAMELOT:QUERY] Failed to find path: ${error.message}`);
    console.error(`[CAMELOT:QUERY] Error code: ${error.code || 'N/A'}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * No oracle update needed for Camelot Yak Router
 * Uses real market prices from liquidity pools
 */
export async function updateOraclePrices() {
  // Yak Router doesn't need oracle updates - it uses real pool prices
  console.log(`[CAMELOT:ORACLE] No oracle update needed - using real market prices`);
  return {
    success: true,
    txHash: null,
    message: 'Yak Router uses real market prices, no oracle update needed'
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Check and approve token allowance if needed
 *
 * @param {ethers.Contract} scwContract - SCW contract instance
 * @param {ethers.Provider} provider - Ethereum provider
 * @param {string} tokenAddress - Token to approve
 * @param {string} spenderAddress - Spender (YakRouter)
 * @param {BigInt} amountNeeded - Amount needed for swap
 * @returns {Object} Result with success and optional txHash
 */
async function checkAndApproveAllowance(
  scwContract,
  provider,
  tokenAddress,
  spenderAddress,
  amountNeeded
) {
  const scwAddress = await scwContract.getAddress();
  const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);

  console.log(`[CAMELOT:APPROVAL] Checking allowance for ${tokenAddress}`);

  try {
    // Check current allowance
    const currentAllowance = await tokenContract.allowance(scwAddress, spenderAddress);

    console.log(`[CAMELOT:APPROVAL] Current: ${currentAllowance.toString()}`);
    console.log(`[CAMELOT:APPROVAL] Needed: ${amountNeeded.toString()}`);

    // If allowance is sufficient, no need to approve
    if (currentAllowance >= amountNeeded) {
      console.log(`[CAMELOT:APPROVAL] Sufficient allowance, skipping approval`);
      return {
        success: true,
        txHash: null,
        message: 'Sufficient allowance'
      };
    }

    // Need to approve - use max approval to avoid repeated approvals
    const maxApproval = ethers.MaxUint256;

    console.log(`[CAMELOT:APPROVAL] Approving max amount via SCW.approveToken()`);

    const tx = await scwContract.approveToken(tokenAddress, spenderAddress, maxApproval, {
      gasLimit: 150000
    });

    console.log(`[CAMELOT:APPROVAL] TX Hash: ${tx.hash}`);

    const receipt = await tx.wait();

    if (receipt.status === 1) {
      console.log(`[CAMELOT:APPROVAL] Approval successful`);
      return {
        success: true,
        txHash: receipt.hash,
        message: 'Approval successful'
      };
    } else {
      console.error(`[CAMELOT:APPROVAL] Approval transaction failed`);
      return {
        success: false,
        error: 'Approval transaction failed'
      };
    }
  } catch (error) {
    console.error(`[CAMELOT:APPROVAL] Failed: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

// ============================================
// EXECUTION FUNCTIONS
// ============================================

/**
 * Execute swap on Camelot via Yak Router through SCW
 *
 * Flow:
 * 1. Query findBestPath if not provided
 * 2. Check and approve token allowance if needed
 * 3. Build Trade struct with path data
 * 4. Encode swapNoSplit call
 * 5. Execute via SCW.executeTrade()
 *
 * @param {ethers.Contract} scwContract - SCW contract instance connected to bot wallet
 * @param {string} routerAddress - Yak Router contract address
 * @param {string} tokenInAddress - Address of token being sold
 * @param {string} tokenOutAddress - Address of token being bought
 * @param {BigInt} amountInWei - Amount to swap in wei
 * @param {number} slippageBps - Slippage tolerance in basis points (e.g., 50 = 0.5%)
 * @param {Object} pathInfo - Optional pre-queried path info from findBestPath
 * @returns {Object} Result with success, txHash, gasUsed, and optional approvalTxHash
 */
export async function executeSwap(
  scwContract,
  routerAddress,
  tokenInAddress,
  tokenOutAddress,
  amountInWei,
  slippageBps = 50,
  pathInfo = null
) {
  console.log(`[CAMELOT:EXECUTE] ═══════════════════════════════════════`);
  console.log(`[CAMELOT:EXECUTE] Router: ${routerAddress}`);
  console.log(`[CAMELOT:EXECUTE] Token In: ${tokenInAddress}`);
  console.log(`[CAMELOT:EXECUTE] Token Out: ${tokenOutAddress}`);
  console.log(`[CAMELOT:EXECUTE] Amount Wei: ${amountInWei.toString()}`);
  console.log(`[CAMELOT:EXECUTE] Slippage: ${slippageBps} bps`);

  const provider = scwContract.runner.provider;
  const scwAddress = await scwContract.getAddress();

  // Step 1: Get best path if not provided
  let offer = pathInfo;
  if (!offer || !offer.amounts || !offer.adapters || !offer.path || offer.recipients === undefined) {
    console.log(`[CAMELOT:EXECUTE] No path info provided, querying findBestPath...`);
    offer = await findBestPath(provider, routerAddress, amountInWei, tokenInAddress, tokenOutAddress);

    if (!offer.success) {
      console.error(`[CAMELOT:EXECUTE] Failed to find path: ${offer.error}`);
      return {
        success: false,
        error: `Failed to find swap path: ${offer.error}`
      };
    }
  }

  // Validate that offer has all required fields (arrays can be empty but must exist)
  if (!offer.amounts || !offer.adapters || !offer.path || !Array.isArray(offer.recipients)) {
    console.error(`[CAMELOT:EXECUTE] Invalid offer data - missing required fields`);
    console.error(`[CAMELOT:EXECUTE] Has amounts: ${!!offer.amounts} (length: ${offer.amounts?.length})`);
    console.error(`[CAMELOT:EXECUTE] Has adapters: ${!!offer.adapters} (length: ${offer.adapters?.length})`);
    console.error(`[CAMELOT:EXECUTE] Has path: ${!!offer.path} (length: ${offer.path?.length})`);
    console.error(`[CAMELOT:EXECUTE] Has recipients: ${Array.isArray(offer.recipients)} (length: ${offer.recipients?.length})`);
    return {
      success: false,
      error: 'Invalid path data from router - missing required fields'
    };
  }

  let expectedOutput = BigInt(offer.amountOut || offer.amounts[offer.amounts.length - 1]);

  console.log(`[CAMELOT:EXECUTE] Expected output: ${expectedOutput.toString()}`);
  console.log(`[CAMELOT:EXECUTE] Path: ${offer.path.join(' → ')}`);
  console.log(`[CAMELOT:EXECUTE] Adapters: ${offer.adapters.length} hop(s)`);
  console.log(`[CAMELOT:EXECUTE] Recipients: ${offer.recipients.length} recipient(s)`);

  // Step 2: Check and approve allowance if needed
  const approvalResult = await checkAndApproveAllowance(
    scwContract,
    provider,
    tokenInAddress,
    routerAddress,
    amountInWei
  );

  if (!approvalResult.success) {
    console.error(`[CAMELOT:EXECUTE] Approval failed: ${approvalResult.error}`);
    return {
      success: false,
      error: `Token approval failed: ${approvalResult.error}`
    };
  }

  // Step 2b: Re-query path after approval to get fresh market data
  // This prevents stale path data from causing reverts due to price movements
  console.log(`[CAMELOT:EXECUTE] Re-querying path for fresh market data...`);
  const freshOffer = await findBestPath(provider, routerAddress, amountInWei, tokenInAddress, tokenOutAddress);

  if (!freshOffer.success) {
    console.error(`[CAMELOT:EXECUTE] Failed to re-query path: ${freshOffer.error}`);
    // Fall back to original offer if re-query fails
    console.log(`[CAMELOT:EXECUTE] Using original path data as fallback`);
  } else {
    // Use fresh path data
    console.log(`[CAMELOT:EXECUTE] Using fresh path data`);
    console.log(`[CAMELOT:EXECUTE] Original expected output: ${expectedOutput.toString()}`);
    const freshExpectedOutput = BigInt(freshOffer.amountOut || freshOffer.amounts[freshOffer.amounts.length - 1]);
    console.log(`[CAMELOT:EXECUTE] Fresh expected output: ${freshExpectedOutput.toString()}`);
    offer = freshOffer;
    expectedOutput = freshExpectedOutput;
  }

  // Step 3: Calculate min output with slippage
  const slippageMultiplier = BigInt(10000 - slippageBps);
  const minAmountOut = (expectedOutput * slippageMultiplier) / BigInt(10000);

  console.log(`[CAMELOT:EXECUTE] Min output (${slippageBps / 100}% slippage): ${minAmountOut.toString()}`);

  // Step 4: Build Trade struct
  // Trade = (amountIn, minAmountOut, path, adapters, recipients)
  // Convert string amounts back to BigInt for encoding
  const amounts = offer.amounts.map(a => BigInt(a));

  console.log(`[CAMELOT:EXECUTE] Building trade tuple with:`);
  console.log(`[CAMELOT:EXECUTE]   amountIn: ${amountInWei.toString()}`);
  console.log(`[CAMELOT:EXECUTE]   minAmountOut: ${minAmountOut.toString()}`);
  console.log(`[CAMELOT:EXECUTE]   path length: ${offer.path.length}`);
  console.log(`[CAMELOT:EXECUTE]   adapters length: ${offer.adapters.length}`);
  console.log(`[CAMELOT:EXECUTE]   recipients length: ${offer.recipients.length}`);

  const tradeTuple = [
    amountInWei,
    minAmountOut,
    offer.path,
    offer.adapters,
    offer.recipients
  ];

  // Step 5: Encode swapNoSplit call
  // swapNoSplit(Trade memory _trade, uint256 _fee, address _to)
  const yakRouter = new ethers.Contract(routerAddress, YAK_ROUTER_ABI, provider);

  let swapData;
  try {
    swapData = yakRouter.interface.encodeFunctionData('swapNoSplit', [
      tradeTuple,
      0,          // fee = 0
      scwAddress  // recipient = SCW
    ]);
  } catch (error) {
    console.error(`[CAMELOT:EXECUTE] Failed to encode swap data: ${error.message}`);
    return {
      success: false,
      error: `Failed to encode swap transaction: ${error.message}`
    };
  }

  // Validate swapData is not empty
  if (!swapData || swapData === '0x' || swapData.length <= 2) {
    console.error(`[CAMELOT:EXECUTE] Encoded swap data is empty or invalid!`);
    console.error(`[CAMELOT:EXECUTE] swapData: ${swapData}`);
    return {
      success: false,
      error: 'Encoded swap data is empty - encoding failed'
    };
  }

  console.log(`[CAMELOT:EXECUTE] Encoded swap data: ${swapData.length} bytes`);
  console.log(`[CAMELOT:EXECUTE] Swap data preview: ${swapData.substring(0, 66)}...`);

  // Step 6: Execute via SCW.executeTrade()
  try {
    console.log(`[CAMELOT:EXECUTE] Calling SCW.executeTrade with:`);
    console.log(`[CAMELOT:EXECUTE]   Router: ${routerAddress}`);
    console.log(`[CAMELOT:EXECUTE]   Data length: ${swapData.length} bytes`);
    console.log(`[CAMELOT:EXECUTE]   Data (first 66 chars): ${swapData.substring(0, 66)}`);

    // Final validation before sending transaction
    if (!swapData || swapData === '0x' || swapData.length <= 2) {
      throw new Error('SwapData became empty before executeTrade call');
    }

    const tx = await scwContract.executeTrade(routerAddress, swapData, {
      gasLimit: 500000 // Higher gas for complex multi-hop swaps
    });

    console.log(`[CAMELOT:EXECUTE] TX Hash: ${tx.hash}`);
    console.log(`[CAMELOT:EXECUTE] Waiting for confirmation...`);

    const receipt = await tx.wait();

    console.log(`[CAMELOT:EXECUTE] Receipt status: ${receipt.status}`);
    console.log(`[CAMELOT:EXECUTE] Gas used: ${receipt.gasUsed.toString()}`);
    console.log(`[CAMELOT:EXECUTE] ═══════════════════════════════════════`);

    if (receipt.status === 0) {
      console.error(`[CAMELOT:EXECUTE] Transaction reverted on-chain`);
      console.error(`[CAMELOT:EXECUTE] This may indicate:`);
      console.error(`[CAMELOT:EXECUTE]   - Insufficient token balance`);
      console.error(`[CAMELOT:EXECUTE]   - Slippage too tight`);
      console.error(`[CAMELOT:EXECUTE]   - Router address mismatch`);
      console.error(`[CAMELOT:EXECUTE]   - DEX liquidity issues`);
    }

    return {
      success: receipt.status === 1,
      txHash: receipt.hash,
      gasUsed: receipt.gasUsed.toString(),
      approvalTxHash: approvalResult.txHash || null
    };
  } catch (error) {
    console.error(`[CAMELOT:EXECUTE] Swap execution failed: ${error.message}`);
    console.error(`[CAMELOT:EXECUTE] Error code: ${error.code || 'N/A'}`);
    console.error(`[CAMELOT:EXECUTE] Error details:`, error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get DEX handler info
 */
export function getInfo() {
  return {
    name: 'CamelotYakRouter',
    type: 'CamelotYakRouter',
    description: 'Yak Router aggregator for optimal swap paths on Camelot',
    requiresOracleUpdate: false,
    supportsMultiHop: true,
    defaultSlippageBps: 50
  };
}
