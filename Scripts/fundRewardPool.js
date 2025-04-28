const { ethers } = require("hardhat");

async function main() {
    const [owner] = await ethers.getSigners();
    console.log("Funding reward pool with owner:", owner.address);

    // Replace with your deployed contract addresses
    const fitechTokenAddress = "YOUR_FITECH_TOKEN_ADDRESS"; // Update after deployment
    const stakingContractAddress = "YOUR_STAKING_CONTRACT_ADDRESS"; // Update after deployment
    const fundAmount = ethers.parseUnits("1000000", 18); // 1M FTK

    // Get contract instances
    const FitechToken = await ethers.getContractAt("FitechToken", fitechTokenAddress);
    const StakingContract = await ethers.getContractAt("StakingContract", stakingContractAddress);

    // Approve StakingContract to spend FTK
    console.log(`Approving ${fundAmount} FTK for StakingContract...`);
    const approveTx = await FitechToken.connect(owner).approve(stakingContractAddress, fundAmount);
    await approveTx.wait();
    console.log("Approval successful");

    // Fund the reward pool
    console.log(`Funding reward pool with ${fundAmount} FTK...`);
    const fundTx = await StakingContract.connect(owner).fundRewardPool(fundAmount);
    await fundTx.wait();
    console.log("Reward pool funded successfully");

    // Verify the reward pool balance
    const rewardPoolBalance = await StakingContract.getRewardPoolBalance();
    console.log(`Reward pool balance: ${ethers.formatUnits(rewardPoolBalance, 18)} FTK`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Error:", error);
        process.exit(1);
    });