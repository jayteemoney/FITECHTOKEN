
// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition
const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("PandasModule", (m) => {
  const deployer = m.getAccount(0);
  const token = m.contract("Pandas", [deployer]);

  return { token };
});