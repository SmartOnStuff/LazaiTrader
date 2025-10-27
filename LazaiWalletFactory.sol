// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./LazaiTradingWallet.sol";

/**
 * @title LazaiWalletFactory
 * @notice Factory contract for deploying LazaiTradingWallet instances and managing DEX whitelist
 * @dev Uses CREATE2 for deterministic addresses, centralized DEX whitelist management
 */
contract LazaiWalletFactory is Ownable {
    // Bot operator address (set at deployment)
    address public immutable botOperator;

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
        Ownable(msg.sender) // Pass msg.sender as the initial owner
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
     * @notice Create a new trading wallet for user
     * @param _owner Owner address (user's EOA)
     * @return wallet Address of deployed wallet
     */
    function createWallet(address _owner) external returns (address wallet) {
        if (_owner == address(0)) revert ZeroAddress();
        if (userWallets[_owner] != address(0)) revert WalletAlreadyExists();

        // Generate deterministic salt from owner address
        bytes32 salt = keccak256(abi.encodePacked(_owner, block.timestamp));

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
     * @notice Compute wallet address before deployment
     * @param _owner Owner address
     * @param _salt Salt for CREATE2
     * @return predicted Predicted wallet address
     */
    function computeWalletAddress(address _owner, bytes32 _salt)
        external
        view
        returns (address predicted)
    {
        bytes memory bytecode = abi.encodePacked(
            type(LazaiTradingWallet).creationCode,
            abi.encode(_owner, botOperator, address(this))
        );

        bytes32 hash = keccak256(
            abi.encodePacked(
                bytes1(0xff),
                address(this),
                _salt,
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
}