// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title LazaiTradingWallet
 * @notice Simplified non-custodial smart contract wallet for automated trading
 * @dev Bot operator has full control, owner is for record-keeping and receives withdrawals
 */
contract LazaiTradingWallet is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // Immutable addresses set at creation
    address public immutable owner;           // User's EOA (receives withdrawals only)
    address public immutable botOperator;     // Bot wallet (full control)
    address public immutable factory;         // Factory contract (for DEX whitelist)
    
    // Events
    event TradeExecuted(address indexed dex, address indexed token, uint256 amount);
    event FundsWithdrawn(address indexed token, uint256 amount, address indexed to);
    event NativeWithdrawn(uint256 amount, address indexed to);

    // Errors
    error UnauthorizedOperator();
    error DEXNotWhitelisted();
    error TransferFailed();
    error ZeroAddress();
    error InsufficientBalance();

    /**
     * @notice Initialize the wallet
     * @param _owner The owner address (user's EOA - receives funds only)
     * @param _botOperator The bot operator address (full control)
     * @param _factory The factory contract address (manages DEX whitelist)
     */
    constructor(address _owner, address _botOperator, address _factory) {
        if (_owner == address(0) || _botOperator == address(0) || _factory == address(0)) 
            revert ZeroAddress();
        
        owner = _owner;
        botOperator = _botOperator;
        factory = _factory;
    }

    /**
     * @notice Modifier to restrict access to bot operator only
     */
    modifier onlyBotOperator() {
        if (msg.sender != botOperator) revert UnauthorizedOperator();
        _;
    }

    /**
     * @notice Modifier to check if DEX is whitelisted (checks factory)
     */
    modifier onlyWhitelistedDEX(address dex) {
        // Query factory for DEX whitelist status
        (bool success, bytes memory data) = factory.staticcall(
            abi.encodeWithSignature("isDEXWhitelisted(address)", dex)
        );
        
        if (!success || !abi.decode(data, (bool))) {
            revert DEXNotWhitelisted();
        }
        _;
    }

    /**
     * @notice Execute trade on whitelisted DEX (bot operator only)
     * @param _dex DEX address
     * @param _data Encoded function call data
     * @return success Whether the call succeeded
     * @return returnData Data returned from the call
     */
    function executeTrade(
        address _dex,
        bytes calldata _data
    ) 
        external 
        onlyBotOperator 
        onlyWhitelistedDEX(_dex) 
        nonReentrant 
        returns (bool success, bytes memory returnData) 
    {
        (success, returnData) = _dex.call(_data);
        if (!success) revert TransferFailed();
        emit TradeExecuted(_dex, address(0), 0);
    }

    /**
     * @notice Approve token spending for whitelisted DEX (bot operator only)
     * @param _token Token address
     * @param _dex DEX address
     * @param _amount Amount to approve
     */
    function approveToken(
        address _token,
        address _dex,
        uint256 _amount
    ) 
        external 
        onlyBotOperator 
        onlyWhitelistedDEX(_dex) 
    {
        IERC20(_token).approve(_dex, 0); // Reset approval first
        IERC20(_token).approve(_dex, _amount);
    }

    /**
     * @notice Modifier to restrict access to bot operator OR owner
     */
    modifier onlyBotOrOwner() {
        if (msg.sender != botOperator && msg.sender != owner) revert UnauthorizedOperator();
        _;
    }

    /**
     * @notice Withdraw all ERC20 tokens to owner (bot or owner can initiate, funds go to owner)
     * @param _token Token address
     */
    function withdrawAllTokens(address _token) external onlyBotOrOwner nonReentrant {
        if (_token == address(0)) revert ZeroAddress();
        
        uint256 balance = IERC20(_token).balanceOf(address(this));
        if (balance == 0) revert InsufficientBalance();
        
        IERC20(_token).safeTransfer(owner, balance);
        emit FundsWithdrawn(_token, balance, owner);
    }

    /**
     * @notice Withdraw all native tokens to owner (bot or owner can initiate, funds go to owner)
     */
    function withdrawAllNative() external onlyBotOrOwner nonReentrant {
        uint256 balance = address(this).balance;
        if (balance == 0) revert InsufficientBalance();
        
        (bool success, ) = payable(owner).call{value: balance}("");
        if (!success) revert TransferFailed();
        
        emit NativeWithdrawn(balance, owner);
    }

    /**
     * @notice Withdraw all funds (both native and specific token) to owner
     * @param _token Token address to withdraw (use address(0) to skip token withdrawal)
     */
    function withdrawAll(address _token) external onlyBotOrOwner nonReentrant {
        // Withdraw native balance
        uint256 nativeBalance = address(this).balance;
        if (nativeBalance > 0) {
            (bool success, ) = payable(owner).call{value: nativeBalance}("");
            if (!success) revert TransferFailed();
            emit NativeWithdrawn(nativeBalance, owner);
        }
        
        // Withdraw token balance if specified
        if (_token != address(0)) {
            uint256 tokenBalance = IERC20(_token).balanceOf(address(this));
            if (tokenBalance > 0) {
                IERC20(_token).safeTransfer(owner, tokenBalance);
                emit FundsWithdrawn(_token, tokenBalance, owner);
            }
        }
    }

    /**
     * @notice Get token balance
     * @param _token Token address
     * @return balance Token balance
     */
    function getTokenBalance(address _token) external view returns (uint256 balance) {
        return IERC20(_token).balanceOf(address(this));
    }

    /**
     * @notice Get native balance
     * @return balance Native token balance
     */
    function getNativeBalance() external view returns (uint256 balance) {
        return address(this).balance;
    }

    /**
     * @notice Check if address is whitelisted DEX (queries factory)
     * @param _dex DEX address to check
     * @return bool Whitelist status
     */
    function isDEXWhitelisted(address _dex) external view returns (bool) {
        (bool success, bytes memory data) = factory.staticcall(
            abi.encodeWithSignature("isDEXWhitelisted(address)", _dex)
        );
        
        if (!success) return false;
        return abi.decode(data, (bool));
    }

    /**
     * @notice Receive native tokens
     */
    receive() external payable {}

    /**
     * @notice Fallback function
     */
    fallback() external payable {}
}