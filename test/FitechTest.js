const {
    time,
    loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");

describe("Fitech Staking", function () {
    // Fixture to set up contracts and state
    async function deployFitechStakingFixture() {
        const rewardRate = ethers.parseUnits("0.0000001157", 18); // ~0.01 FTK/day/ETH
        const lockupPeriod = 30 * 24 * 60 * 60; // 30 days
        const stakeAmount = ethers.parseEther("1"); // 1 ETH
        const fundAmount = ethers.parseUnits("1000000", 18); // 1M FTK
        const initialSupply = ethers.parseUnits("10000000000", 18); // 10B FTK

        // Get signers
        const [owner, user1, user2] = await ethers.getSigners();

        // Deploy FitechToken
        const FitechToken = await ethers.getContractFactory("FitechToken");
        const fitechToken = await FitechToken.deploy(owner.address, { gasLimit: 5000000 });
        await fitechToken.deploymentTransaction().wait(); // Ensure deployment completes

        // Deploy StakingContract
        const StakingContract = await ethers.getContractFactory("StakingContract");
        const stakingContract = await StakingContract.deploy(
            owner.address,
            fitechToken.address,
            rewardRate,
            lockupPeriod,
            { gasLimit: 5000000 }
        );
        await stakingContract.deploymentTransaction().wait();

        return {
            fitechToken,
            stakingContract,
            rewardRate,
            lockupPeriod,
            stakeAmount,
            fundAmount,
            initialSupply,
            owner,
            user1,
            user2
        };
    }

    describe("Deployment", function () {
        it("Should set the right FitechToken properties", async function () {
            const { fitechToken, initialSupply, owner } = await loadFixture(deployFitechStakingFixture);

            expect(await fitechToken.name()).to.equal("FitechToken");
            expect(await fitechToken.symbol()).to.equal("FTK");
            expect(await fitechToken.getBalance(owner.address)).to.equal(initialSupply);
        });

        it("Should set the right StakingContract properties", async function () {
            const { stakingContract, fitechToken, rewardRate, lockupPeriod, owner } = await loadFixture(
                deployFitechStakingFixture
            );

            expect(await stakingContract.rewardToken()).to.equal(fitechToken.address);
            expect(await stakingContract.rewardRate()).to.equal(rewardRate);
            expect(await stakingContract.lockupPeriod()).to.equal(lockupPeriod);
            expect(await stakingContract.owner()).to.equal(owner.address);
        });

        it("Should fail if StakingContract is deployed with zero address for rewardToken", async function () {
            const { owner, rewardRate, lockupPeriod } = await loadFixture(deployFitechStakingFixture);
            const StakingContract = await ethers.getContractFactory("StakingContract");

            await expect(
                StakingContract.deploy(owner.address, ethers.ZeroAddress, rewardRate, lockupPeriod, {
                    gasLimit: 5000000
                })
            ).to.be.revertedWith("Reward token cannot be zero address");
        });
    });

    describe("Reward Pool Funding", function () {
        it("Should allow owner to fund reward pool", async function () {
            const { fitechToken, stakingContract, fundAmount, owner } = await loadFixture(
                deployFitechStakingFixture
            );

            await fitechToken.connect(owner).mint(owner.address, fundAmount);
            await fitechToken.connect(owner).approve(stakingContract.address, fundAmount);
            await expect(stakingContract.connect(owner).fundRewardPool(fundAmount))
                .to.emit(stakingContract, "RewardPoolFunded")
                .withArgs(fundAmount, anyValue);
            expect(await stakingContract.getRewardPoolBalance()).to.equal(fundAmount);
        });

        it("Should revert if non-owner tries to fund reward pool", async function () {
            const { stakingContract, fundAmount, user1 } = await loadFixture(deployFitechStakingFixture);

            await expect(
                stakingContract.connect(user1).fundRewardPool(fundAmount)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });
    });

    describe("Staking", function () {
        it("Should allow users to stake Ether", async function () {
            const { stakingContract, stakeAmount, user1 } = await loadFixture(deployFitechStakingFixture);

            await expect(stakingContract.connect(user1).stake({ value: stakeAmount }))
                .to.emit(stakingContract, "Staked")
                .withArgs(user1.address, stakeAmount, anyValue);
            expect(await stakingContract.stakedAmount(user1.address)).to.equal(stakeAmount);
            expect(await stakingContract.getTotalStaked()).to.equal(stakeAmount);
        });

        it("Should revert if staking zero Ether", async function () {
            const { stakingContract, user1 } = await loadFixture(deployFitechStakingFixture);

            await expect(stakingContract.connect(user1).stake({ value: 0 })).to.be.revertedWith(
                "Must stake more than 0"
            );
        });
    });

    describe("Reward Claiming", function () {
        it("Should calculate and claim rewards after funding", async function () {
            const { fitechToken, stakingContract, fundAmount, stakeAmount, user1 } = await loadFixture(
                deployFitechStakingFixture
            );

            // Fund reward pool
            await fitechToken.connect(owner).mint(owner.address, fundAmount);
            await fitechToken.connect(owner).approve(stakingContract.address, fundAmount);
            await stakingContract.connect(owner).fundRewardPool(fundAmount);

            // Stake
            await stakingContract.connect(user1).stake({ value: stakeAmount });

            // Advance time by 1 day
            await time.increase(24 * 60 * 60);

            // Claim reward
            const reward = await stakingContract.availableReward(user1.address);
            expect(reward).to.be.closeTo(ethers.parseUnits("0.01", 18), ethers.parseUnits("0.001", 18));
            await expect(stakingContract.connect(user1).claimReward())
                .to.emit(stakingContract, "RewardClaimed")
                .withArgs(user1.address, anyValue, anyValue);
            expect(await fitechToken.getBalance(user1.address)).to.be.closeTo(
                ethers.parseUnits("0.01", 18),
                ethers.parseUnits("0.001", 18)
            );
        });

        it("Should revert if claiming rewards without funding", async function () {
            const { stakingContract, stakeAmount, user1 } = await loadFixture(deployFitechStakingFixture);

            await stakingContract.connect(user1).stake({ value: stakeAmount });
            await time.increase(24 * 60 * 60);

            await expect(stakingContract.connect(user1).claimReward()).to.be.revertedWith(
                "Insufficient reward pool"
            );
        });
    });

    describe("Unstaking", function () {
        it("Should revert if unstaking before lockup period", async function () {
            const { stakingContract, stakeAmount, user1 } = await loadFixture(deployFitechStakingFixture);

            await stakingContract.connect(user1).stake({ value: stakeAmount });
            await expect(stakingContract.connect(user1).unstake(stakeAmount)).to.be.revertedWith(
                "Lockup period not passed"
            );
        });

        it("Should allow unstaking after lockup period", async function () {
            const { stakingContract, stakeAmount, lockupPeriod, user1 } = await loadFixture(
                deployFitechStakingFixture
            );

            await stakingContract.connect(user1).stake({ value: stakeAmount });
            await time.increase(lockupPeriod + 1);
            await expect(stakingContract.connect(user1).unstake(stakeAmount))
                .to.emit(stakingContract, "Unstaked")
                .withArgs(user1.address, stakeAmount, anyValue);
            expect(await stakingContract.stakedAmount(user1.address)).to.equal(0);
            expect(await ethers.provider.getBalance(user1.address)).to.be.above(
                ethers.parseEther("9999") // Approximate, assuming user1 had ~10000 ETH
            );
        });
    });

    describe("Emergency Withdrawal", function () {
        it("Should allow emergency withdrawal", async function () {
            const { stakingContract, stakeAmount, user1 } = await loadFixture(deployFitechStakingFixture);

            await stakingContract.connect(user1).stake({ value: stakeAmount });
            await expect(stakingContract.connect(user1).emergencyWithdraw())
                .to.emit(stakingContract, "EmergencyWithdrawn")
                .withArgs(user1.address, stakeAmount, anyValue);
            expect(await stakingContract.stakedAmount(user1.address)).to.equal(0);
            expect(await ethers.provider.getBalance(user1.address)).to.be.above(
                ethers.parseEther("9999")
            );
        });
    });
});