import { ethers } from "hardhat";
import { approveERC20, getERC20Tokens } from "../../lib/ERC20";
import constants from "../../lib/constants";

async function main() {
  // Get signer
  const [deployer] = await ethers.getSigners();

  await getERC20Tokens("1000", deployer.address, constants.USDC);

  const Swap = await ethers.getContractFactory("Swap");
  const swap = await Swap.deploy();

  await swap.deployed();

  const zeroForOne = "00";
  const poolAddress = constants.USDC_DAI_POOL.slice(2);
  const PoolData = "0x" + zeroForOne + poolAddress;

  console.log(PoolData);

  await approveERC20({
    amount: "1000",
    spender: swap.address,
    signer: deployer,
    token: constants.USDC,
  });

  const swapTx = await swap.swapUniswapV3(deployer.address, "1000", "990", [PoolData]);

  await swapTx.wait();
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
