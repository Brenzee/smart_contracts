import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import constants from "../lib/constants";
import { approveERC20, getBalance, getERC20Tokens } from "../lib/ERC20";

class TestArgs {
  swapContract?: Contract;
  deployer?: SignerWithAddress;
}

const testArgs = new TestArgs();

describe("Swap", function () {
  describe("Deployment", function () {
    it("Should set the right unlockTime", async function () {
      const [deployer] = await ethers.getSigners();

      const Swap = await ethers.getContractFactory("Swap");
      const swap = await Swap.deploy();

      await swap.deployed();

      testArgs.swapContract = swap;
      testArgs.deployer = deployer;
    });
  });

  describe("Swap", function () {
    it("Should make a USDC/DAI Swap", async () => {
      const { deployer, swapContract } = testArgs;
      if (!deployer || !swapContract) throw new Error("Deployer not set");

      const amount = "1000";
      const amountWithDecimals = amount + "0".repeat(6);

      await getERC20Tokens(amount, deployer.address, constants.USDC);

      const DAI_Balance_Before = await getBalance(constants.DAI, deployer.address, deployer);
      const USDC_Balance_Before = await getBalance(constants.USDC, deployer.address, deployer);

      const wethUnwrap = "00";
      const zeroForOne = "00";
      const poolAddress = constants.USDC_DAI_POOL.slice(2);
      const PoolData = "0x" + wethUnwrap + zeroForOne + poolAddress;

      await approveERC20({
        amount: amount,
        spender: swapContract.address,
        signer: deployer,
        token: constants.USDC,
      });

      const swapTx = await swapContract.swapOnUniswapV3(PoolData, amountWithDecimals);
      await swapTx.wait();

      const DAI_Balance = await getBalance(constants.DAI, deployer.address, deployer);
      const USDC_Balance = await getBalance(constants.USDC, deployer.address, deployer);

      console.log("DAI Balance Before Swap: ", DAI_Balance_Before);
      console.log("USDC Balance Before Swap: ", USDC_Balance_Before);

      console.log("DAI Balance After Swap: ", DAI_Balance);
      console.log("USDC Balance After Swap: ", USDC_Balance);

      expect(Number(DAI_Balance)).to.be.gt(Number(DAI_Balance_Before) + Number(amount) * 0.95);
      expect(USDC_Balance).to.be.eq((Number(USDC_Balance_Before) - Number(amount)).toFixed(6));
    });
  });
});
