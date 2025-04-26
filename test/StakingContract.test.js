const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("StakingContract with Separate Token", function () {
  let stakingContract;
  let pandasToken;
  let owner, user1, user2;
  let rewardRate = ethers.parseEther("0.0001"); // 0.0001 tokens per second
  let lockupPeriod = 7 * 24 * 60 * 60; // 7 days in seconds

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    // Deploy the Pandas token
    const Pandas = await ethers.getContractFactory("Pandas");
    pandasToken = await Pandas.deploy(owner.address);
    await pandasToken.waitForDeployment();

    // Deploy the StakingContract
    const StakingContract = await ethers.getContractFactory("StakingContract");
    stakingContract = await StakingContract.deploy(
      owner.address,
      await pandasToken.getAddress(),
      rewardRate,
      lockupPeriod
    );
    await stakingContract.waitForDeployment();

    // Mint some tokens to the users for testing
    const mintAmount = ethers.parseEther("1000");
    await pandasToken.mint(user1.address, mintAmount);
    await pandasToken.mint(user2.address, mintAmount);

    // Mint tokens to fund the reward pool
    const rewardPoolAmount = ethers.parseEther("10000");
    await pandasToken.mint(owner.address, rewardPoolAmount);

    // Fund the reward pool
    await pandasToken.approve(
      await stakingContract.getAddress(),
      rewardPoolAmount
    );
    await stakingContract.fundRewardPool(rewardPoolAmount);

    // Approve spending for staking
    await pandasToken
      .connect(user1)
      .approve(await stakingContract.getAddress(), ethers.MaxUint256);
    await pandasToken
      .connect(user2)
      .approve(await stakingContract.getAddress(), ethers.MaxUint256);
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await stakingContract.owner()).to.equal(owner.address);
    });

    it("Should set the correct token address", async function () {
      expect(await stakingContract.stakingToken()).to.equal(
        await pandasToken.getAddress()
      );
    });

    it("Should set the correct reward rate and lockup period", async function () {
      expect(await stakingContract.rewardRate()).to.equal(rewardRate);
      expect(await stakingContract.lockupPeriod()).to.equal(lockupPeriod);
    });
  });

  describe("Reward Pool", function () {
    it("Should allow owner to fund the reward pool", async function () {
      const additionalFunding = ethers.parseEther("5000");
      await pandasToken.mint(owner.address, additionalFunding);
      await pandasToken.approve(
        await stakingContract.getAddress(),
        additionalFunding
      );

      const initialPoolBalance = await stakingContract.getRewardPoolBalance();
      await stakingContract.fundRewardPool(additionalFunding);
      const newPoolBalance = await stakingContract.getRewardPoolBalance();

      expect(newPoolBalance).to.equal(initialPoolBalance + additionalFunding);
    });

    it("Should not allow non-owners to fund the reward pool", async function () {
      const fundAmount = ethers.parseEther("100");
      await pandasToken
        .connect(user1)
        .approve(await stakingContract.getAddress(), fundAmount);

      await expect(
        stakingContract.connect(user1).fundRewardPool(fundAmount)
      ).to.be.revertedWithCustomError(
        stakingContract,
        "OwnableUnauthorizedAccount"
      );
    });
  });

  describe("Staking", function () {
    it("Should allow users to stake tokens", async function () {
      const stakeAmount = ethers.parseEther("100");
      await stakingContract.connect(user1).stake(stakeAmount);

      expect(await stakingContract.stakedAmount(user1.address)).to.equal(
        stakeAmount
      );
      expect(await stakingContract.getTotalStaked()).to.equal(stakeAmount);

      // Check that tokens were transferred from user to contract
      expect(await pandasToken.balanceOf(user1.address)).to.equal(
        ethers.parseEther("900")
      );
      expect(
        await pandasToken.balanceOf(await stakingContract.getAddress())
      ).to.be.gt(stakeAmount);
    });

    it("Should not allow staking zero tokens", async function () {
      await expect(stakingContract.connect(user1).stake(0)).to.be.revertedWith(
        "Amount must be greater than 0"
      );
    });

    it("Should update stake when staking multiple times", async function () {
      const stakeAmount1 = ethers.parseEther("100");
      const stakeAmount2 = ethers.parseEther("50");

      await stakingContract.connect(user1).stake(stakeAmount1);
      await stakingContract.connect(user1).stake(stakeAmount2);

      expect(await stakingContract.stakedAmount(user1.address)).to.equal(
        stakeAmount1 + stakeAmount2
      );
    });
  });

  describe("Rewards", function () {
    it("Should calculate rewards correctly", async function () {
      const stakeAmount = ethers.parseEther("100");
      await stakingContract.connect(user1).stake(stakeAmount);

      // Fast forward time by 1 day
      await time.increase(24 * 60 * 60);

      // Calculate expected reward: amount * rate * time
      const timeStaked = 24 * 60 * 60; // 1 day in seconds
      const expectedReward =
        (stakeAmount * BigInt(rewardRate) * BigInt(timeStaked)) / BigInt(1e18);

      expect(
        await stakingContract.availableReward(user1.address)
      ).to.be.closeTo(expectedReward, ethers.parseEther("0.01"));
    });

    it("Should allow claiming rewards", async function () {
      const stakeAmount = ethers.parseEther("100");
      await stakingContract.connect(user1).stake(stakeAmount);

      // Fast forward time by 1 day
      await time.increase(24 * 60 * 60);

      const initialBalance = await pandasToken.balanceOf(user1.address);
      await stakingContract.connect(user1).claimReward();
      const newBalance = await pandasToken.balanceOf(user1.address);

      expect(newBalance).to.be.gt(initialBalance);
    });

    it("Should decrease reward pool when rewards are claimed", async function () {
      const stakeAmount = ethers.parseEther("100");
      await stakingContract.connect(user1).stake(stakeAmount);

      // Fast forward time by 1 day
      await time.increase(24 * 60 * 60);

      const initialRewardPool = await stakingContract.getRewardPoolBalance();
      await stakingContract.connect(user1).claimReward();
      const newRewardPool = await stakingContract.getRewardPoolBalance();

      expect(newRewardPool).to.be.lt(initialRewardPool);
    });
  });

  describe("Unstaking", function () {
    it("Should not allow unstaking before lockup period", async function () {
      const stakeAmount = ethers.parseEther("100");
      await stakingContract.connect(user1).stake(stakeAmount);

      // Fast forward time, but less than lockup period
      await time.increase(3 * 24 * 60 * 60); // 3 days

      await expect(
        stakingContract.connect(user1).unstake(stakeAmount)
      ).to.be.revertedWith("Lockup period not passed");
    });

    it("Should allow unstaking after lockup period", async function () {
      const stakeAmount = ethers.parseEther("100");
      await stakingContract.connect(user1).stake(stakeAmount);

      // Fast forward time past the lockup period
      await time.increase(lockupPeriod + 1);

      const initialBalance = await pandasToken.balanceOf(user1.address);
      await stakingContract.connect(user1).unstake(stakeAmount);
      const newBalance = await pandasToken.balanceOf(user1.address);

      expect(newBalance).to.be.gt(initialBalance);
      expect(await stakingContract.stakedAmount(user1.address)).to.equal(0);
    });

    it("Should not allow unstaking more than staked amount", async function () {
      const stakeAmount = ethers.parseEther("100");
      await stakingContract.connect(user1).stake(stakeAmount);

      // Fast forward time past the lockup period
      await time.increase(lockupPeriod + 1);

      await expect(
        stakingContract.connect(user1).unstake(stakeAmount + BigInt(1))
      ).to.be.revertedWith("Insufficient staked balance");
    });

    it("Should allow emergency withdraw anytime", async function () {
      const stakeAmount = ethers.parseEther("100");
      await stakingContract.connect(user1).stake(stakeAmount);

      const initialBalance = await pandasToken.balanceOf(user1.address);
      await stakingContract.connect(user1).emergencyWithdraw();
      const newBalance = await pandasToken.balanceOf(user1.address);

      expect(newBalance).to.equal(initialBalance + stakeAmount);
      expect(await stakingContract.stakedAmount(user1.address)).to.equal(0);
    });
  });

  describe("Admin functions", function () {
    it("Should allow owner to update reward rate", async function () {
      const newRewardRate = ethers.parseEther("0.0002");
      await stakingContract.connect(owner).updateRewardRate(newRewardRate);
      expect(await stakingContract.rewardRate()).to.equal(newRewardRate);
    });

    it("Should allow owner to update lockup period", async function () {
      const newLockupPeriod = 14 * 24 * 60 * 60; // 14 days
      await stakingContract.connect(owner).updateLockupPeriod(newLockupPeriod);
      expect(await stakingContract.lockupPeriod()).to.equal(newLockupPeriod);
    });

    it("Should not allow non-owner to update reward rate", async function () {
      const newRewardRate = ethers.parseEther("0.0002");
      await expect(
        stakingContract.connect(user1).updateRewardRate(newRewardRate)
      ).to.be.revertedWithCustomError(
        stakingContract,
        "OwnableUnauthorizedAccount"
      );
    });

    it("Should not allow non-owner to update lockup period", async function () {
      const newLockupPeriod = 14 * 24 * 60 * 60; // 14 days
      await expect(
        stakingContract.connect(user1).updateLockupPeriod(newLockupPeriod)
      ).to.be.revertedWithCustomError(
        stakingContract,
        "OwnableUnauthorizedAccount"
      );
    });
  });
});