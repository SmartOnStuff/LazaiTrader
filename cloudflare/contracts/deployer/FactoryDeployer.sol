// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./LazaiWalletFactory.sol";

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

        assembly {
            factory := create2(0, add(bytecode, 0x20), mload(bytecode), FACTORY_CREATION_SALT)
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
            abi.encode(_owner, IFactory(_factory).botOperator(), _factory)
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

/**
 * @notice Minimal interface to read botOperator from factory
 */
interface IFactory {
    function botOperator() external view returns (address);
}
