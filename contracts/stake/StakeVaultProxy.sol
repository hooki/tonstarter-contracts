// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;

import "../interfaces/IStakeVaultProxy.sol";
import "./StakeVaultStorage.sol";

/// @title Proxy for StakeVault
/// @notice
contract StakeVaultProxy is StakeVaultStorage, IStakeVaultProxy {

    address internal _implementation;
    bool public pauseProxy;

    event Upgraded(address indexed implementation);

    /// @dev constructor of StakeVaultProxy
    /// @param impl the logic address of StakeVaultProxy
    constructor(address impl) {
        _setRoleAdmin(ADMIN_ROLE, ADMIN_ROLE);
        _setupRole(ADMIN_ROLE, msg.sender);
        _setupRole(ADMIN_ROLE, address(this));
        _implementation = impl;
    }

    /// @notice Set pause state
    /// @param _pause true:pause or false:resume
    function setProxyPause(bool _pause) external override onlyOwner {
        pauseProxy = _pause;
    }

    /// @notice Set implementation contract
    /// @param impl New implementation contract address
    function upgradeTo(address impl) external override onlyOwner {
        require(impl != address(0), "Stake1Vault: input is zero");
        require(_implementation != impl, "Stake1Vault: same");
        _implementation = impl;
        emit Upgraded(impl);
    }

    /// @dev returns the implementation
    function implementation() public override view returns (address) {
        return _implementation;
    }

    /// @dev receive ether
    receive() external payable {
        _fallback();
    }

    /// @dev fallback function , execute on undefined function call
    fallback() external payable {
        _fallback();
    }

    /// @dev fallback function , execute on undefined function call
    function _fallback() internal {
        address _impl = implementation();
        require(_impl != address(0) && !pauseProxy, "Stake1Vault: impl OR proxy is false");

        assembly {
            // Copy msg.data. We take full control of memory in this inline assembly
            // block because it will not return to Solidity code. We overwrite the
            // Solidity scratch pad at memory position 0.
            calldatacopy(0, 0, calldatasize())

            // Call the implementation.
            // out and outsize are 0 because we don't know the size yet.
            let result := delegatecall(gas(), _impl, 0, calldatasize(), 0, 0)

            // Copy the returned data.
            returndatacopy(0, 0, returndatasize())

            switch result
                // delegatecall returns 0 on error.
                case 0 {
                    revert(0, returndatasize())
                }
                default {
                    return(0, returndatasize())
                }
        }
    }

    /// @dev set initial storage
    /// @param _fld  FLD token address
    /// @param _paytoken  Tokens staked by users, can be used as ERC20 tokens.
    //                     (In case of ETH, input address(0))
    /// @param _cap  Maximum amount of rewards issued, allocated reward amount.
    /// @param _saleStartBlock  the sale start block
    /// @param _stakeStartBlock  the staking start block
    /// @param _stakefactory the factory address to create stakeContract
    /// @param _stakeType  Type of staking contract, 0 TON staking, 1 basic ERC20 staking, 2 Defi linked staking
    /// @param _defiAddr Used when an external address is required. default: address(0)
    function initialize(
        address _fld,
        address _paytoken,
        uint256 _cap,
        uint256 _saleStartBlock,
        uint256 _stakeStartBlock,
        address _stakefactory,
        uint256 _stakeType,
        address _defiAddr
    ) external override onlyOwner {
        require(
            _fld != address(0) && _stakefactory != address(0),
            "Stake1Vault: input is zero"
        );
        require(_cap > 0, "Stake1Vault: _cap is zero");
        require(
            _saleStartBlock < _stakeStartBlock && _stakeStartBlock > 0,
            "Stake1Vault: startBlock is unavailable"
        );

        fld = IFLD(_fld);
        cap = _cap;
        paytoken = _paytoken;
        saleStartBlock = _saleStartBlock;
        stakeStartBlock = _stakeStartBlock;
        stakeType = _stakeType;
        defiAddr = _defiAddr;

        grantRole(ADMIN_ROLE, _stakefactory);
    }
}
