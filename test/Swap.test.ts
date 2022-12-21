import { expect } from "chai";
import { config, ethers } from "hardhat";
import { signTypedData, SignTypedDataVersion, TypedMessage } from "@metamask/eth-sig-util";
import { HardhatNetworkHDAccountsConfig } from "hardhat/types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import constants from "../lib/constants";
import { approveERC20, getBalance, getERC20Tokens } from "../lib/ERC20";
import { Swap } from "../typechain-types";

class TestArgs {
  swapContract: Swap;
  deployer: SignerWithAddress;

  constructor({ swapContract, deployer }: { swapContract: Swap; deployer: SignerWithAddress }) {
    this.swapContract = swapContract;
    this.deployer = deployer;
  }
}

let testArgs: TestArgs;

const SECOND = 1000;
const amount = "1000";
const amountWithDecimals = amount + "0".repeat(6);
const minReturnAmount = "998" + "0".repeat(18);

describe("Swap", function () {
  describe("Deployment", function () {
    it("Should set the right unlockTime", async function () {
      const [deployer] = await ethers.getSigners();

      const Swap = await ethers.getContractFactory("Swap");
      const swap = await Swap.deploy();

      await swap.deployed();

      testArgs = new TestArgs({ swapContract: swap, deployer });
    });
  });

  describe("Swap", function () {
    it("Should make a USDC/DAI Swap", async () => {
      const { deployer, swapContract } = testArgs;

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

      const swapTx = await swapContract.swapUniswapV3(deployer.address, amountWithDecimals, minReturnAmount, [
        PoolData,
      ]);
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
    it("Should make a USDC/DAI Swap with permit", async () => {
      const { deployer, swapContract } = testArgs;

      const DAI_Balance_Before = await getBalance(constants.DAI, deployer.address, deployer);

      await getERC20Tokens(amount, deployer.address, constants.USDC);
      const accounts = config.networks.hardhat.accounts as HardhatNetworkHDAccountsConfig;
      const index = 0; // first wallet, increment for next wallets=
      const wallet1 = ethers.Wallet.fromMnemonic(accounts.mnemonic, accounts.path + `/${index}`);
      const privateKey = wallet1.privateKey.slice(2);

      const wethUnwrap = "00";
      const zeroForOne = "00";
      const poolAddress = constants.USDC_DAI_POOL.slice(2);
      const poolData = "0x" + wethUnwrap + zeroForOne + poolAddress;

      const types = {
        EIP712Domain: [
          {
            name: "name",
            type: "string",
          },
          {
            name: "version",
            type: "string",
          },
          {
            name: "chainId",
            type: "uint256",
          },
          {
            name: "verifyingContract",
            type: "address",
          },
        ],
        Permit: [
          {
            name: "owner",
            type: "address",
          },
          {
            name: "spender",
            type: "address",
          },
          {
            name: "value",
            type: "uint256",
          },
          {
            name: "nonce",
            type: "uint256",
          },
          {
            name: "deadline",
            type: "uint256",
          },
        ],
      };

      const typedData: TypedMessage<typeof types> = {
        types,
        primaryType: "Permit",
        domain: {
          name: "USD Coin",
          version: "2",
          chainId: 1,
          verifyingContract: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        },
        message: {
          owner: deployer?.address,
          spender: swapContract?.address,
          value: amountWithDecimals,
          nonce: 1,
          deadline: Math.trunc((Date.now() + 120 * SECOND) / SECOND),
        },
      };

      // Deployer sign on EIP712 typed data
      const signatureString = signTypedData<SignTypedDataVersion.V4, typeof typedData["types"]>({
        data: typedData,
        privateKey: Buffer.from(privateKey, "hex"),
        version: SignTypedDataVersion.V4,
      });

      // Split signature into r, s and v variables
      const signature = ethers.utils.splitSignature(signatureString);

      const tx = await swapContract?.swapUniswapV3WithPermit(
        deployer?.address as string,
        amountWithDecimals,
        minReturnAmount,
        [poolData],
        {
          v: signature.v,
          r: signature.r,
          s: signature.s,
          deadline: Math.trunc((Date.now() + 120 * SECOND) / SECOND),
          token: constants.USDC,
        }
      );

      await tx?.wait();

      const DAI_Balance = await getBalance(constants.DAI, deployer.address, deployer);

      console.log("DAI Balance Before Swap: ", DAI_Balance_Before);
      console.log("DAI Balance After Swap:  ", DAI_Balance);

      expect(Number(DAI_Balance)).to.be.gt(Number(DAI_Balance_Before) + Number(minReturnAmount) / 1e18);
    });
  });
});
