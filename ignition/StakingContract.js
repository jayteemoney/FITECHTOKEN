const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");
const { parseEther } = require("ethers");

module.exports = buildModule("StakingModule", (m) => {
  const rewardRate = parseEther("0.0001"); // 0.0001 tokens per second
  const lockupPeriod = 7 * 24 * 60 * 60; // 7 days

  // Deploy Pandas token
  const pandasToken = m.contract("Pandas", [m.getAccount(0)]);

  // Deploy StakingContract
  const stakingContract = m.contract("StakingContract", [
    m.getAccount(0),
    pandasToken,
    rewardRate,
    lockupPeriod,
  ]);

  return {
    pandasToken,
    stakingContract,
  };
});