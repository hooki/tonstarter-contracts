/* eslint-disable no-undef */
const chai = require("chai");
const { expect } = require("chai");

const { solidity } = require("ethereum-waffle");
chai.use(solidity);

const { time } = require("@openzeppelin/test-helpers");
const { toBN, toWei, keccak256, fromWei } = require("web3-utils");

const { getAddresses, findSigner, setupContracts } = require("./utils");
const { ethers, network } = require("hardhat");

const {
    calculateBalanceOfLock,
    calculateBalanceOfUser,
    createLockWithPermit,
  } = require("./helpers/lock-tos-helper");

const {
    ICO20Contracts,
    PHASE2_ETHTOS_Staking,
    PHASE2_MINING_PERSECOND,
    HASH_PHASE2_ETHTOS_Staking,
} = require("../../utils/ico_test_deploy_ethers.js");

const LockTOS_ABI = require("../..//artifacts/contracts/stake/LockTOS.sol/LockTOS.json");
const PublicSale_ABI = require('../../artifacts/contracts/sale/publicSale.sol/PublicSale.json');
// const PublicSaleForDoM_ABI = require('../../artifacts/contracts/sale/PublicSaleForDoM.sol/PublicSaleForDoM.json');

const zeroAddress = "0x0000000000000000000000000000000000000000";

