const { ethers } = require("hardhat");

async function main() {
  const [owner] = await ethers.getSigners();
  console.log("Funding reward pool with account:", owner.address);

  // Replace with the deployed addresses from the Ignition deployment output
  const fitechTokenAddress = "YOUR_FITECH_TOKEN_ADDRESS"; // e.g., "0x123..."
  const stakingContractAddress = "YOUR_STAKING_CONTRACT_ADDRESS"; // e.g., "0x456..."
  const amount = ethers.parseUnits("1000000", 18); // 1 million FitechToken

  // Check if addresses are set
  if (fitechTokenAddress === "YOUR_FITECH_TOKEN_ADDRESS" || stakingContractAddress === "YOUR_STAKING_CONTRACT_ADDRESS") {
    throw new Error("Please update fitechTokenAddress and stakingContractAddress with deployed contract addresses");
  }

  // Connect to contracts
  const FitechToken = await ethers.getContractAt("FitechToken", fitechTokenAddress);
  const StakingContract = await ethers.getContractAt("StakingContract", stakingContractAddress);

  // Approve StakingContract to spend tokens
  console.log("Approving tokens...");
  const approveTx = await FitechToken.connect(owner).approve(stakingContractAddress, amount);
  await approveTx.wait();
  console.log("Approval successful");

  // Fund the reward pool
  console.log("Funding reward pool...");
  const fundTx = await StakingContract.connect(owner).fundRewardPool(amount);
  await fundTx.wait();
  console.log(`Funded reward pool with ${ethers.formatUnits(amount, 18)} FitechToken`);

  // Verify reward pool balance
  try {
    const rewardPoolBalance = await StakingContract.getRewardPoolBalance();
    console.log("Reward pool balance:", ethers.formatUnits(rewardPoolBalance, 18), "FitechToken");
  } catch (error) {
    console.error("Error fetching reward pool balance:", error.message);
  }
}

main().catch((error) => {
  console.error("Error in script:", error.message);
  process.exitCode = 1;
});