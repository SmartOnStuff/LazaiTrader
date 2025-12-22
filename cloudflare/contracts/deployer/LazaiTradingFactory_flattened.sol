// SPDX-License-Identifier: MIT
// Flattened LazaiTradingFactory with FactoryDeployer

// File: @openzeppelin/contracts/utils/Context.sol

// OpenZeppelin Contracts (last updated v5.0.1) (utils/Context.sol)

pragma solidity ^0.8.20;

/**
 * @dev Provides information about the current execution context, including the
 * sender of the transaction and its data. While these are generally available
 * via msg.sender and msg.data, they should not be accessed in such a direct
 * manner, since when dealing with meta-transactions the account sending and
 * paying for execution may not be the actual sender (as far as an application
 * is concerned).
 *
 * This contract is only required for intermediate, library-like contracts.
 */
abstract contract Context {
    function _msgSender() internal view virtual returns (address) {
        return msg.sender;
    }

    function _msgData() internal view virtual returns (bytes calldata) {
        return msg.data;
    }

    function _contextSuffixLength() internal view virtual returns (uint256) {
        return 0;
    }
}

// File: @openzeppelin/contracts/access/Ownable.sol

// OpenZeppelin Contracts (last updated v5.0.0) (access/Ownable.sol)

/**
 * @dev Contract module which provides a basic access control mechanism, where
 * there is an account (an owner) that can be granted exclusive access to
 * specific functions.
 *
 * The initial owner is set to the address provided by the deployer. This can
 * later be changed with {transferOwnership}.
 *
 * This module is used through inheritance. It will make available the modifier
 * `onlyOwner`, which can be applied to your functions to restrict their use to
 * the owner.
 */
