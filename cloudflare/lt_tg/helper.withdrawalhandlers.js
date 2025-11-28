/**
 * Withdrawal Handlers Module
 * Handles all withdrawal operations
 * 
 * Commands:
 * - /withdraw - Initiate withdrawal
 * 
 * Callbacks:
 * - withdraw_chain_{chainId} - Select chain and withdraw all tokens
 */

import { sendMessage, callBalanceWorker } from './worker.js';

export async function handleWithdraw(chatId, userId, env) {
  try {
    console.log(`[handleWithdraw] User ${userId} requested withdrawal`);
    
    const user = await env.DB.prepare(
      'SELECT UserID, UserWallet, SCWAddress FROM Users WHERE UserID = ?'
    ).bind(userId).first();

    if (!user) {
      await sendMessage(chatId, env, {
        text: '❌ You are not registered yet. Please use /start to register first.'
      });
      return;
    }

    if (!user.SCWAddress) {
      await sendMessage(chatId, env, {
        text: '❌ No Smart Contract Wallet found. Please use /deposit to create one first.'
      });
      return;
    }

    await sendMessage(chatId, env, {
      text: `⏳ *Fetching your balances...*\n\nQuerying blockchain networks...`,
      parse_mode: 'Markdown'
    });

    const balanceResult = await callBalanceWorker(userId, user.SCWAddress, env);

    if (!balanceResult.success) {
      await sendMessage(chatId, env, {
        text: `❌ *Error fetching balances*\n\n${balanceResult.error}`
      });
      return;
    }

    const chainsWithBalance = {};
    const chainIds = Object.keys(balanceResult.balances).sort((a, b) => parseInt(a) - parseInt(b));

    for (const chainId of chainIds) {
      const chain = balanceResult.balances[chainId];
      const tokensWithBalance = chain.tokens.filter(t => parseFloat(t.balanceFormatted) > 0);
      
      if (tokensWithBalance.length > 0) {
        const tokenSummary = tokensWithBalance.map(t => `${t.symbol}: ${t.balanceFormatted}`).join('\n');
        
        chainsWithBalance[chainId] = {
          chainName: chain.chainName,
          tokens: tokensWithBalance,
          tokenSummary: tokenSummary
        };
      }
    }

    if (Object.keys(chainsWithBalance).length === 0) {
      await sendMessage(chatId, env, {
        text: '💰 You have no tokens to withdraw.\n\nYour Smart Contract Wallet is empty.'
      });
      return;
    }

    let menuText = `💸 *Select a blockchain network to withdraw from:*\n\nAll tokens on the selected chain will be withdrawn to your wallet:\n\n`;
    
    for (const [chainId, chainData] of Object.entries(chainsWithBalance)) {
      menuText += `🔗 *${chainData.chainName}*\n${chainData.tokenSummary}\n\n`;
    }

    const keyboard = {
      inline_keyboard: Object.entries(chainsWithBalance).map(([chainId, chain]) => [
        {
          text: `💳 ${chain.chainName}`,
          callback_data: `withdraw_chain_${chainId}`
        }
      ])
    };

    await sendMessage(chatId, env, {
      text: menuText,
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  } catch (error) {
    console.error('Error in handleWithdraw:', error);
    await sendMessage(chatId, env, {
      text: '❌ An error occurred. Please try again later.'
    });
  }
}

export async function handleWithdrawChain(chatId, userId, chainId, env) {
  try {
    console.log(`[handleWithdrawChain] User ${userId} initiating withdrawal from chain ${chainId}`);
    
    const user = await env.DB.prepare(
      'SELECT UserWallet, SCWAddress FROM Users WHERE UserID = ?'
    ).bind(userId).first();

    if (!user || !user.SCWAddress) {
      await sendMessage(chatId, env, {
        text: '❌ No Smart Contract Wallet found.'
      });
      return;
    }

    const chain = await env.DB.prepare(
      'SELECT ChainName, RPCEndpoint, ExplorerURL FROM Chains WHERE ChainID = ?'
    ).bind(chainId).first();

    if (!chain) {
      await sendMessage(chatId, env, {
        text: '❌ Chain not found.'
      });
      return;
    }

    await sendMessage(chatId, env, {
      text: `⏳ *Processing Withdrawal*\n\n🔗 Chain: ${chain.ChainName}\n\nFetching balances and executing withdrawals...`,
      parse_mode: 'Markdown'
    });

    const balanceResult = await callBalanceWorker(userId, user.SCWAddress, env);

    if (!balanceResult.success) {
      await sendMessage(chatId, env, {
        text: `❌ *Could not fetch balances*\n\n${balanceResult.error}`
      });
      return;
    }

    const chainBalance = balanceResult.balances[chainId];
    if (!chainBalance) {
      await sendMessage(chatId, env, {
        text: `❌ No tokens found on this chain.`
      });
      return;
    }

    const tokensToWithdraw = chainBalance.tokens.filter(t => t.balance !== '0' && parseFloat(t.balanceFormatted) > 0);
    
    if (tokensToWithdraw.length === 0) {
      await sendMessage(chatId, env, {
        text: `❌ No tokens with balance on ${chain.ChainName}.`
      });
      return;
    }

    console.log(`[handleWithdrawChain] Found ${tokensToWithdraw.length} tokens to withdraw on chain ${chainId}`);

    let successCount = 0;
    let failureCount = 0;
    const withdrawalSummary = [];
    let txHashes = [];

    for (const token of tokensToWithdraw) {
      try {
        console.log(`[handleWithdrawChain] Withdrawing ${token.symbol}: ${token.balanceFormatted}`);

        const withdrawalResult = await callWithdrawalWorker(
          userId,
          user.UserWallet,
          user.SCWAddress,
          token.tokenAddress,
          chainId,
          chain.RPCEndpoint,
          env
        );

        if (withdrawalResult.success) {
          successCount++;
          txHashes.push(withdrawalResult.txHash);
          withdrawalSummary.push({
            symbol: token.symbol,
            amount: token.balanceFormatted,
            txHash: withdrawalResult.txHash,
            success: true
          });
        } else {
          failureCount++;
          withdrawalSummary.push({
            symbol: token.symbol,
            amount: token.balanceFormatted,
            error: withdrawalResult.error,
            success: false
          });
        }
      } catch (tokenError) {
        console.error(`[handleWithdrawChain] Error withdrawing ${token.symbol}:`, tokenError);
        failureCount++;
        withdrawalSummary.push({
          symbol: token.symbol,
          amount: token.balanceFormatted,
          error: tokenError.message,
          success: false
        });
      }
    }

    try {
      console.log(`[handleWithdrawChain] Withdrawing native balance`);
      const nativeResult = await callWithdrawalWorker(
        userId,
        user.UserWallet,
        user.SCWAddress,
        '0x0000000000000000000000000000000000000000',
        chainId,
        chain.RPCEndpoint,
        env
      );

      if (nativeResult.success) {
        txHashes.push(nativeResult.txHash);
        withdrawalSummary.push({
          symbol: `${chain.NativeCurrency || 'Native'}`,
          isNative: true,
          txHash: nativeResult.txHash,
          success: true
        });
      }
    } catch (nativeError) {
      console.error(`[handleWithdrawChain] Error withdrawing native:`, nativeError);
    }

    if (successCount > 0) {
      let responseText = `✅ *Withdrawal Complete*\n\n`;
      responseText += `🔗 *Chain:* ${chain.ChainName}\n`;
      responseText += `📍 *To:* \`${user.UserWallet}\`\n\n`;
      
      responseText += `💸 *Successful Withdrawals:*\n`;
      withdrawalSummary.filter(w => w.success).forEach(w => {
        const symbol = w.isNative ? (chain.NativeCurrency || 'Native') : w.symbol;
        const amount = w.amount || '(native balance)';
        responseText += `• ${symbol}: ${amount}\n  🔗 [View](${buildTransactionLink(chain.ExplorerURL, w.txHash)})\n`;
      });

      if (failureCount > 0) {
        responseText += `\n⚠️ *Failed Withdrawals:*\n`;
        withdrawalSummary.filter(w => !w.success).forEach(w => {
          responseText += `• ${w.symbol}: ${w.error}\n`;
        });
      }

      responseText += `\nYour funds will arrive shortly.`;

      await sendMessage(chatId, env, {
        text: responseText,
        parse_mode: 'Markdown'
      });
    } else {
      let errorText = `❌ *Withdrawal Failed*\n\n`;
      errorText += `🔗 *Chain:* ${chain.ChainName}\n\n`;
      errorText += `*Errors:*\n`;
      withdrawalSummary.forEach(w => {
        errorText += `• ${w.symbol}: ${w.error}\n`;
      });
      errorText += `\n📧 *Contact Support:*\n• @LazaiTraderDev\n• support@lazaitrader.com`;

      await sendMessage(chatId, env, {
        text: errorText,
        parse_mode: 'Markdown'
      });
    }

  } catch (error) {
    console.error('Error in handleWithdrawChain:', error);
    await sendMessage(chatId, env, {
      text: '❌ An error occurred. Please try again later.'
    });
  }
}

async function callWithdrawalWorker(userId, userWallet, scwAddress, tokenAddress, chainId, rpcUrl, env) {
  try {
    const response = await env.WITHDRAWAL_WORKER.fetch('https://internal/withdraw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: userId,
        userWallet: userWallet,
        scwAddress: scwAddress,
        tokenAddress: tokenAddress,
        chainId: chainId,
        rpcUrl: rpcUrl
      })
    });

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error calling withdrawal worker:', error);
    return {
      success: false,
      error: error.message,
      errorCode: 'WORKER_ERROR'
    };
  }
}

function buildTransactionLink(explorerURL, txHash) {
  if (!explorerURL) {
    return `https://etherscan.io/tx/${txHash}`;
  }

  const baseURL = explorerURL.replace(/\/$/, '');

  if (baseURL.includes('etherscan')) {
    return `${baseURL}/tx/${txHash}`;
  } else if (baseURL.includes('explorer')) {
    return `${baseURL}/tx/${txHash}`;
  } else if (baseURL.includes('scan')) {
    return `${baseURL}/tx/${txHash}`;
  } else {
    return `${baseURL}/tx/${txHash}`;
  }
}