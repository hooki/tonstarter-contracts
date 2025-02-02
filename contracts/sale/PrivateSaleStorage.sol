//SPDX-License-Identifier: Unlicense
pragma solidity ^0.7.6;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title The storage of StakeProxy
contract PrivateSaleStorage {

    struct UserInfoAmount {
        uint256 inputamount;
        uint256 totaloutputamount;
        uint256 inputTime;
        uint256 monthlyReward;
        uint256 firstReward;
    }

    struct UserInfoClaim {
        uint256 claimTime;
        uint256 claimAmount;
        uint256 firstClaimAmount;
        uint256 firstClaimTime;
        bool first;
    }

    struct WhiteList {
        uint256 amount;
    }
    
    address public getTokenOwner;       //받은 ton을 받을 주소
    uint256 public totalGetAmount;      //총 TON받은양
    uint256 public totalSaleAmount;     //총 판매토큰

    uint256 public saleStartTime;           //sale시작 시간
    uint256 public saleEndTime;             //sale끝 시간

    uint256 public firstClaimTime;           //초기 claim 시간

    uint256 public claimStartTime;  //6개월 뒤 claim시작 시간
    uint256 public claimEndTime;    //claim시작시간 + 1년

    uint256 public saleTokenPrice;  //판매토큰가격
    uint256 public getTokenPrice;   //받는토큰가격(TON)

    IERC20 public saleToken;        //판매할 token주소
    IERC20 public getToken;         //TON 주소

    address public wton;             //WTON 주소

    mapping (address => UserInfoAmount) public usersAmount;
    mapping (address => UserInfoClaim) public usersClaim;
    mapping (address => WhiteList) public usersWhite;

    /// @dev flag for pause proxy
    bool public pauseProxy;

    /// @dev implementation of proxy index
    mapping(uint256 => address) public proxyImplementation;

    mapping(address => bool) public aliveImplementation;

    mapping(bytes4 => address) public selectorImplementation;
}
