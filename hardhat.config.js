require ("@nomicfoundation/hardhat-toolbox");
require("dotenv").config({ path: ".env" });

module.exports = {
  solidity: "0.8.28",
  networks: {
    sepolia: {
      url: process.env.ALCHEMY_SEPOLIA_API_URL,
    

      accounts: [process.env.ACCOUNT_PRIVATE_KEY],
    },
  },

  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
};