abstract contract Ownable is Context {
    address private _owner;

    /**
     * @dev The caller account is not authorized to perform an operation.
     */
    error OwnableUnauthorizedAccount(address account);

    /**
     * @dev The owner is not a valid owner account. (eg. `address(0)`)
     */
    error OwnableInvalidOwner(address owner);

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /**
     * @dev Initializes the contract setting the address provided by the deployer as the initial owner.
     */
    constructor(address initialOwner) {
        if (initialOwner == address(0)) {
            revert OwnableInvalidOwner(address(0));
        }
        _transferOwnership(initialOwner);
    }

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyOwner() {
        _checkOwner();
        _;
    }

    /**
     * @dev Returns the address of the current owner.
     */
    function owner() public view virtual returns (address) {
        return _owner;
    }

    /**
     * @dev Throws if the sender is not the owner.
     */
    function _checkOwner() internal view virtual {
        if (owner() != _msgSender()) {
            revert OwnableUnauthorizedAccount(_msgSender());
        }
    }

    /**
     * @dev Leaves the contract without owner. It will not be possible to call
     * `onlyOwner` functions. Can only be called by the current owner.
     *
     * NOTE: Renouncing ownership will leave the contract without an owner,
     * thereby disabling any functionality that is only available to the owner.
     */
    function renounceOwnership() public virtual onlyOwner {
        _transferOwnership(address(0));
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Can only be called by the current owner.
     */
    function transferOwnership(address newOwner) public virtual onlyOwner {
        if (newOwner == address(0)) {
            revert OwnableInvalidOwner(address(0));
        }
        _transferOwnership(newOwner);
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Internal function without access restriction.
     */
    function _transferOwnership(address newOwner) internal virtual {
        address oldOwner = _owner;
        _owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
}

// File: @openzeppelin/contracts/utils/ReentrancyGuard.sol

// OpenZeppelin Contracts (last updated v5.1.0) (utils/ReentrancyGuard.sol)

/**
 * @dev Contract module that helps prevent reentrant calls to a function.
 *
 * Inheriting from `ReentrancyGuard` will make the {nonReentrant} modifier
 * available, which can be applied to functions to make sure there are no nested
 * (reentrant) calls to them.
 *
 * Note that because there is a single `nonReentrant` guard, functions marked as
 * `nonReentrant` may not call one another. This can be worked around by making
 * those functions `private`, and then adding `external` `nonReentrant` entry
 * points to them.
 *
 * TIP: If EIP-1153 (transient storage) is available on the chain you're deploying at,
 * consider using {ReentrancyGuardTransient} instead.
 *
 * TIP: If you would like to learn more about reentrancy and alternative ways
 * to protect against it, check out our blog post
 * https://blog.openzeppelin.com/reentrancy-after-istanbul/[Reentrancy After Istanbul].
 */
abstract contract ReentrancyGuard {
    // Booleans are more expensive than uint256 or any type that takes up a full
    // word because each write operation emits an extra SLOAD to first read the
    // slot's contents, replace the bits taken up by the boolean, and then write
    // back. This is the compiler's defense against contract upgrades and
    // pointer aliasing, and it cannot be disabled.

    // The values being non-zero value makes deployment a bit more expensive,
    // but in exchange the refund on every call to nonReentrant will be lower in
    // amount. Since refunds are capped to a percentage of the total
    // transaction's gas, it is best to keep them low in cases like this one, to
    // increase the likelihood of the full refund coming into effect.
    uint256 private constant NOT_ENTERED = 1;
    uint256 private constant ENTERED = 2;

    uint256 private _status;

    /**
     * @dev Unauthorized reentrant call.
     */
    error ReentrancyGuardReentrantCall();

    constructor() {
        _status = NOT_ENTERED;
    }

    /**
     * @dev Prevents a contract from calling itself, directly or indirectly.
     * Calling a `nonReentrant` function from another `nonReentrant`
     * function is not supported. It is possible to prevent this from happening
     * by making the `nonReentrant` function external, and making it call a
     * `private` function that does the actual work.
     */
    modifier nonReentrant() {
        _nonReentrantBefore();
        _;
        _nonReentrantAfter();
    }

    function _nonReentrantBefore() private {
        // On the first call to nonReentrant, _status will be NOT_ENTERED
        if (_status == ENTERED) {
            revert ReentrancyGuardReentrantCall();
        }

        // Any calls to nonReentrant after this point will fail
        _status = ENTERED;
    }

    function _nonReentrantAfter() private {
        // By storing the original value once again, a refund is triggered (see
        // https://eips.ethereum.org/EIPS/eip-2200)
        _status = NOT_ENTERED;
    }

    /**
     * @dev Returns true if the reentrancy guard is currently set to "entered", which indicates there is a
     * `nonReentrant` function in the call stack.
     */
    function _reentrancyGuardEntered() internal view returns (bool) {
        return _status == ENTERED;
    }
}

// File: @openzeppelin/contracts/token/ERC20/IERC20.sol

// OpenZeppelin Contracts (last updated v5.4.0) (token/ERC20/IERC20.sol)

/**
 * @dev Interface of the ERC-20 standard as defined in the ERC.
 */
interface IERC20 {
    /**
     * @dev Emitted when `value` tokens are moved from one account (`from`) to
     * another (`to`).
     *
     * Note that `value` may be zero.
     */
    event Transfer(address indexed from, address indexed to, uint256 value);

    /**
     * @dev Emitted when the allowance of a `spender` for an `owner` is set by
     * a call to {approve}. `value` is the new allowance.
     */
    event Approval(address indexed owner, address indexed spender, uint256 value);

    /**
     * @dev Returns the value of tokens in existence.
     */
    function totalSupply() external view returns (uint256);

    /**
     * @dev Returns the value of tokens owned by `account`.
     */
    function balanceOf(address account) external view returns (uint256);

    /**
     * @dev Moves a `value` amount of tokens from the caller's account to `to`.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a {Transfer} event.
     */
    function transfer(address to, uint256 value) external returns (bool);

    /**
     * @dev Returns the remaining number of tokens that `spender` will be
     * allowed to spend on behalf of `owner` through {transferFrom}. This is
     * zero by default.
     *
     * This value changes when {approve} or {transferFrom} are called.
     */
    function allowance(address owner, address spender) external view returns (uint256);

    /**
     * @dev Sets a `value` amount of tokens as the allowance of `spender` over the
     * caller's tokens.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * IMPORTANT: Beware that changing an allowance with this method brings the risk
     * that someone may use both the old and the new allowance by unfortunate
     * transaction ordering. One possible solution to mitigate this race
     * condition is to first reduce the spender's allowance to 0 and set the
     * desired value afterwards:
     * https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729
     *
     * Emits an {Approval} event.
     */
    function approve(address spender, uint256 value) external returns (bool);

    /**
     * @dev Moves a `value` amount of tokens from `from` to `to` using the
     * allowance mechanism. `value` is then deducted from the caller's
     * allowance.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a {Transfer} event.
     */
    function transferFrom(address from, address to, uint256 value) external returns (bool);
}

// File: @openzeppelin/contracts/utils/introspection/IERC165.sol

// OpenZeppelin Contracts (last updated v5.4.0) (utils/introspection/IERC165.sol)

/**
 * @dev Interface of the ERC-165 standard, as defined in the
 * https://eips.ethereum.org/EIPS/eip-165[ERC].
 *
 * Implementers can declare support of contract interfaces, which can then be
 * queried by others ({ERC165Checker}).
 *
 * For an implementation, see {ERC165}.
 */
interface IERC165 {
    /**
     * @dev Returns true if this contract implements the interface defined by
     * `interfaceId`. See the corresponding
     * https://eips.ethereum.org/EIPS/eip-165#how-interfaces-are-identified[ERC section]
     * to learn more about how these ids are created.
     *
     * This function call must use less than 30 000 gas.
     */
    function supportsInterface(bytes4 interfaceId) external view returns (bool);
}

// File: @openzeppelin/contracts/interfaces/IERC1363.sol

// OpenZeppelin Contracts (last updated v5.4.0) (interfaces/IERC1363.sol)

/**
 * @title IERC1363
 * @dev Interface of the ERC-1363 standard as defined in the https://eips.ethereum.org/EIPS/eip-1363[ERC-1363].
 *
 * Defines an extension interface for ERC-20 tokens that supports executing code on a recipient contract
 * after `transfer` or `transferFrom`, or code on a spender contract after `approve`, in a single transaction.
 */
interface IERC1363 is IERC20, IERC165 {
    /*
     * Note: the ERC-165 identifier for this interface is 0xb0202a11.
     * 0xb0202a11 ===
     *   bytes4(keccak256('transferAndCall(address,uint256)')) ^
     *   bytes4(keccak256('transferAndCall(address,uint256,bytes)')) ^
     *   bytes4(keccak256('transferFromAndCall(address,address,uint256)')) ^
     *   bytes4(keccak256('transferFromAndCall(address,address,uint256,bytes)')) ^
     *   bytes4(keccak256('approveAndCall(address,uint256)')) ^
     *   bytes4(keccak256('approveAndCall(address,uint256,bytes)'))
     */

    /**
     * @dev Moves a `value` amount of tokens from the caller's account to `to`
     * and then calls {IERC1363Receiver-onTransferReceived} on `to`.
     * @param to The address which you want to transfer to.
     * @param value The amount of tokens to be transferred.
     * @return A boolean value indicating whether the operation succeeded unless throwing.
     */
    function transferAndCall(address to, uint256 value) external returns (bool);

    /**
     * @dev Moves a `value` amount of tokens from the caller's account to `to`
     * and then calls {IERC1363Receiver-onTransferReceived} on `to`.
     * @param to The address which you want to transfer to.
     * @param value The amount of tokens to be transferred.
     * @param data Additional data with no specified format, sent in call to `to`.
     * @return A boolean value indicating whether the operation succeeded unless throwing.
     */
    function transferAndCall(address to, uint256 value, bytes calldata data) external returns (bool);

    /**
     * @dev Moves a `value` amount of tokens from `from` to `to` using the allowance mechanism
     * and then calls {IERC1363Receiver-onTransferReceived} on `to`.
     * @param from The address which you want to send tokens from.
     * @param to The address which you want to transfer to.
     * @param value The amount of tokens to be transferred.
     * @return A boolean value indicating whether the operation succeeded unless throwing.
     */
    function transferFromAndCall(address from, address to, uint256 value) external returns (bool);

    /**
     * @dev Moves a `value` amount of tokens from `from` to `to` using the allowance mechanism
     * and then calls {IERC1363Receiver-onTransferReceived} on `to`.
     * @param from The address which you want to send tokens from.
     * @param to The address which you want to transfer to.
     * @param value The amount of tokens to be transferred.
     * @param data Additional data with no specified format, sent in call to `to`.
     * @return A boolean value indicating whether the operation succeeded unless throwing.
     */
    function transferFromAndCall(address from, address to, uint256 value, bytes calldata data) external returns (bool);

    /**
     * @dev Sets a `value` amount of tokens as the allowance of `spender` over the
     * caller's tokens and then calls {IERC1363Spender-onApprovalReceived} on `spender`.
     * @param spender The address which will spend the funds.
     * @param value The amount of tokens to be spent.
     * @return A boolean value indicating whether the operation succeeded unless throwing.
     */
    function approveAndCall(address spender, uint256 value) external returns (bool);

    /**
     * @dev Sets a `value` amount of tokens as the allowance of `spender` over the
     * caller's tokens and then calls {IERC1363Spender-onApprovalReceived} on `spender`.
     * @param spender The address which will spend the funds.
     * @param value The amount of tokens to be spent.
     * @param data Additional data with no specified format, sent in call to `spender`.
     * @return A boolean value indicating whether the operation succeeded unless throwing.
     */
    function approveAndCall(address spender, uint256 value, bytes calldata data) external returns (bool);
}

// File: @openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol

// OpenZeppelin Contracts (last updated v5.3.0) (token/ERC20/utils/SafeERC20.sol)

/**
 * @title SafeERC20
 * @dev Wrappers around ERC-20 operations that throw on failure (when the token
 * contract returns false). Tokens that return no value (and instead revert or
 * throw on failure) are also supported, non-reverting calls are assumed to be
 * successful.
 * To use this library you can add a `using SafeERC20 for IERC20;` statement to your contract,
 * which allows you to call the safe operations as `token.safeTransfer(...)`, etc.
 */
library SafeERC20 {
    /**
     * @dev An operation with an ERC-20 token failed.
     */
    error SafeERC20FailedOperation(address token);

    /**
     * @dev Indicates a failed `decreaseAllowance` request.
     */
    error SafeERC20FailedDecreaseAllowance(address spender, uint256 currentAllowance, uint256 requestedDecrease);

    /**
     * @dev Transfer `value` amount of `token` from the calling contract to `to`. If `token` returns no value,
     * non-reverting calls are assumed to be successful.
     */
    function safeTransfer(IERC20 token, address to, uint256 value) internal {
        _callOptionalReturn(token, abi.encodeCall(token.transfer, (to, value)));
    }

    /**
     * @dev Transfer `value` amount of `token` from `from` to `to`, spending the approval given by `from` to the
     * calling contract. If `token` returns no value, non-reverting calls are assumed to be successful.
     */
    function safeTransferFrom(IERC20 token, address from, address to, uint256 value) internal {
        _callOptionalReturn(token, abi.encodeCall(token.transferFrom, (from, to, value)));
    }

    /**
     * @dev Variant of {safeTransfer} that returns a bool instead of reverting if the operation is not successful.
     */
    function trySafeTransfer(IERC20 token, address to, uint256 value) internal returns (bool) {
        return _callOptionalReturnBool(token, abi.encodeCall(token.transfer, (to, value)));
    }

    /**
     * @dev Variant of {safeTransferFrom} that returns a bool instead of reverting if the operation is not successful.
     */
    function trySafeTransferFrom(IERC20 token, address from, address to, uint256 value) internal returns (bool) {
        return _callOptionalReturnBool(token, abi.encodeCall(token.transferFrom, (from, to, value)));
    }

    /**
     * @dev Increase the calling contract's allowance toward `spender` by `value`. If `token` returns no value,
     * non-reverting calls are assumed to be successful.
     *
     * IMPORTANT: If the token implements ERC-7674 (ERC-20 with temporary allowance), and if the "client"
     * smart contract uses ERC-7674 to set temporary allowances, then the "client" smart contract should avoid using
     * this function. Performing a {safeIncreaseAllowance} or {safeDecreaseAllowance} operation on a token contract
     * that has a non-zero temporary allowance (for that particular owner-spender) will result in unexpected behavior.
     */
    function safeIncreaseAllowance(IERC20 token, address spender, uint256 value) internal {
        uint256 oldAllowance = token.allowance(address(this), spender);
        forceApprove(token, spender, oldAllowance + value);
    }

    /**
     * @dev Decrease the calling contract's allowance toward `spender` by `requestedDecrease`. If `token` returns no
     * value, non-reverting calls are assumed to be successful.
     *
     * IMPORTANT: If the token implements ERC-7674 (ERC-20 with temporary allowance), and if the "client"
     * smart contract uses ERC-7674 to set temporary allowances, then the "client" smart contract should avoid using
     * this function. Performing a {safeIncreaseAllowance} or {safeDecreaseAllowance} operation on a token contract
     * that has a non-zero temporary allowance (for that particular owner-spender) will result in unexpected behavior.
     */
    function safeDecreaseAllowance(IERC20 token, address spender, uint256 requestedDecrease) internal {
        unchecked {
            uint256 currentAllowance = token.allowance(address(this), spender);
            if (currentAllowance < requestedDecrease) {
                revert SafeERC20FailedDecreaseAllowance(spender, currentAllowance, requestedDecrease);
            }
            forceApprove(token, spender, currentAllowance - requestedDecrease);
        }
    }

    /**
     * @dev Set the calling contract's allowance toward `spender` to `value`. If `token` returns no value,
     * non-reverting calls are assumed to be successful. Meant to be used with tokens that require the approval
     * to be set to zero before setting it to a non-zero value, such as USDT.
     *
     * NOTE: If the token implements ERC-7674, this function will not modify any temporary allowance. This function
     * only sets the "standard" allowance. Any temporary allowance will remain active, in addition to the value being
     * set here.
     */
    function forceApprove(IERC20 token, address spender, uint256 value) internal {
        bytes memory approvalCall = abi.encodeCall(token.approve, (spender, value));

        if (!_callOptionalReturnBool(token, approvalCall)) {
            _callOptionalReturn(token, abi.encodeCall(token.approve, (spender, 0)));
            _callOptionalReturn(token, approvalCall);
        }
    }

    /**
     * @dev Performs an {ERC1363} transferAndCall, with a fallback to the simple {ERC20} transfer if the target has no
     * code. This can be used to implement an {ERC721}-like safe transfer that rely on {ERC1363} checks when
     * targeting contracts.
     *
     * Reverts if the returned value is other than `true`.
     */
    function transferAndCallRelaxed(IERC1363 token, address to, uint256 value, bytes memory data) internal {
        if (to.code.length == 0) {
            safeTransfer(token, to, value);
        } else if (!token.transferAndCall(to, value, data)) {
            revert SafeERC20FailedOperation(address(token));
        }
    }

    /**
     * @dev Performs an {ERC1363} transferFromAndCall, with a fallback to the simple {ERC20} transferFrom if the target
     * has no code. This can be used to implement an {ERC721}-like safe transfer that rely on {ERC1363} checks when
     * targeting contracts.
     *
     * Reverts if the returned value is other than `true`.
     */
    function transferFromAndCallRelaxed(
        IERC1363 token,
        address from,
        address to,
        uint256 value,
        bytes memory data
    ) internal {
        if (to.code.length == 0) {
            safeTransferFrom(token, from, to, value);
        } else if (!token.transferFromAndCall(from, to, value, data)) {
            revert SafeERC20FailedOperation(address(token));
        }
    }

    /**
     * @dev Performs an {ERC1363} approveAndCall, with a fallback to the simple {ERC20} approve if the target has no
     * code. This can be used to implement an {ERC721}-like safe transfer that rely on {ERC1363} checks when
     * targeting contracts.
     *
     * NOTE: When the recipient address (`to`) has no code (i.e. is an EOA), this function behaves as {forceApprove}.
     * Opposedly, when the recipient address (`to`) has code, this function only attempts to call {ERC1363-approveAndCall}
     * once without retrying, and relies on the returned value to be true.
     *
     * Reverts if the returned value is other than `true`.
     */
    function approveAndCallRelaxed(IERC1363 token, address to, uint256 value, bytes memory data) internal {
        if (to.code.length == 0) {
            forceApprove(token, to, value);
        } else if (!token.approveAndCall(to, value, data)) {
            revert SafeERC20FailedOperation(address(token));
        }
    }

    /**
     * @dev Imitates a Solidity high-level call (i.e. a regular function call to a contract), relaxing the requirement
     * on the return value: the return value is optional (but if data is returned, it must not be false).
     * @param token The token targeted by the call.
     * @param data The call data (encoded using abi.encode or one of its variants).
     *
     * This is a variant of {_callOptionalReturnBool} that reverts if call fails to meet the requirements.
     */
    function _callOptionalReturn(IERC20 token, bytes memory data) private {
        uint256 returnSize;
        uint256 returnValue;
        assembly ("memory-safe") {
            let success := call(gas(), token, 0, add(data, 0x20), mload(data), 0, 0x20)
            // bubble errors
            if iszero(success) {
                let ptr := mload(0x40)
                returndatacopy(ptr, 0, returndatasize())
                revert(ptr, returndatasize())
            }
            returnSize := returndatasize()
            returnValue := mload(0)
        }

        if (returnSize == 0 ? address(token).code.length == 0 : returnValue != 1) {
            revert SafeERC20FailedOperation(address(token));
        }
    }

    /**
     * @dev Imitates a Solidity high-level call (i.e. a regular function call to a contract), relaxing the requirement
     * on the return value: the return value is optional (but if data is returned, it must not be false).
     * @param token The token targeted by the call.
     * @param data The call data (encoded using abi.encode or one of its variants).
     *
     * This is a variant of {_callOptionalReturn} that silently catches all reverts and returns a bool instead.
     */
    function _callOptionalReturnBool(IERC20 token, bytes memory data) private returns (bool) {
        bool success;
        uint256 returnSize;
        uint256 returnValue;
        assembly ("memory-safe") {
            success := call(gas(), token, 0, add(data, 0x20), mload(data), 0, 0x20)
            returnSize := returndatasize()
            returnValue := mload(0)
        }
        return success && (returnSize == 0 ? address(token).code.length > 0 : returnValue == 1);
    }
}

// File: contracts/LazaiTradingWallet.sol

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

// File: contracts/LazaiWalletFactory.sol

/**
 * @title LazaiWalletFactory
 * @notice Factory contract for deploying LazaiTradingWallet instances and managing DEX whitelist
 * @dev Uses CREATE2 for deterministic addresses, centralized DEX whitelist management
 */
contract LazaiWalletFactory is Ownable {
    // Bot operator address (set at deployment)
    address public immutable botOperator;

    // Deterministic salt version for wallet creation (no block.timestamp!)
    bytes32 public constant WALLET_SALT_VERSION = keccak256(abi.encodePacked("LazaiTrader_v1"));

    // Centralized DEX whitelist (managed by factory)
    mapping(address => bool) public whitelistedDEXs;

    // Mapping of user to their wallet
    mapping(address => address) public userWallets;

    // Mapping to check if address is a valid wallet
    mapping(address => bool) public isValidWallet;

    // Array to track all DEX addresses (for enumeration)
    address[] public dexList;

    // Events
    event WalletCreated(address indexed owner, address indexed wallet, bytes32 salt);
    event DEXWhitelisted(address indexed dex, bool status);
    event DEXBatchUpdated(uint256 count);

    // Errors
    error WalletAlreadyExists();
    error ZeroAddress();
    error DeploymentFailed();

    /**
     * @notice Initialize factory
     * @param _botOperator Bot operator address
     * @param _defaultDEXs Initial DEX addresses to whitelist
     */
    constructor(address _botOperator, address[] memory _defaultDEXs)
        Ownable(msg.sender)
    {
        if (_botOperator == address(0)) revert ZeroAddress();
        botOperator = _botOperator;

        // Whitelist default DEXs
        for (uint256 i = 0; i < _defaultDEXs.length; i++) {
            if (_defaultDEXs[i] != address(0)) {
                whitelistedDEXs[_defaultDEXs[i]] = true;
                dexList.push(_defaultDEXs[i]);
                emit DEXWhitelisted(_defaultDEXs[i], true);
            }
        }
    }

    /**
     * @notice Create a new trading wallet for user (deterministic, no block.timestamp!)
     * @param _owner Owner address (user's EOA)
     * @return wallet Address of deployed wallet
     */
    function createWallet(address _owner) external returns (address wallet) {
        if (_owner == address(0)) revert ZeroAddress();
        if (userWallets[_owner] != address(0)) revert WalletAlreadyExists();

        // Use owner address as deterministic salt (no block.timestamp dependency!)
        bytes32 salt = keccak256(abi.encodePacked(_owner, WALLET_SALT_VERSION));

        // Deploy wallet using CREATE2
        bytes memory bytecode = abi.encodePacked(
            type(LazaiTradingWallet).creationCode,
            abi.encode(_owner, botOperator, address(this))
        );

        assembly {
            wallet := create2(0, add(bytecode, 0x20), mload(bytecode), salt)
            if iszero(wallet) {
                revert(0, 0)
            }
        }

        if (wallet == address(0)) revert DeploymentFailed();

        // Register wallet
        userWallets[_owner] = wallet;
        isValidWallet[wallet] = true;

        emit WalletCreated(_owner, wallet, salt);
        return wallet;
    }

    /**
     * @notice Add or remove DEX from whitelist (owner only)
     * @param _dex DEX address
     * @param _status Whitelist status
     */
    function setDEXWhitelist(address _dex, bool _status) external onlyOwner {
        if (_dex == address(0)) revert ZeroAddress();

        bool currentStatus = whitelistedDEXs[_dex];

        if (_status && !currentStatus) {
            // Adding to whitelist
            whitelistedDEXs[_dex] = true;
            dexList.push(_dex);
        } else if (!_status && currentStatus) {
            // Removing from whitelist
            whitelistedDEXs[_dex] = false;
            // Note: We don't remove from dexList array to avoid gas costs
            // The mapping is the source of truth
        } else {
            // No change needed
            return;
        }

        emit DEXWhitelisted(_dex, _status);
    }

    /**
     * @notice Batch update DEX whitelist (owner only)
     * @param _dexs Array of DEX addresses
     * @param _status Whitelist status for all
     */
    function batchSetDEXWhitelist(address[] calldata _dexs, bool _status) external onlyOwner {
        for (uint256 i = 0; i < _dexs.length; i++) {
            if (_dexs[i] == address(0)) revert ZeroAddress();

            bool currentStatus = whitelistedDEXs[_dexs[i]];

            if (_status && !currentStatus) {
                whitelistedDEXs[_dexs[i]] = true;
                dexList.push(_dexs[i]);
            } else if (!_status && currentStatus) {
                whitelistedDEXs[_dexs[i]] = false;
            }

            emit DEXWhitelisted(_dexs[i], _status);
        }
        emit DEXBatchUpdated(_dexs.length);
    }

    /**
     * @notice Check if DEX is whitelisted
     * @param _dex DEX address
     * @return bool Whitelist status
     */
    function isDEXWhitelisted(address _dex) external view returns (bool) {
        return whitelistedDEXs[_dex];
    }

    /**
     * @notice Get all whitelisted DEX addresses
     * @return address[] Array of whitelisted DEX addresses
     */
    function getWhitelistedDEXs() external view returns (address[] memory) {
        // Count active DEXs
        uint256 activeCount = 0;
        for (uint256 i = 0; i < dexList.length; i++) {
            if (whitelistedDEXs[dexList[i]]) {
                activeCount++;
            }
        }

        // Build array of active DEXs
        address[] memory activeDEXs = new address[](activeCount);
        uint256 index = 0;
        for (uint256 i = 0; i < dexList.length; i++) {
            if (whitelistedDEXs[dexList[i]]) {
                activeDEXs[index] = dexList[i];
                index++;
            }
        }

        return activeDEXs;
    }

    /**
     * @notice Get total number of DEXs ever added (including removed ones)
     * @return uint256 Total DEX count
     */
    function getDEXCount() external view returns (uint256) {
        return dexList.length;
    }

    /**
     * @notice Compute wallet address before deployment (for testing across chains)
     * @param _owner Owner address
     * @return predicted Predicted wallet address
     */
    function computeWalletAddress(address _owner)
        external
        view
        returns (address predicted)
    {
        bytes32 salt = keccak256(abi.encodePacked(_owner, WALLET_SALT_VERSION));
        
        bytes memory bytecode = abi.encodePacked(
            type(LazaiTradingWallet).creationCode,
            abi.encode(_owner, botOperator, address(this))
        );

        bytes32 hash = keccak256(
            abi.encodePacked(
                bytes1(0xff),
                address(this),
                salt,
                keccak256(bytecode)
            )
        );

        return address(uint160(uint256(hash)));
    }

    /**
     * @notice Check if user has a wallet
     * @param _user User address
     * @return bool Whether user has a wallet
     */
    function hasWallet(address _user) external view returns (bool) {
        return userWallets[_user] != address(0);
    }

    /**
     * @notice Get user's wallet address
     * @param _user User address
     * @return address User's wallet address (or address(0) if none)
     */
    function getUserWallet(address _user) external view returns (address) {
        return userWallets[_user];
    }
}

// File: contracts/FactoryDeployer.sol

/**
 * @title FactoryDeployer
 * @notice Deploys LazaiWalletFactory using CREATE2 for deterministic addresses
 * @dev This contract itself can be at any address, but it deploys factory deterministically
 */
contract FactoryDeployer {

    // Fixed salt for factory deployment (SAME across all chains)
    bytes32 public constant FACTORY_CREATION_SALT = keccak256(abi.encodePacked("LazaiFactory_Mainnet_v1"));

    // Bot operator address - will receive factory ownership
    address public immutable botOperator;

    // Track deployed factories
    mapping(address => bool) public deployedFactories;

    event FactoryDeployed(address indexed factory, address indexed botOperator);
    event FactoryOwnershipClaimed(address indexed factory, address indexed newOwner);

    modifier onlyBotOperator() {
        require(msg.sender == botOperator, "Not bot operator");
        _;
    }

    constructor(address _botOperator) {
        require(_botOperator != address(0), "Zero address");
        botOperator = _botOperator;
    }

    /**
     * @notice Deploy LazaiWalletFactory at deterministic address
     * @param _botOperator Bot operator address (MUST be same across all chains)
     * @param _defaultDEXs Initial DEX whitelist (MUST be same across all chains)
     * @return factory Deployed factory address
     */
    function deployFactory(
        address _botOperator,
        address[] memory _defaultDEXs
    ) external returns (address factory) {
        bytes memory bytecode = abi.encodePacked(
            type(LazaiWalletFactory).creationCode,
            abi.encode(_botOperator, _defaultDEXs)
        );

        bytes32 salt = FACTORY_CREATION_SALT;
        assembly {
            factory := create2(0, add(bytecode, 0x20), mload(bytecode), salt)
            if iszero(factory) {
                revert(0, 0)
            }
        }

        require(factory != address(0), "Factory deployment failed");

        // Track deployed factory
        deployedFactories[factory] = true;

        // Transfer ownership to the bot operator (consistent across all chains)
        LazaiWalletFactory(factory).transferOwnership(botOperator);

        emit FactoryDeployed(factory, _botOperator);
        return factory;
    }

    /**
     * @notice Set DEX whitelist on factory (for factories where this deployer is still owner)
     * @dev Use this to fix existing deployments where deployer is owner
     * @param _factory Factory address
     * @param _dex DEX address to whitelist
     * @param _status Whitelist status
     */
    function setFactoryDEXWhitelist(
        address _factory,
        address _dex,
        bool _status
    ) external onlyBotOperator {
        LazaiWalletFactory(_factory).setDEXWhitelist(_dex, _status);
    }

    /**
     * @notice Batch set DEX whitelist on factory
     * @param _factory Factory address
     * @param _dexs Array of DEX addresses
     * @param _status Whitelist status for all
     */
    function batchSetFactoryDEXWhitelist(
        address _factory,
        address[] calldata _dexs,
        bool _status
    ) external onlyBotOperator {
        LazaiWalletFactory(_factory).batchSetDEXWhitelist(_dexs, _status);
    }

    /**
     * @notice Claim ownership of a factory (transfer to new owner)
     * @dev Use this to fix existing deployments where deployer is owner
     * @param _factory Factory address
     * @param _newOwner New owner address
     */
    function claimFactoryOwnership(
        address _factory,
        address _newOwner
    ) external onlyBotOperator {
        LazaiWalletFactory(_factory).transferOwnership(_newOwner);
        emit FactoryOwnershipClaimed(_factory, _newOwner);
    }

    /**
     * @notice Predict factory address BEFORE deployment
     * @dev Call this on each chain to verify the address will be the same
     * @param _botOperator Bot operator address
     * @param _defaultDEXs Initial DEX whitelist
     * @return predicted Predicted factory address
     */
    function predictFactoryAddress(
        address _botOperator,
        address[] memory _defaultDEXs
    ) external view returns (address predicted) {
        bytes memory bytecode = abi.encodePacked(
            type(LazaiWalletFactory).creationCode,
            abi.encode(_botOperator, _defaultDEXs)
        );

        bytes32 hash = keccak256(
            abi.encodePacked(
                bytes1(0xff),
                address(this),
                FACTORY_CREATION_SALT,
                keccak256(bytecode)
            )
        );

        predicted = address(uint160(uint256(hash)));
        return predicted;
    }

    /**
     * @notice Predict wallet address across chains
     * @dev Use this after factory is deployed to verify wallets will be at same address
     * @param _factory Deployed factory address
     * @param _owner Owner address
     * @return predicted Predicted wallet address
     */
    function predictWalletAddress(
        address _factory,
        address _owner
    ) external view returns (address predicted) {
        // Recreate the salt used in factory.createWallet()
        bytes32 walletSaltVersion = keccak256(abi.encodePacked("LazaiTrader_v1"));
        bytes32 salt = keccak256(abi.encodePacked(_owner, walletSaltVersion));
        
        bytes memory bytecode = abi.encodePacked(
            type(LazaiTradingWallet).creationCode,
            abi.encode(_owner, LazaiWalletFactory(_factory).botOperator(), _factory)
        );

        bytes32 hash = keccak256(
            abi.encodePacked(
                bytes1(0xff),
                _factory,
                salt,
                keccak256(bytecode)
            )
        );

        return address(uint160(uint256(hash)));
    }
}
