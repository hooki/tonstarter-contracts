// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;

import {IStake1Factory} from "../interfaces/IStake1Factory.sol";
import {IStakeForStableCoinFactory} from "../interfaces/IStakeForStableCoinFactory.sol";
import {IStake1Vault} from "../interfaces/IStake1Vault.sol";

contract StakeFactory {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN");

    address public stake1Factory ;
    address public stakeStableCoinFactory ;

    constructor(address _stake1Factory, address _stableFactory) {
        require(
            _stake1Factory != address(0) && _stableFactory != address(0),
            "StakeFactory: init fail" );
        stake1Factory = _stake1Factory;
        stakeStableCoinFactory = _stableFactory;
    }


    function deploy(
        uint256 _pahse,
        address _vault,
        address _token,
        address _paytoken,
        uint256 _period,
        address[4] memory tokamakAddr
    ) public returns (address) {
        require(
            _vault != address(0),
            "StakeFactory: deploy init fail"
        );

        IStake1Vault vault = IStake1Vault(_vault);
        uint256 saleStart = vault.saleStartBlock();
        uint256 stakeStart = vault.stakeStartBlock();
        uint256 stakeType = vault.stakeType();

        require(
            saleStart < stakeStart && stakeStart > 0,
            "StakeFactory: start error"
        );

        if (stakeType <= 1) {

            require(stake1Factory != address(0), "StakeFactory: stake1Factory zero");

            return IStake1Factory(stake1Factory).deploy(
                    _pahse,
                    _vault,
                    _token,
                    _paytoken,
                    _period,
                    tokamakAddr,
                    msg.sender
            );

        } else if (stakeType == 2) {

            require(stakeStableCoinFactory != address(0), "StakeFactory: stakeStableCoinFactory zero");

            return IStakeForStableCoinFactory(stakeStableCoinFactory).deploy(
                    _pahse,
                    _vault,
                    _token,
                    _paytoken,
                    _period,
                    msg.sender
            );
        }

        return address(0);
    }
}
