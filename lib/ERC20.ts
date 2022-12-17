import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers } from "hardhat";
import constants from "./constants";

export const getERC20Contract = (token: string, signer: SignerWithAddress) => {
  return new ethers.Contract(
    token,
    [
      "function approve(address, uint256) public returns (bool)",
      "function balanceOf(address) view returns (uint)",
      "function decimals() view returns (uint)",
      "function transfer(address, uint256) public returns (bool)",
    ],
    signer
  );
};

export const approveERC20 = async ({
  amount,
  spender,
  token,
  signer,
}: {
  amount: string;
  spender: string;
  token: string;
  signer: SignerWithAddress;
}) => {
  try {
    const ERC20Contract = getERC20Contract(token, signer);
    const decimals = await ERC20Contract.decimals();
    const approve = await ERC20Contract.approve(spender, ethers.utils.parseUnits(amount, decimals.toNumber()));
    await approve.wait();
  } catch (e) {
    console.log(e);
  }
};

export const getERC20Tokens = async (amount: string, address: string, token: string) => {
  try {
    const impersonatedSigner = await ethers.getImpersonatedSigner(constants.WHALE);
    const ERC20Contract = getERC20Contract(token, impersonatedSigner);

    const decimals = await ERC20Contract.decimals();
    const transfer = await ERC20Contract.transfer(address, ethers.utils.parseUnits(amount, decimals.toNumber()));

    await transfer.wait();
  } catch (e) {
    console.log(e);
  }
};

export const getBalance = async (token: string, address: string, signer: SignerWithAddress) => {
  const ERC20Contract = getERC20Contract(token, signer);
  const balance = await ERC20Contract.balanceOf(address);

  // Decimals
  const decimals = await ERC20Contract.decimals();

  return ethers.utils.formatUnits(balance, decimals.toNumber());
};
