require("@nomicfoundation/hardhat-toolbox");
require("@nomicfoundation/hardhat-ignition");
require("dotenv").config();

module.exports = {
  solidity: "0.8.27",
  networks: {
    hardhat: {
      // Local network for testing
    },
    sepolia: {
      url: process.env.ALCHEMY_SEPOLIA_API_URL,
      accounts: process.env.ACCOUNT_PRIVATE_KEY ? [process.env.ACCOUNT_PRIVATE_KEY] : []
    }
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY
  },
  ignition: {
    // Optional: Customize Ignition settings if needed
  }
};