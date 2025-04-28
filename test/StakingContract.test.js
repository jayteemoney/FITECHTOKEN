const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("StakingContract", function () {
    let FitechToken, StakingContract, fitechToken, stakingContract, owner, user1, user2;
    const rewardRate = ethers.parseUnits("0.0000001157", 18); // ~0.01 FitechToken/day/ETH
    const lockupPeriod = 30 * 24 * 60 * 60; // 30 days
    const stakeAmount = ethers.parseEther("1"); // 1 ETH
    const fundAmount = ethers.parseUnits("1000000", 18); // 1M FitechToken

    beforeEach(async function () {
        [owner, user1, user2] = await ethers.getSigners();

        // Deploy FitechToken
        FitechToken = await ethers.getContractFactory("FitechToken");
        fitechToken = await FitechToken.deploy(owner.address);
        console.log("FitechToken deployed at:", fitechToken.address); // Debug
        expect(fitechToken.address).to.not.equal(null, "FitechToken address is null");

        // Deploy StakingContract
        StakingContract = await ethers.getContractFactory("StakingContract");
        stakingContract = await StakingContract.deploy(
            owner.address,
            fitechToken.address,
            rewardRate,
            lockupPeriod
        );
        console.log("StakingContract deployed at:", stakingContract.address); // Debug
        expect(stakingContract.address).to.not.equal(null, "StakingContract address is null");
    });

    it("should deploy with correct initial values", async function () {
        expect(await fitechToken.name()).to.equal("FitechToken");
        expect(await fitechToken.symbol()).to.equal("FTK");
        expect(await fitechToken.getBalance(owner.address)).to.equal(
            ethers.parseUnits("10000000000", 18)
        );
        expect(await stakingContract.rewardToken()).to.equal(fitechToken.address);
        expect(await stakingContract.rewardRate()).to.equal(rewardRate);
        expect(await stakingContract.lockupPeriod()).to.equal(lockupPeriod);
    });

    it("should allow owner to fund reward pool", async function () {
        await fitechToken.connect(owner).approve(stakingContract.address, fundAmount);
        await stakingContract.connect(owner).fundRewardPool(fundAmount);
        expect(await stakingContract.getRewardPoolBalance()).to.equal(fundAmount);
    });

    it("should allow users to stake Ether", async function () {
        await stakingContract.connect(user1).stake({ value: stakeAmount });
        expect(await stakingContract.stakedAmount(user1.address)).to.equal(stakeAmount);
        expect(await stakingContract.getTotalStaked()).to.equal(stakeAmount);
    });

    it("should calculate and claim rewards after funding", async function () {
        await fitechToken.connect(owner).approve(stakingContract.address, fundAmount);
        await stakingContract.connect(owner).fundRewardPool(fundAmount);
        await stakingContract.connect(user1).stake({ value: stakeAmount });
        await ethers.provider.send("evm_increaseTime", [24 * 60 * 60]);
        await ethers.provider.send("evm_mine");
        const reward = await stakingContract.availableReward(user1.address);
        expect(reward).to.be.closeTo(
            ethers.parseUnits("0.01", 18),
            ethers.parseUnits("0.001", 18)
        );
        await stakingContract.connect(user1).claimReward();
        expect(await fitechToken.getBalance(user1.address)).to.be.closeTo(
            ethers.parseUnits("0.01", 18),
            ethers.parseUnits("0.001", 18)
        );
    });

    it("should allow unstaking after lockup period", async function () {
        await stakingContract.connect(user1).stake({ value: stakeAmount });
        await expect(
            stakingContract.connect(user1).unstake(stakeAmount)
        ).to.be.revertedWith("Lockup period not passed");
        await ethers.provider.send("evm_increaseTime", [lockupPeriod + 1]);
        await ethers.provider.send("evm_mine");
        const initialBalance = await ethers.provider.getBalance(user1.address);
        await stakingContract.connect(user1).unstake(stakeAmount);
        expect(await stakingContract.stakedAmount(user1.address)).to.equal(0);
        expect(await ethers.provider.getBalance(user1.address)).to.be.above(initialBalance);
    });

    it("should allow emergency withdrawal", async function () {
        await stakingContract.connect(user1).stake({ value: stakeAmount });
        const initialBalance = await ethers.provider.getBalance(user1.address);
        await stakingContract.connect(user1).emergencyWithdraw();
        expect(await stakingContract.stakedAmount(user1.address)).to.equal(0);
        expect(await ethers.provider.getBalance(user1.address)).to.be.above(initialBalance);
    });

    it("should prevent claiming rewards without funding", async function () {
        await stakingContract.connect(user1).stake({ value: stakeAmount });
        await ethers.provider.send("evm_increaseTime", [24 * 60 * 60]);
        await ethers.provider.send("evm_mine");
        await expect(
            stakingContract.connect(user1).claimReward()
        ).to.be.revertedWith("Insufficient reward pool");
    });
});