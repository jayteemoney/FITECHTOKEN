const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("FitechDeployment", (m) => {
    const owner = m.getAccount(0);
    const rewardRate = "115700000000000"; // ~0.01 FTK/day/ETH
    const lockupPeriod = 30 * 24 * 60 * 60; // 30 days

    const fitechToken = m.contract("FitechToken", [owner]);
    const stakingContract = m.contract("StakingContract", [
        owner,
        fitechToken,
        rewardRate,
        lockupPeriod
    ]);

    return { fitechToken, stakingContract };
});