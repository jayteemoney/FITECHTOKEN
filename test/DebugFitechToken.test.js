const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("FitechToken Debug", function () {
    it("should deploy FitechToken", async function () {
        const [owner] = await ethers.getSigners();
        console.log("Owner address:", owner.address);
        try {
            const FitechToken = await ethers.getContractFactory("FitechToken");
            console.log("Contract factory created");
            const deployTx = await FitechToken.deploy(owner.address, { gasLimit: 5000000 });
            console.log("Deploy transaction sent:", deployTx);
            const receipt = await deployTx.deploymentTransaction().wait();
            console.log("Deployment receipt:", receipt);
            if (!receipt.contractAddress) {
                throw new Error("No contract address in receipt");
            }
            const fitechToken = await ethers.getContractAt("FitechToken", receipt.contractAddress);
            console.log("FitechToken address:", fitechToken.address);
            expect(fitechToken.address).to.not.equal(undefined, "FitechToken address is undefined");
            expect(await fitechToken.name()).to.equal("FitechToken");
        } catch (error) {
            console.error("FitechToken deployment failed:", error);
            throw error;
        }
    });
});