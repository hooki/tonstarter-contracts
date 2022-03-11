// SPDX-License-Identifier: MIT

pragma solidity ^0.7.6;
pragma abicoder v2;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import {
    ReentrancyGuard
} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "../interfaces/IPublicSale.sol";
import "../interfaces/IWTON.sol";
import "../interfaces/ITON.sol";
import "../common/AccessibleCommon.sol";
import "./PublicSaleStorage.sol";

contract PublicSale is
    PublicSaleStorage,
    AccessibleCommon,
    ReentrancyGuard,
    IPublicSale
{
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    event AddedWhiteList(address indexed from, uint256 tier);
    event ExclusiveSaled(address indexed from, uint256 amount);
    event Deposited(address indexed from, uint256 amount);

    event Claimed(address indexed from, uint256 amount);
    event Withdrawal(address indexed from, uint256 amount);
    event DepositWithdrawal(address indexed from, uint256 amount, uint256 liquidityAmount);

    modifier nonZero(uint256 _value) {
        require(_value > 0, "PublicSale: zero");
        _;
    }

    modifier nonZeroAddress(address _addr) {
        require(_addr != address(0), "PublicSale: zero address");
        _;
    }

    modifier beforeStartAddWhiteTime() {
        require(
            startAddWhiteTime == 0 ||
                (startAddWhiteTime > 0 && block.timestamp < startAddWhiteTime),
            "PublicSale: not beforeStartAddWhiteTime"
        );
        _;
    }

    modifier beforeEndAddWhiteTime() {
        require(
            endAddWhiteTime == 0 ||
                (endAddWhiteTime > 0 && block.timestamp < endAddWhiteTime),
            "PublicSale: not beforeEndAddWhiteTime"
        );
        _;
    }

    modifier greaterThan(uint256 _value1, uint256 _value2) {
        require(_value1 > _value2, "PublicSale: non greaterThan");
        _;
    }

    modifier lessThan(uint256 _value1, uint256 _value2) {
        require(_value1 < _value2, "PublicSale: non less than");
        _;
    }

    /// @inheritdoc IPublicSale
    function changeTONOwner(
        address _address
    ) 
        external 
        override
        onlyOwner 
    {
        getTokenOwner = _address;
    }

    function setAllsetting(
        uint256[8] calldata _Tier,
        uint256[5] calldata _amount,
        uint256[8] calldata _time,
        uint256[] calldata _claimTimes,
        uint256[] calldata _claimPercents
    ) 
        external
        override 
        onlyOwner 
        beforeStartAddWhiteTime 
    {
        setTier(
            _Tier[0], _Tier[1], _Tier[2], _Tier[3]
        );
        setTierPercents(
            _Tier[4], _Tier[5], _Tier[6], _Tier[7]
        );
        setSaleAmount(
            _amount[0],
            _amount[1],
            _amount[2]
        );
        setTokenPrice(
            _amount[3],
            _amount[4]
        ); 
        setSnapshot(_time[0]);
        setExclusiveTime(
            _time[1],
            _time[2],
            _time[3],
            _time[4]
        );
        setOpenTime(
            _time[5],
            _time[6]
        );
        setEachClaim(
            _time[7],
            _claimTimes,
            _claimPercents
        );
    }

    /// @inheritdoc IPublicSale
    function setSnapshot(
        uint256 _snapshot
    )
        public
        override
        onlyOwner
        nonZero(_snapshot)
    {
        snapshot = _snapshot;
    }

    /// @inheritdoc IPublicSale
    function setExclusiveTime(
        uint256 _startAddWhiteTime,
        uint256 _endAddWhiteTime,
        uint256 _startExclusiveTime,
        uint256 _endExclusiveTime
    )
        public
        override
        onlyOwner
        nonZero(_startAddWhiteTime)
        nonZero(_endAddWhiteTime)
        nonZero(_startExclusiveTime)
        nonZero(_endExclusiveTime)
        beforeStartAddWhiteTime
    {
        require(
            (_startAddWhiteTime < _endAddWhiteTime) &&
            (_endAddWhiteTime < _startExclusiveTime) &&
            (_startExclusiveTime < _endExclusiveTime), 
            "PublicSale : Round1timeSet wrong"
        );
        startAddWhiteTime = _startAddWhiteTime;
        endAddWhiteTime = _endAddWhiteTime;
        startExclusiveTime = _startExclusiveTime;
        endExclusiveTime = _endExclusiveTime;
    }

    /// @inheritdoc IPublicSale
    function setOpenTime(
        uint256 _startDepositTime,
        uint256 _endDepositTime
    )
        public
        override
        onlyOwner
        nonZero(_startDepositTime)
        nonZero(_endDepositTime)
        beforeStartAddWhiteTime
    {
        require(
            (_startDepositTime < _endDepositTime),
            "PublicSale : Round2timeSet wrong"
        );
        startDepositTime = _startDepositTime;
        endDepositTime = _endDepositTime;
    }

    function setEachClaim(
        uint256 _claimCounts,
        uint256[] calldata _claimTimes,
        uint256[] calldata _claimPercents
    )
        public
        override
        onlyOwner
        beforeStartAddWhiteTime
    {
        totalClaimCounts = _claimCounts;
        uint256 i = 0;
        uint256 y = 0;
        for (i = 0; i < _claimCounts; i++) {
            claimTimes.push(_claimTimes[i]);
            if (i != 0){
                require(claimTimes[i-1] < claimTimes[i], "PublicSale: time value error");
            }
            claimPercents.push(_claimPercents[i]);
            y = y + _claimPercents[i];
        }

        require(y == 100, "the percents sum are needed 100");
    }

    /// @inheritdoc IPublicSale
    function setAllTier(
        uint256[4] calldata _tier,
        uint256[4] calldata _tierPercent
    ) external override onlyOwner {
        setTier(
            _tier[0],
            _tier[1],
            _tier[2],
            _tier[3]
        );
        setTierPercents(
            _tierPercent[0],
            _tierPercent[1],
            _tierPercent[2],
            _tierPercent[3]
        );
    }

    /// @inheritdoc IPublicSale
    function setTier(
        uint256 _tier1,
        uint256 _tier2,
        uint256 _tier3,
        uint256 _tier4
    )
        public
        override
        onlyOwner
        nonZero(_tier1)
        nonZero(_tier2)
        nonZero(_tier3)
        nonZero(_tier4)
        beforeStartAddWhiteTime
    {
        tiers[1] = _tier1;
        tiers[2] = _tier2;
        tiers[3] = _tier3;
        tiers[4] = _tier4;
    }

    /// @inheritdoc IPublicSale
    function setTierPercents(
        uint256 _tier1,
        uint256 _tier2,
        uint256 _tier3,
        uint256 _tier4
    )
        public
        override
        onlyOwner
        nonZero(_tier1)
        nonZero(_tier2)
        nonZero(_tier3)
        nonZero(_tier4)
        beforeStartAddWhiteTime
    {
        require(
            _tier1.add(_tier2).add(_tier3).add(_tier4) == 10000,
            "PublicSale: Sum should be 10000"
        );
        tiersPercents[1] = _tier1;
        tiersPercents[2] = _tier2;
        tiersPercents[3] = _tier3;
        tiersPercents[4] = _tier4;
    }

    /// @inheritdoc IPublicSale
    function setAllAmount(
        uint256[3] calldata _expectAmount,
        uint256[2] calldata _priceAmount
    ) external override onlyOwner {
        setSaleAmount(
            _expectAmount[0],
            _expectAmount[1],
            _expectAmount[2]
        );
        setTokenPrice(
            _priceAmount[0],
            _priceAmount[1]
        );
    }

    /// @inheritdoc IPublicSale
    function setSaleAmount(
        uint256 _totalExpectSaleAmount,
        uint256 _totalExpectOpenSaleAmount,
        uint256 _liquidityVaultAmount
    )
        public
        override
        onlyOwner
        nonZero(_totalExpectSaleAmount.add(_totalExpectOpenSaleAmount).add(liquidityVaultAmount))
        beforeStartAddWhiteTime
    {
        totalExpectSaleAmount = _totalExpectSaleAmount;
        totalExpectOpenSaleAmount = _totalExpectOpenSaleAmount;
        liquidityVaultAmount = _liquidityVaultAmount;
    }

    /// @inheritdoc IPublicSale
    function setTokenPrice(
        uint256 _saleTokenPrice, 
        uint256 _payTokenPrice
    )
        public
        override
        onlyOwner
        nonZero(_saleTokenPrice)
        nonZero(_payTokenPrice)
        beforeStartAddWhiteTime
    {
        saleTokenPrice = _saleTokenPrice;
        payTokenPrice = _payTokenPrice;
    }

    /// @inheritdoc IPublicSale
    function totalExpectOpenSaleAmountView() 
        public 
        view 
        override 
        returns(uint256)
    {
        if (block.timestamp < endExclusiveTime) return totalExpectOpenSaleAmount;
        else return totalExpectOpenSaleAmount.add(totalRound1NonSaleAmount());
    }

    /// @inheritdoc IPublicSale
    function totalRound1NonSaleAmount() 
        public 
        view 
        override 
        returns(uint256)
    {
        return totalExpectSaleAmount.sub(totalExSaleAmount);
    }


    function _toRAY(uint256 v) internal pure returns (uint256) {
        return v * 10 ** 9;
    }

    /// @inheritdoc IPublicSale
    function calculSaleToken(uint256 _amount)
        public
        view
        override
        returns (uint256)
    {
        uint256 tokenSaleAmount =
            _amount.mul(payTokenPrice).div(saleTokenPrice);
        return tokenSaleAmount;
    }

    /// @inheritdoc IPublicSale
    function calculPayToken(uint256 _amount)
        public
        view
        override
        returns (uint256)
    {
        uint256 tokenPayAmount = _amount.mul(saleTokenPrice).div(payTokenPrice);
        return tokenPayAmount;
    }

    /// @inheritdoc IPublicSale
    function calculTier(address _address)
        public
        view
        override
        nonZeroAddress(address(sTOS))
        nonZero(tiers[1])
        nonZero(tiers[2])
        nonZero(tiers[3])
        nonZero(tiers[4])
        returns (uint256)
    {
        uint256 sTOSBalance = sTOS.balanceOfAt(_address, snapshot);
        uint256 tier;
        if (sTOSBalance >= tiers[1] && sTOSBalance < tiers[2]) {
            tier = 1;
        } else if (sTOSBalance >= tiers[2] && sTOSBalance < tiers[3]) {
            tier = 2;
        } else if (sTOSBalance >= tiers[3] && sTOSBalance < tiers[4]) {
            tier = 3;
        } else if (sTOSBalance >= tiers[4]) {
            tier = 4;
        } else if (sTOSBalance < tiers[1]) {
            tier = 0;
        }
        return tier;
    }

    /// @inheritdoc IPublicSale
    function calculTierAmount(address _address)
        public
        view
        override
        returns (uint256)
    {
        LibPublicSale.UserInfoEx storage userEx = usersEx[_address];
        uint256 tier = calculTier(_address);
        if (userEx.join == true && tier > 0) {
            uint256 salePossible =
                totalExpectSaleAmount
                    .mul(tiersPercents[tier])
                    .div(tiersAccount[tier])
                    .div(10000);
            return salePossible;
        } else if (tier > 0) {
            uint256 tierAccount = tiersAccount[tier].add(1);
            uint256 salePossible =
                totalExpectSaleAmount
                    .mul(tiersPercents[tier])
                    .div(tierAccount)
                    .div(10000);
            return salePossible;
        } else {
            return 0;
        }
    }

    /// @inheritdoc IPublicSale
    function calculOpenSaleAmount(address _account, uint256 _amount)
        public
        view
        override
        returns (uint256)
    {
        LibPublicSale.UserInfoOpen storage userOpen = usersOpen[_account];
        uint256 depositAmount = userOpen.depositAmount.add(_amount);
        uint256 openSalePossible =
            totalExpectOpenSaleAmountView().mul(depositAmount).div(
                totalDepositAmount.add(_amount)
            );
        return openSalePossible;
    }

    function currentRound() public view returns (uint256 round) {
        if (block.timestamp > claimTimes[totalClaimCounts-1]) {
            return totalClaimCounts;
        }
        for (uint256 i = 0; i < totalClaimCounts; i++) {
            if (block.timestamp < claimTimes[i]) {
                return i;
            }
        }
    }

    function calculClaimAmount(address _account, uint256 _round) 
        public 
        view 
        override
        returns (uint256 _reward, uint256 _totalClaim, uint256 _refundAmount) 
    {
        if (block.timestamp < startClaimTime) return (0, 0, 0);
        if (_round > totalClaimCounts) return (0, 0, 0);
 
        LibPublicSale.UserClaim storage userClaim = usersClaim[_account];
        (, uint256 realSaleAmount, uint256 refundAmount) = totalSaleUserAmount(_account);   //유저가 총 구매한 token의 양을 Return 함

        if (realSaleAmount == 0 ) return (0, 0, 0);
        if (userClaim.claimAmount >= realSaleAmount) return (0, 0, 0);    //userClaim.claimAmount  = contract에서 유저에게 준양

        if (_round != 0) {
            uint256 amount = realSaleAmount.mul(claimPercents[(_round.sub(1))]).div(100);
            return (amount, realSaleAmount, refundAmount);
        }

        //해당 라운드에서 받아야하는 토큰의 양 -> (realSaleAmount * claimPercents[i] / 100) : 해당 라운드에서 받아야하는 토큰의 양
        uint256 round = currentRound();

        if (totalClaimCounts == round && _round == 0) {  
            uint256 amount = realSaleAmount - userClaim.claimAmount;
            return (amount, realSaleAmount, refundAmount);
        }
        
        uint256 expectedClaimAmount;
        for (uint256 i = 0; i < round; i++) {
            expectedClaimAmount = expectedClaimAmount.add((realSaleAmount.mul(claimPercents[i]).div(100)));
        }

        //Round를 0으로 넣으면 현재 내가 받을 수 있는 양을 리턴해주고 1 이상을 넣으면 해당 라운드에서 받을 수 있는 토큰의 양을 리턴해줌
        if (_round == 0) {    
            uint256 amount = expectedClaimAmount - userClaim.claimAmount;
            return (amount, realSaleAmount, refundAmount);
        } 
    }

    /// @inheritdoc IPublicSale
    function totalSaleUserAmount(address user) public override view returns (uint256 _realPayAmount, uint256 _realSaleAmount, uint256 _refundAmount) {
        LibPublicSale.UserInfoEx storage userEx = usersEx[user];

        if (userEx.join) {
            (uint256 realPayAmount, uint256 realSaleAmount, uint256 refundAmount) = openSaleUserAmount(user);
            return ( realPayAmount.add(userEx.payAmount), realSaleAmount.add(userEx.saleAmount), refundAmount);
        } else {
            return openSaleUserAmount(user);
        }
    }

    /// @inheritdoc IPublicSale
    function openSaleUserAmount(address user) public override view returns (uint256 _realPayAmount, uint256 _realSaleAmount, uint256 _refundAmount) {
        LibPublicSale.UserInfoOpen storage userOpen = usersOpen[user];

        if (!userOpen.join || userOpen.depositAmount == 0) return (0, 0, 0);

        uint256 openSalePossible = calculOpenSaleAmount(user, 0);
        uint256 realPayAmount = calculPayToken(openSalePossible);
        uint256 depositAmount = userOpen.depositAmount;
        uint256 realSaleAmount = 0;
        uint256 returnAmount = 0;

        if (realPayAmount < depositAmount) {
            returnAmount = depositAmount.sub(realPayAmount);
            realSaleAmount = calculSaleToken(realPayAmount);
        } else {
            realPayAmount = userOpen.depositAmount;
            realSaleAmount = calculSaleToken(depositAmount);
        }

        return (realPayAmount, realSaleAmount, returnAmount);
    }
    
    /// @inheritdoc IPublicSale
    function totalOpenSaleAmount() public override view returns (uint256){
        uint256 _calculSaleToken = calculSaleToken(totalDepositAmount);
        uint256 _totalAmount = totalExpectOpenSaleAmountView();

        if (_calculSaleToken < _totalAmount) return _calculSaleToken;
        else return _totalAmount;
    }

    /// @inheritdoc IPublicSale
    function totalOpenPurchasedAmount() public override view returns (uint256){
        uint256 _calculSaleToken = calculSaleToken(totalDepositAmount);
        uint256 _totalAmount = totalExpectOpenSaleAmountView();
        if (_calculSaleToken < _totalAmount) return totalDepositAmount;
        else return  calculPayToken(_totalAmount);
    }

    function totalWhitelists() external view returns (uint256) {
        return whitelists.length;
    }

    /// @inheritdoc IPublicSale
    function addWhiteList() external override nonReentrant {
        require(
            block.timestamp >= startAddWhiteTime,
            "PublicSale: whitelistStartTime has not passed"
        );
        require(
            block.timestamp < endAddWhiteTime,
            "PublicSale: end the whitelistTime"
        );
        uint256 tier = calculTier(msg.sender);
        require(tier >= 1, "PublicSale: need to more sTOS");
        LibPublicSale.UserInfoEx storage userEx = usersEx[msg.sender];
        require(userEx.join != true, "PublicSale: already attended");

        whitelists.push(msg.sender);

        userEx.join = true;
        userEx.tier = tier;
        userEx.saleAmount = 0;
        tiersAccount[tier] = tiersAccount[tier].add(1);

        emit AddedWhiteList(msg.sender, tier);
    }

    /**
     * @dev transform RAY to WAD
     */
    function _toWAD(uint256 v) public override pure returns (uint256) {
        return v / 10 ** 9;
    }

    function _decodeApproveData(
        bytes memory data
    ) public override pure returns (uint256 approveData) {
        assembly {
            approveData := mload(add(data, 0x20))
        }
    }

    function calculTONTransferAmount(
        uint256 _amount,
        address _sender
    )
        internal
        nonZero(_amount)
        nonZeroAddress(_sender)

    {
        uint256 tonAllowance = IERC20(getToken).allowance(_sender, address(this));
        uint256 tonBalance = IERC20(getToken).balanceOf(_sender);

        if (tonAllowance > tonBalance) {
            tonAllowance = tonBalance; //tonAllowance가 tonBlance보다 더 클때 문제가 된다.
        }
        if (tonAllowance < _amount) {
            uint256 needUserWton;
            uint256 needWton = _amount.sub(tonAllowance);
            needUserWton = _toRAY(needWton);
            require(IWTON(wton).allowance(_sender, address(this)) >= needUserWton, "PublicSale: wton amount exceeds allowance");
            require(IWTON(wton).balanceOf(_sender) >= needUserWton, "need more wton");
            IERC20(wton).safeTransferFrom(_sender,address(this),needUserWton);
            IWTON(wton).swapToTON(needUserWton);
            require(tonAllowance >= _amount.sub(needWton), "PublicSale: ton amount exceeds allowance");
            if (_amount.sub(needWton) > 0) {
                IERC20(getToken).safeTransferFrom(_sender, address(this), _amount.sub(needWton));   
            }
            if (block.timestamp < endExclusiveTime) {
                IERC20(getToken).safeTransfer(getTokenOwner, _amount);
            }
        } else {
            require(tonAllowance >= _amount && tonBalance >= _amount, "PublicSale: ton amount exceeds allowance");
            if (block.timestamp < endExclusiveTime) {
                IERC20(getToken).safeTransferFrom(_sender, address(this), _amount);
                IERC20(getToken).safeTransfer(getTokenOwner, _amount);
            } else if (block.timestamp >= startDepositTime) {
                IERC20(getToken).safeTransferFrom(_sender, address(this), _amount);
            }
        }

        if (block.timestamp < endExclusiveTime) {
            emit ExclusiveSaled(_sender, _amount);
        } else {
            emit Deposited(_sender, _amount);
        }
    }


    /// @inheritdoc IPublicSale
    function exclusiveSale(
        address _sender,
        uint256 _amount
    )
        public
        override
        nonZero(_amount)
        nonZero(totalClaimCounts)
        nonReentrant
    {
        require(
            block.timestamp >= startExclusiveTime,
            "PublicSale: exclusiveStartTime has not passed"
        );
        require(
            block.timestamp < endExclusiveTime,
            "PublicSale: end the exclusiveTime"
        );
        LibPublicSale.UserInfoEx storage userEx = usersEx[_sender];
        require(userEx.join == true, "PublicSale: not registered in whitelist");
        uint256 tokenSaleAmount = calculSaleToken(_amount);
        uint256 salePossible = calculTierAmount(_sender);

        require(
            salePossible >= userEx.saleAmount.add(tokenSaleAmount),
            "PublicSale: just buy tier's allocated amount"
        );

        uint256 tier = calculTier(_sender);

        if(userEx.payAmount == 0) {
            totalRound1Users = totalRound1Users.add(1);
            totalUsers = totalUsers.add(1);
            tiersExAccount[tier] = tiersExAccount[tier].add(1);
        }

        userEx.payAmount = userEx.payAmount.add(_amount);
        userEx.saleAmount = userEx.saleAmount.add(tokenSaleAmount);

        totalExPurchasedAmount = totalExPurchasedAmount.add(_amount);
        totalExSaleAmount = totalExSaleAmount.add(tokenSaleAmount);

        calculTONTransferAmount(_amount, _sender);
    }

    /// @inheritdoc IPublicSale
    function deposit(
        address _sender,
        uint256 _amount
    ) 
        public 
        override 
        nonReentrant 
    {
        require(
            block.timestamp >= startDepositTime,
            "PublicSale: don't start depositTime"
        );
        require(
            block.timestamp < endDepositTime,
            "PublicSale: end the depositTime"
        );

        LibPublicSale.UserInfoOpen storage userOpen = usersOpen[_sender];

        if (!userOpen.join) {
            depositors.push(_sender);
            userOpen.join = true;

            totalRound2Users = totalRound2Users.add(1);
            LibPublicSale.UserInfoEx storage userEx = usersEx[_sender];
            if (userEx.payAmount == 0) totalUsers = totalUsers.add(1);
        }
        userOpen.depositAmount = userOpen.depositAmount.add(_amount);
        totalDepositAmount = totalDepositAmount.add(_amount);

        calculTONTransferAmount(_amount, _sender);
    }

    /// @inheritdoc IPublicSale
    function claim() external override {
        require(
            block.timestamp >= claimTimes[0],
            "PublicSale: don't start claimTime"
        );
        LibPublicSale.UserClaim storage userClaim = usersClaim[msg.sender];
        LibPublicSale.UserInfoOpen storage userOpen = usersOpen[msg.sender];

        (uint256 reward, uint256 realSaleAmount, uint256 refundAmount) = calculClaimAmount(msg.sender, 0);
        require(
            realSaleAmount > 0,
            "PublicSale: no purchase amount"
        );
        require(reward > 0, "PublicSale: no reward");
        require(
            realSaleAmount.sub(userClaim.claimAmount) >= reward,
            "PublicSale: user is already getAllreward"
        );
        require(
            saleToken.balanceOf(address(this)) >= reward,
            "PublicSale: dont have saleToken in pool"
        );

        userClaim.claimAmount = userClaim.claimAmount.add(reward);

        saleToken.safeTransfer(msg.sender, reward);

        if (!userClaim.exec && userOpen.join) {
            totalRound2UsersClaim = totalRound2UsersClaim.add(1);
            userClaim.exec = true;
        }

        if (refundAmount > 0 && userClaim.refundAmount == 0){
            require(refundAmount <= IERC20(getToken).balanceOf(address(this)), "PublicSale: dont have refund ton");
            userClaim.refundAmount = refundAmount;
            IERC20(getToken).safeTransfer(msg.sender, refundAmount);
        }

        emit Claimed(msg.sender, reward);
    }

    function approveToUniswap() external {
        IERC20(wton).approve(
            address(uniswapRouter),
            type(uint256).max
        );
    }

    function approveToWTON() external {
        IERC20(getToken).approve(
            wton,
            type(uint256).max
        );
    }

    /// @inheritdoc IPublicSale
    function depositWithdraw() external override onlyOwner {
        require(block.timestamp > endDepositTime,"PublicSale: need to end the depositTime");
        uint256 liquidityTON = calculPayToken(liquidityVaultAmount);
        uint256 getAmount;
        if (totalRound2Users == totalRound2UsersClaim){
            getAmount = IERC20(getToken).balanceOf(address(this)).sub(liquidityTON);
        } else {
            getAmount = totalOpenPurchasedAmount().sub(liquidityTON).sub(10 ether);
        }
        require(getAmount <= IERC20(getToken).balanceOf(address(this)), "PublicSale: no token to receive");
        
        IWTON(wton).swapFromTON(liquidityTON);
        uint256 wtonAmount = IERC20(wton).balanceOf(address(this));

        ISwapRouter.ExactInputSingleParams memory params =
            ISwapRouter.ExactInputSingleParams({
                tokenIn: wton,
                tokenOut: address(tos),
                fee: poolFee,
                recipient: address(this),
                deadline: block.timestamp,
                amountIn: wtonAmount,
                amountOutMinimum: 0,
                sqrtPriceLimitX96: 0
            });
        ISwapRouter(uniswapRouter).exactInputSingle(params);

        uint256 tosAmount = tos.balanceOf(address(this));

        tos.safeTransfer(liquidityVaultAddress, tosAmount);
        IERC20(getToken).safeTransfer(getTokenOwner, getAmount);
        emit DepositWithdrawal(msg.sender, getAmount, liquidityTON);
    }

    /// @inheritdoc IPublicSale
    function withdraw() external override onlyOwner{
        if (block.timestamp <= endDepositTime){
            uint256 balance = saleToken.balanceOf(address(this));
            require(balance > totalExpectSaleAmount.add(totalExpectOpenSaleAmount), "PublicSale: no withdrawable amount");
            uint256 withdrawAmount = balance.sub(totalExpectSaleAmount.add(totalExpectOpenSaleAmount));
            saleToken.safeTransfer(msg.sender, withdrawAmount);
            emit Withdrawal(msg.sender, withdrawAmount);
        } else {
            require(!adminWithdraw, "PublicSale: already admin called withdraw");
            adminWithdraw = true;
            uint256 saleAmount = totalOpenSaleAmount();
            require(totalExpectSaleAmount.add(totalExpectOpenSaleAmount) > totalExSaleAmount.add(saleAmount), "PublicSale: don't exist withdrawAmount");

            uint256 withdrawAmount = totalExpectSaleAmount.add(totalExpectOpenSaleAmount).sub(totalExSaleAmount).sub(saleAmount);

            saleToken.safeTransfer(msg.sender, withdrawAmount);
            emit Withdrawal(msg.sender, withdrawAmount);
        }
    }
}