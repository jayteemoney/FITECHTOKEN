const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("FitechDeployment", (m) => {
  // Get the deployer's address
  const deployer = m.getAccount(0);

  // Deploy FitechToken
  const fitechToken = m.contract("FitechToken", [deployer]);

  // Set reward rate (~0.01 FitechToken per ETH per day) and lockup period (30 days)
  const rewardRate = ethers.utils.parseUnits("0.0000001157", 18); // ~0.01 FitechToken/day/ETH
  const lockupPeriod = 30 * 24 * 60 * 60; // 30 days in seconds

  // Deploy StakingContract
  const stakingContract = m.contract("StakingContract", [
    deployer, // initialOwner
    fitechToken, // rewardToken (links to FitechToken)
    rewardRate,
    lockupPeriod
  ]);

  return { fitechToken, stakingContract };
});