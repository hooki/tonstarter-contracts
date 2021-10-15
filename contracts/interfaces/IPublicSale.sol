//SPDX-License-Identifier: Unlicense
pragma solidity ^0.7.6;

interface IPublicSale {
    /// @dev set snapshot
    /// @param _snapshot _snapshot timestamp
    function setSnapshot(uint256 _snapshot) external;

    /// @dev set information related to exclusive sale
    /// @param _startAddWhiteTime start time of addwhitelist
    /// @param _endAddWhiteTime end time of addwhitelist
    /// @param _startExclusiveTime start time of exclusive sale
    /// @param _endExclusiveTime start time of exclusive sale
    function setExclusiveTime(
        uint256 _startAddWhiteTime,
        uint256 _endAddWhiteTime,
        uint256 _startExclusiveTime,
        uint256 _endExclusiveTime
    ) external;

    /// @dev set information related to open sale
    /// @param _startDepositTime start time of deposit
    /// @param _endDepositTime end time of deposit
    /// @param _startOpenSaleTime start time of open sale
    /// @param _endOpenSaleTime start time of open sale
    function setOpenTime(
        uint256 _startDepositTime,
        uint256 _endDepositTime,
        uint256 _startOpenSaleTime,
        uint256 _endOpenSaleTime
    ) external;

    /// @dev set information related to claim
    /// @param _startClaimTime start time of claim
    /// @param _claimInterval claim period seconds
    /// @param _claimPeriod number of claims
    function setClaim(
        uint256 _startClaimTime,
        uint256 _claimInterval,
        uint256 _claimPeriod,
        uint256 _claimFirst
    ) external;

    /// @dev set information related to sale amount
    /// @param _totalExpectSaleAmount expected amount of exclusive sale
    /// @param _totalExpectOpenSaleAmount expected amount of open sale
    function setSaleAmount(
        uint256 _totalExpectSaleAmount,
        uint256 _totalExpectOpenSaleAmount
    ) external;

    /// @dev set information related to tier
    /// @param _tier1 tier1 condition of STOS hodings
    /// @param _tier2 tier2 condition of STOS hodings
    /// @param _tier3 tier3 condition of STOS hodings
    /// @param _tier4 tier4 condition of STOS hodings
    function setTier(
        uint256 _tier1,
        uint256 _tier2,
        uint256 _tier3,
        uint256 _tier4
    ) external;

    /// @dev set information related to tier proportion for exclusive sale
    /// @param _tier1 tier1 proportion (If it is 6%, enter as 600 -> To record up to the 2nd decimal point)
    /// @param _tier2 tier2 proportion
    /// @param _tier3 tier3 proportion
    /// @param _tier4 tier4 proportion
    function setTierPercents(
        uint256 _tier1,
        uint256 _tier2,
        uint256 _tier3,
        uint256 _tier4
    ) external;

    /// @dev set information related to token price
    /// @param _saleTokenPrice the sale token price
    /// @param _payTokenPrice  the funding(pay) token price
    function setTokenPrice(uint256 _saleTokenPrice, uint256 _payTokenPrice)
        external;

    /// @dev calculate the sale Token amount
    /// @param _amount th amount
    function calculSaleToken(uint256 _amount) external view returns (uint256);

    /// @dev calculate the pay Token amount
    /// @param _amount th amount
    function calculPayToken(uint256 _amount) external view returns (uint256);

    /// @dev calculate the tier
    /// @param _address user address
    function calculTier(address _address) external view returns (uint256);

    /// @dev calculate the tier's amount
    /// @param _address user address
    function calculTierAmount(address _address) external view returns (uint256);

    /// @dev calculate the open sale amount
    /// @param _account user address
    /// @param _amount  amount
    function calculOpenSaleAmount(address _account, uint256 _amount)
        external
        view
        returns (uint256);

    /// @dev calculate the open sale amount
    /// @param _account user address
    function calculClaimAmount(address _account)
        external
        view
        returns (uint256);

    /// @dev view totalExpectOpenSaleAmount
    function totalExpectOpenSaleAmountView()
        external
        view
        returns(uint256);


    /// @dev execute add whitelist
    function addWhiteList() external;

    /// @dev execute exclusive sale
    /// @param _amount  amount
    function exclusiveSale(uint256 _amount) external;

    /// @dev execute deposit
    /// @param _amount  amount
    function deposit(uint256 _amount) external;

    /// @dev execute the claim
    function claim() external;

    /// @dev execute the withdraw
    function withdraw() external;




}