//typeC로 세팅 업그레이드 테스트
describe("Sale", () => {
    //mockERC20으로 doc, ton 배포함
    //시나리오
    //티어별 참여자가 여러명일때 모든 풀에 참여자가 있을때 테스트 (티어1,2,3,4에 모든 유저가 whitelist했고 exclusive했을 경우)
    //saleTokenPrice(DOC) = 12원
    //payTokenPrice(TON) = 12,000원
    //TON 10개 = DOC 10,000개  1: 1000
    //티어1 : 100 sTOS, 6%(600)     /60,000 DOC -> TON 60개 
    //티어2 : 200 sTOS, 12%(1200)   /120,000 DOC -> TON 120개
    //티어3 : 1,000 sTOS, 22%(2200) /220,000 DOC -> TON 220개
    //티어4 : 4,000 sTOS, 60%(6000) /600,000 DOC -> TON 600개
    //Round1 : 1,000,000 -> 1000개 참여면 끝 (총 1000TON 참여)
    //account1 -> 티어 1 참여 -> 60,000DOC 할당 -> TON 60개 (WTON으로 참여)
    //account2 -> 티어 2 참여 -> 120,000DOC 할당 -> TON 120개
    //account3 -> 티어 3 참여 -> 220,000DOC 할당 -> TON 220개
    //account4 -> 티어 4 참여 -> 300,000DOC 할당 -> TON 300개
    //account6 -> 티어 4 참여 -> 300,000DOC 할당 -> TON 300개
    //Round2 : 1,000,000 -> 1000개 참여면 끝 (총 2000TON 참여 -> 1000개구매 끝, 1000개 환불)
    //account1 -> 200개 참여 (TON 200개) -> 200/2000 * 1,000,000 = 100,000 DOC -> 100TON 사용 100TON 환불
    //account2 -> 400개 참여 (WTON 400개) -> 400/2000 * 1,000,000 = 200,000 DOC -> 200TON 사용 200TON 환불
    //account3 -> 600개 참여 (TON 300개, WTON 300개) -> 600/2000 * 1,000,000 = 300,000 DOC -> 300TON 사용 300TON 환불
    //account4 -> 800개 참여 (TON 800개) -> 800/2000 * 1,000,000 = 400,000 DOC -> 400TON 사용 400TON 환불
    //total 구매 및 결과
    //account1 -> 160,000 DOC -> 260TON 참여 -> 160 TON 구매 100 TON 환불
    //account2 -> 320,000 DOC -> 520TON 참여 -> 320 TON 구매 200 TON 환불
    //account3 -> 520,000 DOC -> 820TON 참여 -> 520 TON 구매 300 TON 환불
    //account4 -> 700,000 DOC -> 1100TON 참여 -> 700 TON 구매 400 TON 환불
    //account6 -> 300,000 DOC -> 300TON 참여 -> 300 TON 구매

    //원하는 시간에 맞춰서 정해진 수량 배분 (총 6번 실행할 것 시간은 처음 클레임 시작 후 1분 후 2분 후 3분 후 4분 후 로 테스트)
    //claimPercent1 = 30%
    //claimPercent2 = 20%
    //claimPercent3 = 20%
    //claimPercent4 = 20%
    //claimPercent5 = 10%

    //account1 = 48,000 , 32,000 , 32,000, 32,000 , 16,000 -> 160,000 DOC
    //account2 = 96,000 , 64,000 , 64,000, 64,000 , 32,000 -> 320,000 DOC
    //account3 = 156,000 , 104,000 , 104,000, 104,000, 52,000 -> 520,000 DOC
    //account4 = 210,000 , 140,000 , 140,000, 140,000 , 70,000 -> 700,000 DOC
    //account6 = 90,000 , 60,000 , 60,000, 60,000 , 30,000 -> 300,000 DOC

    let claimPercent1 = 30;
    let claimPercent2 = 20;
    let claimPercent3 = 20;
    let claimPercent4 = 20;
    let claimPercent5 = 10;
    
    let claimTime1, claimTime2, claimTime3, claimTime4, claimTime5;

    let claimCounts = 5;
    
    let saleTokenPrice = 12;
    let payTokenPrice = 12000;

    let saleTokenOwner;         //doc
    let getTokenOwner;         //ton
    let tosTokenOwner;          //sTOS
    let saleOwner;              //publicContract
    let vaultAddress;
    let vaultAmount = ethers.utils.parseUnits("500000", 18);            //500,000 token -> 500 TON

    let account1;
    let account2;
    let account3;
    let account4;
    let account5;
    let account6;
    
    let ico20Contracts;
    let TokamakContractsDeployed;
    let ICOContractsDeployed;

    // let account3 = accounts[6];   
    // let account4 = accounts[7];
    let balance1, balance2, balance3;
    
    let erc20token, erc20snapToken, saleToken, getToken, tosToken, deploySale, saleContract;

    // let BN = toBN("1");
    // let basicAmount = toBN("1000");

    let basicAmount = 1000000;          //round1 판매량
    let totalSaleAmount = 1000000;      //round2 판매량
    let round1SaleAmount = ethers.utils.parseUnits("1000000", 18);
    let round2SaleAmount = ethers.utils.parseUnits("1000000", 18);
    let totalBigAmount = ethers.utils.parseUnits("2000000", 18); //round1, round2 판매량

    let account1BigTONAmount = ethers.utils.parseUnits("200", 18);
    let account1BigWTONAmount = ethers.utils.parseUnits("60", 27);
    let account2BigTONAmount = ethers.utils.parseUnits("120", 18);
    let account2BigWTONAmount = ethers.utils.parseUnits("400", 27);
    let account3BigTONAmount = ethers.utils.parseUnits("520", 18);
    let account3BigWTONAmount = ethers.utils.parseUnits("300", 27);
    let account4BigTONAmount = ethers.utils.parseUnits("1100", 18);
    let account4BigWTONAmount = ethers.utils.parseUnits("1100", 27);
    let account6BigTONAmount = ethers.utils.parseUnits("300", 18);

    let refundAmount1 = ethers.utils.parseUnits("100", 18);
    let refundAmount2 = ethers.utils.parseUnits("200", 18);
    let refundAmount3 = ethers.utils.parseUnits("300", 18);
    let refundAmount4 = ethers.utils.parseUnits("400", 18);

    let setSnapshot;
    let blocktime;
    let whitelistStartTime;
    let whitelistEndTime;
    let exclusiveStartTime;
    let exclusiveEndTime;
    let depositStartTime;
    let depositEndTime;
    let openSaleStartTime;
    let openSaleEndTime;
    let claimStartTime;

    let claimInterval = 86400;  //86400은 하루
    let claimPeriod = 6;
    let claimTestTime;
    let claimFirst = 50;

    let tos, ton, lockTOS, lockTOSImpl, lockTOSProxy ;
    let epochUnit, maxTime;
    const name = "TONStarter";
    const symbol = "TOS";
    const version = "1.0";
    // const tosAmount = ethers.BigNumber.from('100000000000000000000');
    const tosAmount = 100000000000;
    let deployer, user1, user2;
    let defaultSender;
    let userLockInfo = [];
    let account1Before, account1After;
    let account2Before, account2After;
    let account3Before, account3After;
    let account4Before, account4After;
    let publicFactory;
    let deploySaleImpl;

    let tester1 = {
        account: null,
        lockTOSIds: [],
        balanceOf: 0,
        snapshot: 0,
        balanceOfAt: 0,
        wtonAmount: null,
        tonAmount: null
    }
    let tester2 = {
        account: null,
        lockTOSIds: [],
        balanceOf: 0,
        snapshot: 0,
        balanceOfAt: 0,
        wtonAmount: null,
        tonAmount: null
    }

    let tester3 = {
        account: null,
        lockTOSIds: [],
        balanceOf: 0,
        snapshot: 0,
        balanceOfAt: 0,
        wtonAmount: null,
        tonAmount: null
    }

    let tester4 = {
        account: null,
        lockTOSIds: [],
        balanceOf: 0,
        snapshot: 0,
        balanceOfAt: 0,
        wtonAmount: null,
        tonAmount: null
    }

    let tester6 = {
        account: null,
        lockTOSIds: [],
        balanceOf: 0,
        snapshot: 0,
        balanceOfAt: 0,
        wtonAmount: null,
        tonAmount: null
    }

    let saleContracts = [
        {
         name : "Test1",
         owner : null,
         contractAddress: null,
         index : null,
  
        },
        {
         name : "Test2",
         owner : null,
         contractAddress: null,
         index : null
        },
        {
         name : "Test3",
         owner : null,
         contractAddress: null,
         index : null
        },
    ]

    before(async () => {
        ico20Contracts = new ICO20Contracts();

        const addresses = await getAddresses();
        defaultSender = addresses[0];
        saleTokenOwner = await findSigner(addresses[0]);
        getTokenOwner = await findSigner(addresses[1]);
        tosTokenOwner = await findSigner(addresses[2]);
        saleOwner = await findSigner(addresses[3]);
        account1 = await findSigner(addresses[4]);
        account2 = await findSigner(addresses[5]);
        account3 = await findSigner(addresses[6]);
        account4 = await findSigner(addresses[7]);
        account5 = await findSigner(addresses[8]);
        account6 = await findSigner(addresses[9]);
        vaultAddress = await findSigner(addresses[10]);

        saleContracts[0].owner = saleOwner;
        saleContracts[1].owner = account1;
        saleContracts[2].owner = account2;

        deployer = saleTokenOwner;
        tester1.account = account1;
        tester2.account = account2;
        tester3.account = account3;
        tester4.account = account4;
        tester6.account = account6;
        
        // for sTOS
        epochUnit = 60*60*1;  // 1시간
        maxTime = epochUnit * 156;
    });

    describe("Initialize TON, TOS, LockTOS", () => {
        // it("Initialize TON ", async function () {
        //     // this.timeout(1000000);
        //     // let dummy;
        //     // ({ dummy, ton } = await setupContracts(deployer.address));
        //     erc20token = await ethers.getContractFactory("ERC20Mock");
        //     ton = await erc20token.connect(getTokenOwner).deploy("testTON", "TON");
        // });

        //TOS Contract deploy
        it("Initialize TOS", async function () {
            const TOS = await ethers.getContractFactory("TOS");
            tos = await TOS.deploy(name, symbol, version);
            await tos.deployed();
        });

        //LockTOS Contract deploy (need the TOS staking)
        it("Deploy LockTOS", async function () {
            lockTOSImpl = await (await ethers.getContractFactory("LockTOS")).deploy();
            await lockTOSImpl.deployed();

            lockTOSProxy = await (
                await ethers.getContractFactory("LockTOSProxy")
            ).deploy(lockTOSImpl.address, deployer.address);
            await lockTOSProxy.deployed();

            await (
                await lockTOSProxy.initialize(tos.address, epochUnit, maxTime)
            ).wait();

            lockTOS = new ethers.Contract( lockTOSProxy.address, LockTOS_ABI.abi, ethers.provider );
        });

        //give the TOS
        it("mint TOS to users", async function () {
            await (await tos.connect(deployer).mint(tester1.account.address, tosAmount)).wait();
            expect(await tos.balanceOf(tester1.account.address)).to.be.equal(tosAmount);

            await (await tos.connect(deployer).mint(tester2.account.address, tosAmount)).wait();
            expect(await tos.balanceOf(tester2.account.address)).to.be.equal(tosAmount);

            await (await tos.connect(deployer).mint(tester3.account.address, tosAmount)).wait();
            expect(await tos.balanceOf(tester3.account.address)).to.be.equal(tosAmount);

            await (await tos.connect(deployer).mint(tester4.account.address, tosAmount)).wait();
            expect(await tos.balanceOf(tester4.account.address)).to.be.equal(tosAmount);

            await (await tos.connect(deployer).mint(tester6.account.address, tosAmount)).wait();
            expect(await tos.balanceOf(tester6.account.address)).to.be.equal(tosAmount);
        });

        describe("# 1. Deploy WTON, TON", async function() {
            it("1. ico20Contracts init  ", async function () {
                this.timeout(1000000);
                ICOContractsDeployed = await ico20Contracts.initializeICO20Contracts(
                    defaultSender
                );
            });
            
            //ton, wton deploy
            it("2. tokamakContracts init  ", async function () {
                this.timeout(1000000);
                TokamakContractsDeployed =
                  await ico20Contracts.initializePlasmaEvmContracts(defaultSender);
                const cons = await ico20Contracts.getPlasamContracts();
          
                ton = cons.ton;
                wton = cons.wton;
          
                await ton.mint(defaultSender, ethers.utils.parseUnits("1000", 18), {
                  from: defaultSender,
                });
                await wton.mint(defaultSender, ethers.utils.parseUnits("1000", 27), {
                  from: defaultSender,
                });
    
                // await ton.mint(tester1.account.address, tester1.tonAmount, {
                //     from: defaultSender,
                // });
                // await ton.mint(tester2.account.address, tester2.tonAmount, {
                //     from: defaultSender,
                // });
                // await ton.mint(tester3.account.address, tester3.tonAmount, {
                //     from: defaultSender,
                // });
          
                // await wton.mint(tester1.account.address, tester1.wtonAmount, {
                //     from: defaultSender,
                // });
                // await wton.mint(tester2.account.address, tester2.wtonAmount, {
                //     from: defaultSender,
                // });
                // await wton.mint(tester3.account.address, tester3.wtonAmount, {
                //     from: defaultSender,
                // });
            });
        })

        //TOS staking for get the sTOS balance
        it("should create locks for user", async function () {
            expect(await lockTOS.balanceOf(tester1.account.address)).to.be.equal(0);
            expect(await lockTOS.balanceOf(tester2.account.address)).to.be.equal(0);

            let id = await createLockWithPermit({
                user: tester1.account,
                amount: 15500,
                unlockWeeks: 2,
                tos,
                lockTOS,
            });
            expect(id).to.be.equal(1);
            tester1.lockTOSIds.push(id);

            id = await createLockWithPermit({
                user: tester2.account,
                amount: 35000,
                unlockWeeks: 2,
                tos,
                lockTOS,
            });
            tester2.lockTOSIds.push(id);
            expect(id).to.be.equal(2);

            id = await createLockWithPermit({
                user: tester3.account,
                amount: 170000,
                unlockWeeks: 2,
                tos,
                lockTOS,
            });
            tester3.lockTOSIds.push(id);
            expect(id).to.be.equal(3);

            id = await createLockWithPermit({
                user: tester4.account,
                amount: 650000,
                unlockWeeks: 2,
                tos,
                lockTOS,
            });
            tester4.lockTOSIds.push(id);
            expect(id).to.be.equal(4);

            id = await createLockWithPermit({
                user: tester6.account,
                amount: 650000,
                unlockWeeks: 2,
                tos,
                lockTOS,
            });
            tester6.lockTOSIds.push(id);
            expect(id).to.be.equal(5);

            // ethers.provider.send("evm_increaseTime", [10])   // add 26 seconds
            // ethers.provider.send("evm_mine")      // mine the next block

            const block = await ethers.provider.getBlock('latest')
            if (!block) {
                throw new Error('null block returned from provider')
            }


            setSnapshot = block.timestamp;

            tester1.balanceOfAt = Number(await lockTOS.balanceOfAt(tester1.account.address, setSnapshot))
            
            tester2.balanceOfAt = Number(await lockTOS.balanceOfAt(tester2.account.address, setSnapshot))
            
            tester3.balanceOfAt = Number(await lockTOS.balanceOfAt(tester3.account.address, setSnapshot))
            
            tester4.balanceOfAt = Number(await lockTOS.balanceOfAt(tester4.account.address, setSnapshot))
            
            tester6.balanceOfAt = Number(await lockTOS.balanceOfAt(tester6.account.address, setSnapshot))
            // console.log(tester1.balanceOfAt)
            // console.log(tester2.balanceOfAt)
            // console.log(tester3.balanceOfAt)
            // console.log(tester4.balanceOfAt)
            // console.log(tester6.balanceOfAt)
            
            expect(tester1.balanceOfAt).to.be.above(0);
            expect(tester2.balanceOfAt).to.be.above(0);
            expect(tester3.balanceOfAt).to.be.above(0);
            expect(tester4.balanceOfAt).to.be.above(0);

        });

    });

    describe("Initialize PublicSaleProxyFactroy and PublicSale", () => {
        //funding Token set(TON)
        it("Initialize Funding Token", async function () {
            getToken = ton;
        });

        //saleToken Deploy
        it("Initialize Sale Token", async function () {
            erc20token = await ethers.getContractFactory("ERC20Mock");
            saleToken = await erc20token.connect(saleTokenOwner).deploy("testDoM", "AURA");
        });

        it("deploy PublicSlaeFactory", async () => {
            const PublicSaleProxyFactory = await ethers.getContractFactory("PublicSaleProxyFactory");

            publicFactory = await PublicSaleProxyFactory.connect(saleTokenOwner).deploy();

            let code = await saleTokenOwner.provider.getCode(publicFactory.address);
            expect(code).to.not.eq("0x");
        })

        //deploy publicSale and publicSaleProxy and transfer TON, WTON
        it("Initialize PublicSale", async function () {
            let PublicSale = await ethers.getContractFactory("PublicSale");
            deploySaleImpl = await PublicSale.connect(saleOwner).deploy();

            let code = await saleOwner.provider.getCode(deploySaleImpl.address);
            expect(code).to.not.eq("0x");
        });

        it("deploy PublicSaleProxy from Factory", async () => {

            let publicSaleContract = saleContracts[0];
            let prevTotalCreatedContracts = await publicFactory.totalCreatedContracts();
        
            await publicFactory.connect(saleTokenOwner).create(
                publicSaleContract.name,
                deploySaleImpl.address,
                publicSaleContract.owner.address,
                [
                    saleToken.address,
                    account5.address,
                    vaultAddress.address,
                ],
                [
                    getToken.address,
                    lockTOS.address,
                    wton.address
                ]
            );
        
            let afterTotalCreatedContracts = await publicFactory.totalCreatedContracts();
        
            publicSaleContract.index = prevTotalCreatedContracts;
            expect(afterTotalCreatedContracts).to.be.equal(prevTotalCreatedContracts.add(1));
        
            let info = await publicFactory.connect(saleOwner).getContracts(publicSaleContract.index);
            expect(info.name).to.be.equal(publicSaleContract.name);
            publicSaleContract.contractAddress = info.contractAddress;

            saleContract = new ethers.Contract( publicSaleContract.contractAddress, PublicSale_ABI.abi, ethers.provider );
            expect(await saleContract.isAdmin(saleTokenOwner.address)).to.be.equal(false);
            expect(await saleContract.isAdmin(publicSaleContract.owner.address)).to.be.equal(true);
            //2,000,000의 판매량
            await saleToken.connect(saleTokenOwner).transfer(saleContract.address, totalBigAmount)
            
            //account1 = WTON 60, TON 200
            //account2 = WTON 400, TON 120
            //account3 = WTON 300, TON 520
            //account4 = WTON 0, TON 1100
            //account6 = WTON 0, TON 300
            await getToken.connect(saleTokenOwner).transfer(account1.address, account1BigTONAmount)
            await wton.mint(account1.address, account1BigWTONAmount, {
                from: defaultSender,
            });
            await getToken.connect(saleTokenOwner).mint(account2.address, account2BigTONAmount)
            await wton.mint(account2.address, account2BigWTONAmount, {
                from: defaultSender,
            });
            await getToken.connect(saleTokenOwner).mint(account3.address, account3BigTONAmount)
            await wton.mint(account3.address, account3BigWTONAmount, {
                from: defaultSender,
            });
            await getToken.connect(saleTokenOwner).mint(account4.address, account4BigTONAmount)
            await getToken.connect(saleTokenOwner).mint(account6.address, account6BigTONAmount)
        });
    });

    describe("setting", () => {
        describe("exclusiveSale setting", () => {
            //checking the SaleToken balance
            it("check the balance (contract have the saleToken) ", async () => {
                balance1 = await saleToken.balanceOf(saleContract.address)
    
                expect(Number(balance1)).to.be.equal(Number(totalBigAmount))
            })

            //setting owner test
            it('setAllsetting caller not owner', async () => {
                blocktime = Number(await time.latest())
                whitelistStartTime = blocktime + 86400;
                whitelistEndTime = whitelistStartTime + (86400*7);
                exclusiveStartTime = whitelistEndTime + 1;
                exclusiveEndTime = exclusiveStartTime + (86400*7);
                depositStartTime = exclusiveEndTime;
                depositEndTime = depositStartTime + (86400*7);
                claimTime1 = depositEndTime + (86400 * 20);
                claimTime2 = claimTime1 + (60 * 1);
                claimTime3 = claimTime2 + (60 * 2);
                claimTime4 = claimTime3 + (60 * 3);
                claimTime5 = claimTime4 + (60 * 4);

                let tx = saleContract.connect(account1).setAllsetting(
                    [100, 200, 1000, 4000, 600, 1200, 2200, 6000],
                    [round1SaleAmount, round2SaleAmount, vaultAmount, saleTokenPrice, payTokenPrice],
                    [setSnapshot, whitelistStartTime, whitelistEndTime, exclusiveStartTime, exclusiveEndTime, depositStartTime, depositEndTime, claimCounts],
                    [claimTime1,claimTime2,claimTime3,claimTime4,claimTime5],
                    [claimPercent1,claimPercent2,claimPercent3,claimPercent4,claimPercent5]
                )
                await expect(tx).to.be.revertedWith("Accessible: Caller is not an admin")
            })

            //PublicSale setting owner
            it('setAllsetting caller owner', async () => {

                await saleContract.connect(saleOwner).setAllsetting(
                    [100, 200, 1000, 4000, 600, 1200, 2200, 6000],
                    [round1SaleAmount, round2SaleAmount, vaultAmount, saleTokenPrice, payTokenPrice],
                    [setSnapshot, whitelistStartTime, whitelistEndTime, exclusiveStartTime, exclusiveEndTime, depositStartTime, depositEndTime, claimCounts],
                    [claimTime1,claimTime2,claimTime3,claimTime4,claimTime5],
                    [claimPercent1,claimPercent2,claimPercent3,claimPercent4,claimPercent5]
                )

                let tx = await saleContract.connect(saleOwner).saleTokenPrice()
                let tx2 = await saleContract.connect(saleOwner).payTokenPrice()
                // console.log("tx : ", tx)
                expect(tx).to.be.equal(saleTokenPrice)
                // console.log("tx : ", tx2)
                expect(tx2).to.be.equal(payTokenPrice)

                let tx3 = Number(await saleContract.connect(saleOwner).totalExpectSaleAmount())
                // console.log("tx3 : ", tx3)
                expect(tx3).to.be.equal(Number(round1SaleAmount))
                let tx4 = Number(await saleContract.connect(saleOwner).totalExpectOpenSaleAmount())
                // console.log("tx4 : ", tx4)
                expect(tx4).to.be.equal(Number(round2SaleAmount))
                
                let tx5 = Number(await saleContract.connect(saleOwner).tiers(1))
                expect(tx5).to.be.equal(100)
                let tx6 = Number(await saleContract.connect(saleOwner).tiers(2))
                expect(tx6).to.be.equal(200)
                let tx7 = Number(await saleContract.connect(saleOwner).tiers(3))
                expect(tx7).to.be.equal(1000)
                let tx8 = Number(await saleContract.connect(saleOwner).tiers(4))
                expect(tx8).to.be.equal(4000)
                let tx9 = Number(await saleContract.connect(saleOwner).tiersPercents(1))
                expect(tx9).to.be.equal(600)
                let tx10 = Number(await saleContract.connect(saleOwner).tiersPercents(2))
                expect(tx10).to.be.equal(1200)
                let tx11 = Number(await saleContract.connect(saleOwner).tiersPercents(3))
                expect(tx11).to.be.equal(2200)
                let tx12 = Number(await saleContract.connect(saleOwner).tiersPercents(4))
                expect(tx12).to.be.equal(6000) 
                
                let tier1snap = Number(await lockTOS.balanceOfAt(tester1.account.address, setSnapshot))
                expect(tier1snap).to.be.above(100)
                let tier2snap = Number(await lockTOS.balanceOfAt(tester2.account.address, setSnapshot))
                expect(tier2snap).to.be.above(200)
                let tier3snap = Number(await lockTOS.balanceOfAt(tester3.account.address, setSnapshot))
                expect(tier3snap).to.be.above(1000)
                let tier4snap = Number(await lockTOS.balanceOfAt(tester4.account.address, setSnapshot))
                expect(tier4snap).to.be.above(4000) 
                let tier5snap = Number(await lockTOS.balanceOfAt(tester6.account.address, setSnapshot))
                expect(tier5snap).to.be.above(4000) 

                let tx13 = Number(await saleContract.startExclusiveTime())
                expect(tx13).to.be.equal(exclusiveStartTime)
                let tx14 = Number(await saleContract.endExclusiveTime())
                expect(tx14).to.be.equal(exclusiveEndTime)
                let tx15 = Number(await saleContract.startAddWhiteTime())
                expect(tx15).to.be.equal(whitelistStartTime)
                let tx16 = Number(await saleContract.endAddWhiteTime())
                expect(tx16).to.be.equal(whitelistEndTime)

                let tx17 = Number(await saleContract.claimTimes(0))
                expect(tx17).to.be.equal(claimTime1)
                let tx18 = Number(await saleContract.totalClaimCounts())
                expect(tx18).to.be.equal(claimCounts)
            })

        })
        
    })
    
    describe("Sale", () => {
        describe("exclusiveSale Sale", () => {
            //calculTierAmount test
            it("calculTierAmount test before addwhiteList", async () => {
                let big60000 = ethers.utils.parseUnits("60000", 18);
                let big120000 = ethers.utils.parseUnits("120000", 18);
                let big220000 = ethers.utils.parseUnits("220000", 18);
                let big600000 = ethers.utils.parseUnits("600000", 18);
                let tx = Number(await saleContract.calculTierAmount(account1.address))
                expect(tx).to.be.equal(Number(big60000))
                let tx2 = Number(await saleContract.calculTierAmount(account2.address))
                expect(tx2).to.be.equal(Number(big120000))
                let tx3 = Number(await saleContract.calculTierAmount(account3.address))
                expect(tx3).to.be.equal(Number(big220000))
                let tx4 = Number(await saleContract.calculTierAmount(account4.address))
                expect(tx4).to.be.equal(Number(big600000))
                let tx5 = Number(await saleContract.calculTierAmount(account6.address))
                expect(tx5).to.be.equal(Number(big600000))
            })

            it("duration the time", async () => {
                await ethers.provider.send('evm_setNextBlockTimestamp', [whitelistStartTime]);
                await ethers.provider.send('evm_mine');
            })

            //addwhiteList test and data check
            it("addwhiteList", async () => {
                let tx = Number(await saleContract.connect(tester1.account).tiersAccount(1))
                expect(tx).to.be.equal(0)
                await saleContract.connect(tester1.account).addWhiteList()
                let tx2 = Number(await saleContract.connect(tester1.account).tiersAccount(1))
                expect(tx2).to.be.equal(1)

                let tx3 = Number(await saleContract.connect(tester2.account).tiersAccount(2))
                expect(tx3).to.be.equal(0)
                await saleContract.connect(tester2.account).addWhiteList()
                let tx4 = Number(await saleContract.connect(tester2.account).tiersAccount(2))
                expect(tx4).to.be.equal(1)

                let tx5 = Number(await saleContract.connect(tester3.account).tiersAccount(3))
                expect(tx5).to.be.equal(0)
                await saleContract.connect(tester3.account).addWhiteList()
                let tx6 = Number(await saleContract.connect(tester3.account).tiersAccount(3))
                expect(tx6).to.be.equal(1)

                let tx7 = Number(await saleContract.connect(tester4.account).tiersAccount(4))
                expect(tx7).to.be.equal(0)
                await saleContract.connect(tester4.account).addWhiteList()
                let tx8 = Number(await saleContract.connect(tester4.account).tiersAccount(4))
                expect(tx8).to.be.equal(1)

                let tx9 = saleContract.connect(tester4.account).addWhiteList()
                await expect(tx9).to.be.revertedWith("PublicSale: already attended")
                
                let big300000 = ethers.utils.parseUnits("300000", 18);
                let big600000 = ethers.utils.parseUnits("600000", 18);
                let tx10 = Number(await saleContract.calculTierAmount(account6.address))
                expect(tx10).to.be.equal(Number(big300000))

                let tx11 = Number(await saleContract.calculTierAmount(account4.address))
                expect(tx11).to.be.equal(Number(big600000))

                let tx12 = Number(await saleContract.connect(tester6.account).tiersAccount(4))
                expect(tx12).to.be.equal(1)
                await saleContract.connect(tester6.account).addWhiteList()
                let tx13 = Number(await saleContract.connect(tester6.account).tiersAccount(4))
                expect(tx13).to.be.equal(2)

                let tx14 = Number(await saleContract.calculTierAmount(account6.address))
                expect(tx14).to.be.equal(Number(big300000))

                let tx15 = Number(await saleContract.calculTierAmount(account4.address))
                expect(tx15).to.be.equal(Number(big300000))
            })

            //calculate how many input ton amount
            it("how many input amount", async () => {
                let tx = Number(await saleContract.calculPayToken(60000))
                expect(tx).to.be.equal(60)
                let tx2 = Number(await saleContract.calculPayToken(120000))
                expect(tx2).to.be.equal(120)
                let tx3 = Number(await saleContract.calculPayToken(220000))
                expect(tx3).to.be.equal(220)
                let tx4 = Number(await saleContract.calculPayToken(300000))
                expect(tx4).to.be.equal(300)
                let tx5 = Number(await saleContract.calculPayToken(300000))
                expect(tx5).to.be.equal(300)
            })

            //calculTierAmount test (before and after different)
            it("calculTierAmount test after addwhiteList", async () => {
                let big60000 = ethers.utils.parseUnits("60000", 18);
                let big120000 = ethers.utils.parseUnits("120000", 18);
                let big220000 = ethers.utils.parseUnits("220000", 18);
                let big300000 = ethers.utils.parseUnits("300000", 18);
                let tx = Number(await saleContract.calculTierAmount(account1.address))
                expect(tx).to.be.equal(Number(big60000))
                let tx2 = Number(await saleContract.calculTierAmount(account2.address))
                expect(tx2).to.be.equal(Number(big120000))
                let tx3 = Number(await saleContract.calculTierAmount(account3.address))
                expect(tx3).to.be.equal(Number(big220000))
                let tx4 = Number(await saleContract.calculTierAmount(account4.address))
                expect(tx4).to.be.equal(Number(big300000))
                let tx5 = Number(await saleContract.calculTierAmount(account6.address))
                expect(tx5).to.be.equal(Number(big300000))
            })
            
            //time condition test
            it("exclusiveSale before exclusive startTime", async () => {
                await getToken.connect(account1).approve(saleContract.address, 60)
                let tx = saleContract.connect(account1).exclusiveSale(account1.address,60)
                await expect(tx).to.be.revertedWith("PublicSale: exclusiveStartTime has not passed")
            })

            it("duration the time", async () => {
                await ethers.provider.send('evm_setNextBlockTimestamp', [exclusiveStartTime]);
                await ethers.provider.send('evm_mine');

                await time.increaseTo(exclusiveStartTime+86400);
            })

            //time condition test
            it("addwhitelist after whitelistTIme", async () => {
                let tx = saleContract.connect(account1).addWhiteList()
                await expect(tx).to.be.revertedWith("PublicSale: end the whitelistTime")
            })

            //round1 sale test
            it("exclusiveSale after exclusive startTime", async () => {
                let big60 = ethers.utils.parseUnits("60", 18);
                let account1TON = Number(await getToken.balanceOf(account1.address))
                let account1WTON = Number(await wton.balanceOf(account1.address))
                let account2TON = Number(await getToken.balanceOf(account2.address))
                let account2WTON = Number(await wton.balanceOf(account2.address))
                let account3TON = Number(await getToken.balanceOf(account3.address))
                let account3WTON = Number(await wton.balanceOf(account3.address))
                let account4TON = Number(await getToken.balanceOf(account4.address))
                let account4WTON = Number(await wton.balanceOf(account4.address))
                let account6TON = Number(await getToken.balanceOf(account6.address))
                let account6WTON = Number(await wton.balanceOf(account6.address))
                
                // let contractTON = Number(await getToken.balanceOf(account5.address))
                // console.log("contract TON :", contractTON)

                // console.log("account1 TON :", account1TON)
                // console.log("account1 WTON :", account1WTON)
                // console.log("account2 TON :", account2TON)
                // console.log("account2 WTON :", account2WTON)
                // console.log("account3 TON :", account3TON)
                // console.log("account3 WTON :", account3WTON)
                // console.log("account4 TON :", account4TON)
                // console.log("account4 WTON :", account4WTON)
                // console.log("account6 TON :", account6TON)
                // console.log("account6 WTON :", account6WTON)

                await wton.connect(account1).approveAndCall(saleContract.address, account1BigWTONAmount, 0);
                // await wton.connect(account1).approve(saleContract.address, account1BigWTONAmount)
                // await saleContract.connect(account1).exclusiveSale(account1.address,big60)
                let tx = await saleContract.usersEx(account1.address)
                expect(Number(tx.payAmount)).to.be.equal(Number(big60))

                let big120 = ethers.utils.parseUnits("120", 18);
                await getToken.connect(account2).approveAndCall(saleContract.address, big120, 0);
                // await saleContract.connect(account2).exclusiveSale(account2.address,big120)
                let tx2 = await saleContract.usersEx(account2.address)
                expect(Number(tx2.payAmount)).to.be.equal(Number(big120))
                
                let big220 = ethers.utils.parseUnits("220", 18);
                await getToken.connect(account3).approveAndCall(saleContract.address, big220, 0);
                // await getToken.connect(account3).approve(saleContract.address, big220)
                // await saleContract.connect(account3).exclusiveSale(account3.address,big220)
                let tx3 = await saleContract.usersEx(account3.address)
                expect(Number(tx3.payAmount)).to.be.equal(Number(big220))
                
                let big300 = ethers.utils.parseUnits("300", 18);
                await getToken.connect(account4).approveAndCall(saleContract.address, big300, 0);
                // await getToken.connect(account4).approve(saleContract.address, big300)
                // await saleContract.connect(account4).exclusiveSale(account4.address,big300)
                let tx4 = await saleContract.usersEx(account4.address)
                expect(Number(tx4.payAmount)).to.be.equal(Number(big300))
                
                await getToken.connect(account6).approveAndCall(saleContract.address, account6BigTONAmount, 0);
                // await getToken.connect(account6).approve(saleContract.address, account6BigTONAmount)
                // await saleContract.connect(account6).exclusiveSale(account6.address,account6BigTONAmount)
                let tx5 = await saleContract.usersEx(account6.address)
                expect(Number(tx5.payAmount)).to.be.equal(Number(account6BigTONAmount))
                
                
                let account1TON2 = Number(await getToken.balanceOf(account1.address))
                let account1WTON2 = Number(await wton.balanceOf(account1.address))
                let account2TON2 = Number(await getToken.balanceOf(account2.address))
                let account2WTON2 = Number(await wton.balanceOf(account2.address))
                let account3TON2 = Number(await getToken.balanceOf(account3.address))
                let account3WTON2 = Number(await wton.balanceOf(account3.address))
                let account4TON2 = Number(await getToken.balanceOf(account4.address))
                let account4WTON2 = Number(await wton.balanceOf(account4.address))
                let account6TON2 = Number(await getToken.balanceOf(account6.address))
                let account6WTON2 = Number(await wton.balanceOf(account6.address))
                // console.log("------------------------------------------------------")
                // console.log("account1 TON2 :", account1TON2)
                // console.log("account1 WTON2 :", account1WTON2)
                // console.log("account2 TON2 :", account2TON2)
                // console.log("account2 WTON2 :", account2WTON2)
                // console.log("account3 TON2 :", account3TON2)
                // console.log("account3 WTON2 :", account3WTON2)
                // console.log("account4 TON2 :", account4TON2)
                // console.log("account4 WTON2 :", account4WTON2)
                // console.log("account6 TON2 :", account6TON2)
                // console.log("account6 WTON2 :", account6WTON2)

                let big1000 = ethers.utils.parseUnits("1000", 18);
                let big1000000 = ethers.utils.parseUnits("1000000", 18);
                let tx6 = Number(await saleContract.totalExPurchasedAmount())
                expect(tx6).to.be.equal(Number(big1000))
                let tx7 = Number(await saleContract.totalExSaleAmount())
                expect(tx7).to.be.equal(Number(big1000000))
                let tx8 = Number(await getToken.balanceOf(account5.address))
                expect(tx8).to.be.equal(Number(big1000))
            })
        })

        describe("openSale Sale", () => {
            //time condition test
            it("deposit before depositTime", async () => {
                let tx = saleContract.connect(account1).deposit(account1.address,100)
                await expect(tx).to.be.revertedWith("PublicSale: don't start depositTime")
            })

            it("duration the time", async () => {
                await ethers.provider.send('evm_setNextBlockTimestamp', [depositStartTime]);
                await ethers.provider.send('evm_mine');
            })

            //round2 deposit
            it("deposit after depositTime", async () => {
                account1Before = Number(await getToken.balanceOf(account1.address))
                account2Before = Number(await getToken.balanceOf(account2.address))
                account3Before = Number(await getToken.balanceOf(account3.address))
                account4Before = Number(await getToken.balanceOf(account4.address))

                // let big10 = ethers.utils.parseUnits("10", 18);
                // await getToken.connect(saleTokenOwner).transfer(account1.address, big10)
                
                let big300 = ethers.utils.parseUnits("300", 18);
                let big200 = ethers.utils.parseUnits("200", 18);
                let big400 = ethers.utils.parseUnits("400", 18);
                let big600 = ethers.utils.parseUnits("600", 18);
                let big800 = ethers.utils.parseUnits("800", 18);
                // await getToken.connect(account1).approve(saleContract.address, big200)                       //200
                // await wton.connect(account2).approve(saleContract.address, account2BigWTONAmount)           //400
                // await getToken.connect(account3).approve(saleContract.address, big300)                      //300
                await wton.connect(account3).approve(saleContract.address, account3BigWTONAmount)           //300
                // await getToken.connect(account4).approve(saleContract.address, big800)                      //800

                let account1TON = Number(await getToken.balanceOf(account1.address))
                let account1WTON = Number(await wton.balanceOf(account1.address))
                let account2TON = Number(await getToken.balanceOf(account2.address))
                let account2WTON = Number(await wton.balanceOf(account2.address))
                let account3TON = Number(await getToken.balanceOf(account3.address))
                let account3WTON = Number(await wton.balanceOf(account3.address))
                let account4TON = Number(await getToken.balanceOf(account4.address))
                let account4WTON = Number(await wton.balanceOf(account4.address))
                let account6TON = Number(await getToken.balanceOf(account6.address))
                let account6WTON = Number(await wton.balanceOf(account6.address))
                
                // let contractTON = Number(await getToken.balanceOf(account5.address))
                // console.log("contract TON :", contractTON)

                // console.log("account1 TON :", account1TON)
                // console.log("account1 WTON :", account1WTON)
                // console.log("account2 TON :", account2TON)
                // console.log("account2 WTON :", account2WTON)
                // console.log("account3 TON :", account3TON)
                // console.log("account3 WTON :", account3WTON)
                // console.log("account4 TON :", account4TON)
                // console.log("account4 WTON :", account4WTON)
                // console.log("account6 TON :", account6TON)
                // console.log("account6 WTON :", account6WTON)

                await getToken.connect(account1).approveAndCall(saleContract.address, big200, 0);
                // await saleContract.connect(account1).deposit(big200)
                await wton.connect(account2).approveAndCall(saleContract.address, account2BigWTONAmount, 0);
                // await saleContract.connect(account2).deposit(big400)

                var dec = 300000000000000000000;
                var hex = dec.toString(16);
                // console.log("hex : ", hex, " hex.length : ", hex.length);
                let length = hex.length;
                for(let i = 1; i<=(64-length); i++) {
                    hex = "0"+hex;
                    if (i==(64-length)) {
                        hex = "0x" + hex;
                    }
                }

                await getToken.connect(account3).approveAndCall(saleContract.address, big300, hex);
                // await saleContract.connect(account3).deposit(big600)
                await getToken.connect(account4).approveAndCall(saleContract.address, big800, 0);
                // await saleContract.connect(account4).deposit(big800)

                let account1TON2 = Number(await getToken.balanceOf(account1.address))
                let account1WTON2 = Number(await wton.balanceOf(account1.address))
                let account2TON2 = Number(await getToken.balanceOf(account2.address))
                let account2WTON2 = Number(await wton.balanceOf(account2.address))
                let account3TON2 = Number(await getToken.balanceOf(account3.address))
                let account3WTON2 = Number(await wton.balanceOf(account3.address))
                let account4TON2 = Number(await getToken.balanceOf(account4.address))
                let account4WTON2 = Number(await wton.balanceOf(account4.address))
                let account6TON2 = Number(await getToken.balanceOf(account6.address))
                let account6WTON2 = Number(await wton.balanceOf(account6.address))
                // console.log("------------------------------------------------------")
                // console.log("account1 TON2 :", account1TON2)
                // console.log("account1 WTON2 :", account1WTON2)
                // console.log("account2 TON2 :", account2TON2)
                // console.log("account2 WTON2 :", account2WTON2)
                // console.log("account3 TON2 :", account3TON2)
                // console.log("account3 WTON2 :", account3WTON2)
                // console.log("account4 TON2 :", account4TON2)
                // console.log("account4 WTON2 :", account4WTON2)
                // console.log("account6 TON2 :", account6TON2)
                // console.log("account6 WTON2 :", account6WTON2)

                let tx = await saleContract.usersOpen(account1.address)
                expect(Number(tx.depositAmount)).to.be.equal(Number(account1BigTONAmount))
                let tx2 = await saleContract.usersOpen(account2.address)
                expect(Number(tx2.depositAmount)).to.be.equal(Number(big400))
                let tx3 = await saleContract.usersOpen(account3.address)
                expect(Number(tx3.depositAmount)).to.be.equal(Number(big600))
                let tx4 = await saleContract.usersOpen(account4.address)
                expect(Number(tx4.depositAmount)).to.be.equal(Number(big800))
            })
        })
    })

    describe("claim test", () => {
        //time condition test
        it('claim before claimTime', async () => {
            let tx = saleContract.connect(account1).claim()
            await expect(tx).to.be.revertedWith("PublicSale: don't start claimTime")
        })
        
        it("duration the time to claimTime1", async () => {
            await ethers.provider.send('evm_setNextBlockTimestamp', [claimTime1]);
            await ethers.provider.send('evm_mine');
        })

        //claimTime1 account1 claim and balance check
        it("claim claimTime1, claim call the account1", async () => {
            let expectClaim = await saleContract.calculClaimAmount(account1.address, 0)
            let tx = await saleContract.usersClaim(account1.address)
            expect(Number(tx.claimAmount)).to.be.equal(0)
            await saleContract.connect(account1).claim()
            let tx2 = await saleContract.usersClaim(account1.address)
            // console.log("period1 :", Number(tx2.claimAmount))
            expect(Number(tx2.claimAmount)).to.be.equal(Number(expectClaim._reward))
            let tx3 = await saleToken.balanceOf(account1.address)
            expect(Number(tx3)).to.be.equal(Number(expectClaim._reward))

            console.log("account1 amount : ", Number(tx3))
            // account1 = 48,000
        })

        it("duration the time to claimTime2", async () => {
            await ethers.provider.send('evm_setNextBlockTimestamp', [claimTime2]);
            await ethers.provider.send('evm_mine');
        })

        //claimTime2 account1,account2 claim and balance check
        it("claim claimTime2, claim call the account1, account2", async () => {
            let expectClaim = await saleContract.calculClaimAmount(account1.address, 2)
            let expectClaim2 = await saleContract.calculClaimAmount(account2.address, 0)
            let expectClaim3 = await saleContract.calculClaimAmount(account1.address, 1)

            let claimAmount1 = await saleContract.usersClaim(account1.address)
            expect(Number(claimAmount1.claimAmount)).to.be.equal(Number(expectClaim3._reward))

            let claimAmount2 = await saleContract.usersClaim(account2.address)
            expect(Number(claimAmount2.claimAmount)).to.be.equal(0)

            await saleContract.connect(account1).claim()
            await saleContract.connect(account2).claim()
            
            let tx3 = await saleContract.usersClaim(account1.address)
            // console.log("period2 :", Number(tx3.claimAmount))
            expect(Number(tx3.claimAmount)).to.be.equal((Number(claimAmount1.claimAmount)+Number(expectClaim._reward)))
            let tx4 = await saleToken.balanceOf(account1.address)
            expect(Number(tx4)).to.be.equal((Number(claimAmount1.claimAmount)+Number(expectClaim._reward)))

            let tx5 = await saleContract.usersClaim(account2.address)
            expect(Number(tx5.claimAmount)).to.be.equal(Number(expectClaim2._reward))
            let tx6 = await saleToken.balanceOf(account2.address)
            expect(Number(tx6)).to.be.equal(Number(expectClaim2._reward))
            console.log("account1 amount : ", Number(tx4))
            console.log("account2 amount : ", Number(tx6))

            //account1 = 48,000 + 32,000 = 80,000
            //account2 = 96,000 + 64,000 = 160,000
        })

        it("duration the time to claimTime3", async () => {
            await ethers.provider.send('evm_setNextBlockTimestamp', [claimTime3]);
            await ethers.provider.send('evm_mine');
        })

        //claimTime3 account1,account3 claim and balance check
        it("claim claimTime3, claim call the account1, account3", async () => {
            let expectClaim = await saleContract.calculClaimAmount(account1.address, 3)
            let expectClaim2 = await saleContract.calculClaimAmount(account3.address, 0)
            let expectClaim3 = await saleContract.calculClaimAmount(account1.address, 1)
            let expectClaim4 = await saleContract.calculClaimAmount(account1.address, 2)

            let claimAmount1 = await saleContract.usersClaim(account1.address)
            expect(Number(claimAmount1.claimAmount)).to.be.equal(Number(expectClaim3._reward) + Number(expectClaim4._reward))

            let claimAmount2 = await saleContract.usersClaim(account3.address)
            expect(Number(claimAmount2.claimAmount)).to.be.equal(0)

            await saleContract.connect(account1).claim()
            await saleContract.connect(account3).claim()

            let tx3 = await saleContract.usersClaim(account1.address)
            // console.log("period3 :", Number(tx3.claimAmount))
            expect(Number(tx3.claimAmount)).to.be.equal((Number(claimAmount1.claimAmount)+Number(expectClaim._reward)))
            let tx4 = await saleToken.balanceOf(account1.address)
            expect(Number(tx4)).to.be.equal((Number(claimAmount1.claimAmount)+Number(expectClaim._reward)))

            let tx5 = await saleContract.usersClaim(account3.address)
            expect(Number(tx5.claimAmount)).to.be.equal(Number(expectClaim2._reward))
            let tx6 = await saleToken.balanceOf(account3.address)
            expect(Number(tx6)).to.be.equal(Number(expectClaim2._reward))

            console.log("account1 amount : ", Number(tx4))
            console.log("account3 amount : ", Number(tx6))

            //account1 = 48,000 + 32,000 + 32,000 = 112,000
            //account2 = 96,000 + 64,000 = 160,000
            //account3 = 156,000 + 104,000 + 104,000 = 364,000
        })

        it("duration the time to claimTime4", async () => {
            await ethers.provider.send('evm_setNextBlockTimestamp', [claimTime4]);
            await ethers.provider.send('evm_mine');
        })

        //claimTime4 account1,account4 claim and balance check
        it("claim claimTime4, claim call the account1, account4", async () => {
            let expectClaim = await saleContract.calculClaimAmount(account1.address, 4)
            let expectClaim2 = await saleContract.calculClaimAmount(account4.address, 0)
            let expectClaim3 = await saleContract.calculClaimAmount(account1.address, 1)
            let expectClaim4 = await saleContract.calculClaimAmount(account1.address, 2)
            let expectClaim5 = await saleContract.calculClaimAmount(account1.address, 3)

            let claimAmount1 = await saleContract.usersClaim(account1.address)
            expect(Number(claimAmount1.claimAmount)).to.be.equal(Number(expectClaim3._reward) + Number(expectClaim4._reward) + Number(expectClaim5._reward))

            let claimAmount2 = await saleContract.usersClaim(account4.address)
            expect(Number(claimAmount2.claimAmount)).to.be.equal(0)

            await saleContract.connect(account1).claim()
            await saleContract.connect(account4).claim()

            let tx3 = await saleContract.usersClaim(account1.address)
            // console.log("period4 :", Number(tx3.claimAmount))
            expect(Number(tx3.claimAmount)).to.be.equal((Number(claimAmount1.claimAmount)+Number(expectClaim._reward)))
            let tx4 = await saleToken.balanceOf(account1.address)
            expect(Number(tx4)).to.be.equal((Number(claimAmount1.claimAmount)+Number(expectClaim._reward)))

            let tx5 = await saleContract.usersClaim(account4.address)
            expect(Number(tx5.claimAmount)).to.be.equal(Number(expectClaim2._reward))
            let tx6 = await saleToken.balanceOf(account4.address)
            expect(Number(tx6)).to.be.equal(Number(expectClaim2._reward))

            console.log("account1 amount : ", Number(tx4))
            console.log("account4 amount : ", Number(tx6))

            //account1 = 48,000 + 32,000 + 32,000 + 32,000 = 144,000
            //account2 = 96,000 + 64,000 = 160,000
            //account3 = 156,000 + 104,000 + 104,000 = 364,000
            //account4 = 210,000 + 140,000 + 140,000 + 140,000 = 630,000
        })

        it("duration the time to claimTime5", async () => {
            await ethers.provider.send('evm_setNextBlockTimestamp', [claimTime5]);
            await ethers.provider.send('evm_mine');
        })

        //claimTime5 account1,account2 claim and balance check
        it("claim claimTime5, claim call the account1, account2", async () => {
            let expectClaim = await saleContract.calculClaimAmount(account1.address, 5)
            let expectClaim2 = await saleContract.calculClaimAmount(account2.address, 0)
            let expectClaim3 = await saleContract.calculClaimAmount(account1.address, 1)
            let expectClaim4 = await saleContract.calculClaimAmount(account1.address, 2)
            let expectClaim5 = await saleContract.calculClaimAmount(account1.address, 3)
            let expectClaim6 = await saleContract.calculClaimAmount(account1.address, 4)
            let expectClaim7 = await saleContract.calculClaimAmount(account2.address, 1)
            let expectClaim8 = await saleContract.calculClaimAmount(account2.address, 2)

            let claimAmount1 = await saleContract.usersClaim(account1.address)
            expect(Number(claimAmount1.claimAmount)).to.be.equal(Number(expectClaim3._reward) + Number(expectClaim4._reward) + Number(expectClaim5._reward) + Number(expectClaim6._reward))

            let claimAmount2 = await saleContract.usersClaim(account2.address)
            expect(Number(claimAmount2.claimAmount)).to.be.equal(Number(expectClaim7._reward) + Number(expectClaim8._reward))


            await saleContract.connect(account1).claim()
            await saleContract.connect(account2).claim()

            let tx3 = await saleContract.usersClaim(account1.address)
            // console.log("period4 :", Number(tx3.claimAmount))
            expect(Number(tx3.claimAmount)).to.be.equal(Number(expectClaim._totalClaim))
            let tx4 = await saleToken.balanceOf(account1.address)
            expect(Number(tx4)).to.be.equal(Number(expectClaim._totalClaim))

            let tx5 = await saleContract.usersClaim(account2.address)
            expect(Number(tx5.claimAmount)).to.be.equal(Number(expectClaim2._totalClaim))
            let tx6 = await saleToken.balanceOf(account2.address)
            expect(Number(tx6)).to.be.equal(Number(expectClaim2._totalClaim))

            console.log("account1 amount : ", Number(tx4))
            console.log("account2 amount : ", Number(tx6))

            //account1 = 48,000 + 32,000 + 32,000 + 32,000 + 16,000 = 160,000
            //account2 = 96,000 + 64,000 + 64,000 + 64,000 + 32,000 = 320,000
            //account3 = 156,000 + 104,000 + 104,000 = 364,000
            //account4 = 210,000 + 140,000 + 140,000 + 140,000 = 630,000
        })

        it("duration the time to period end", async () => {
            let periodEnd = claimTime5 + (86400*7)
            await ethers.provider.send('evm_setNextBlockTimestamp', [periodEnd]);
            await ethers.provider.send('evm_mine');
        })

        //claimTime5 account3, account4, account6 claim and balance check
        it("claim period end, claim call the account3, account4, account6", async () => {
            let expectClaim = await saleContract.calculClaimAmount(account1.address, 0)
            expect(Number(expectClaim._reward)).to.be.equal(0)
            let expectClaim2 = await saleContract.calculClaimAmount(account3.address, 0)
            let expectClaim3 = await saleContract.calculClaimAmount(account4.address, 0)
            let expectClaim4 = await saleContract.calculClaimAmount(account6.address, 0)
            let expectClaim5 = await saleContract.calculClaimAmount(account3.address, 1)
            let expectClaim6 = await saleContract.calculClaimAmount(account3.address, 2)
            let expectClaim7 = await saleContract.calculClaimAmount(account3.address, 3)
            let expectClaim8 = await saleContract.calculClaimAmount(account4.address, 1)
            let expectClaim9 = await saleContract.calculClaimAmount(account4.address, 2)
            let expectClaim10 = await saleContract.calculClaimAmount(account4.address, 3)
            let expectClaim11 = await saleContract.calculClaimAmount(account4.address, 4)

            let claimAmount1 = await saleContract.usersClaim(account3.address)
            expect(Number(claimAmount1.claimAmount)).to.be.equal(Number(expectClaim5._reward) + Number(expectClaim6._reward) + Number(expectClaim7._reward))

            let claimAmount2 = await saleContract.usersClaim(account4.address)
            expect(Number(claimAmount2.claimAmount)).to.be.equal(Number(expectClaim8._reward) + Number(expectClaim9._reward) + Number(expectClaim10._reward) + Number(expectClaim11._reward))

            let claimAmount3 = await saleContract.usersClaim(account6.address)
            expect(Number(expectClaim4._totalClaim)).to.be.equal(Number(expectClaim4._reward))

            await saleContract.connect(account3).claim()
            await saleContract.connect(account4).claim()
            await saleContract.connect(account6).claim()

            let tx3 = await saleContract.usersClaim(account3.address)
            expect(Number(tx3.claimAmount)).to.be.equal(Number(expectClaim2._totalClaim))
            let tx4 = await saleToken.balanceOf(account3.address)
            expect(Number(tx4)).to.be.equal(Number(expectClaim2._totalClaim))

            let tx5 = await saleContract.usersClaim(account4.address)
            expect(Number(tx5.claimAmount)).to.be.equal(Number(expectClaim3._totalClaim))
            let tx6 = await saleToken.balanceOf(account4.address)
            expect(Number(tx6)).to.be.equal(Number(expectClaim3._totalClaim))

            let tx7 = await saleToken.balanceOf(account6.address)
            expect(Number(tx7)).to.be.equal(Number(expectClaim4._totalClaim))

            console.log("account3 amount : ", Number(tx4))
            console.log("account4 amount : ", Number(tx6))
            console.log("account6 amount : ", Number(tx7))
        

            //account1 = 48,000 + 32,000 + 32,000 + 32,000 + 16,000 = 160,000 , 100TON
            //account2 = 96,000 + 64,000 + 64,000 + 64,000 + 32,000 = 320,000 , 200TON
            //account3 = 156,000 + 104,000 + 104,000 + 104,000 + 52,000 = 520,000 , 300TON
            //account4 = 210,000 + 140,000 + 140,000 + 140,000 + 70,000 = 700,000 , 400TON
            //account6 = 90,000 + 60,000 + 60,000 + 60,000 + 30,000 = 300,000
        })

        //refund test
        it("refund check", async () => {
            let refund1 = await ton.balanceOf(account1.address)
            expect(Number(refundAmount1)).to.be.equal(Number(refund1))
            // console.log(Number(refund1))
            let refund2 = await ton.balanceOf(account2.address)
            expect(Number(refundAmount2)).to.be.equal(Number(refund2))
            // console.log(Number(refund2))
            let refund3 = await ton.balanceOf(account3.address)
            expect(Number(refundAmount3)).to.be.equal(Number(refund3))
            // console.log(Number(refund3))
            let refund4 = await ton.balanceOf(account4.address)
            expect(Number(refundAmount4)).to.be.equal(Number(refund4))
            // console.log(Number(refund4))
        })

        //depositWithdraw admin test
        it("deposit withdraw",async () => {
            let tx = saleContract.connect(account1).depositWithdraw()
            await expect(tx).to.be.revertedWith("Accessible: Caller is not an admin")
        })

        //depositWithdraw test (round2 deposit amount = afterBalance-beforeBalance)
        it("deposit withdraw", async () => {
            let beforeBalance = Number(await getToken.balanceOf(account5.address));
            console.log(beforeBalance)
            let beforeContract = Number(await getToken.balanceOf(saleContract.address));
            console.log(beforeContract)
            let befroeVault = Number(await getToken.balanceOf(vaultAddress.address));
            console.log(befroeVault)
            await saleContract.connect(saleOwner).depositWithdraw()
            let afterBalance = Number(await getToken.balanceOf(account5.address));
            console.log(afterBalance)
            let afterVault = Number(await getToken.balanceOf(vaultAddress.address));
            console.log(afterVault)
            expect(afterBalance+afterVault).to.be.equal(beforeContract+beforeBalance+befroeVault);
        })

        it("data check", async () => {
            let tx = Number(await saleContract.totalWhitelists())
            // console.log(tx)
            expect(tx).to.be.equal(5)
            let tx2 = Number(await saleContract.totalExSaleAmount())
            // console.log(tx2)
            expect(tx2).to.be.equal(Number(round1SaleAmount))
            let tx3 = Number(await saleContract.totalExPurchasedAmount())
            // console.log(tx3)
            let big1000 = ethers.utils.parseUnits("1000", 18);
            let big2000 = ethers.utils.parseUnits("2000", 18);
            expect(tx3).to.be.equal(Number(big1000))
            let tx4 = Number(await saleContract.totalDepositAmount())
            // console.log(tx4)
            expect(tx4).to.be.equal(Number(big2000))
            let tx5 = Number(await saleContract.totalOpenSaleAmount())
            // console.log(tx5)
            expect(tx5).to.be.equal(Number(round2SaleAmount))
            let tx6 = Number(await saleContract.totalOpenPurchasedAmount())
            // console.log(tx6)
            expect(tx6).to.be.equal(Number(big1000))
            let tx7 = Number(await saleContract.tiersAccount(1))
            // console.log(tx7)
            expect(tx7).to.be.equal(1)
            let tx8 = Number(await saleContract.tiersAccount(4))
            // console.log(tx8)
            expect(tx8).to.be.equal(2)
            let tx9 = Number(await saleContract.tiersExAccount(1))
            // console.log(tx9)
            expect(tx9).to.be.equal(1)
            let tx10 = Number(await saleContract.tiersExAccount(4))
            // console.log(tx10)
            expect(tx10).to.be.equal(2)
        })

        //reset test using the rinkeby
        it("resetData", async () => {
            await saleContract.connect(saleOwner).resetAllData()
            let tx = Number(await saleContract.totalWhitelists())
            expect(tx).to.be.equal(0)
            let tx2 = Number(await saleContract.totalExSaleAmount())
            expect(tx2).to.be.equal(0)
            let tx3 = Number(await saleContract.totalExPurchasedAmount())
            expect(tx3).to.be.equal(0)
            let tx4 = Number(await saleContract.totalDepositAmount())
            expect(tx4).to.be.equal(0)
            let tx5 = Number(await saleContract.totalOpenSaleAmount())
            expect(tx5).to.be.equal(0)
            let tx6 = Number(await saleContract.totalOpenPurchasedAmount())
            expect(tx6).to.be.equal(0)
            let tx7 = Number(await saleContract.tiersAccount(1))
            expect(tx7).to.be.equal(0)
            let tx8 = Number(await saleContract.tiersAccount(4))
            expect(tx8).to.be.equal(0)
            let tx9 = Number(await saleContract.tiersExAccount(1))
            expect(tx9).to.be.equal(0)
            let tx10 = Number(await saleContract.tiersExAccount(4))
            expect(tx10).to.be.equal(0)
        })
    })
})