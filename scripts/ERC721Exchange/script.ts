import { signTypedData, SignTypedDataVersion } from "@metamask/eth-sig-util";
import { ethers, config } from "hardhat";
import { HardhatNetworkHDAccountsConfig } from "hardhat/types";

function getDate(days = 0) {
  const result = new Date();
  result.setDate(result.getDate() + days);
  return Number(result.getTime() / 1000).toFixed();
}

async function main() {
  // Get signer
  const [deployer, user1] = await ethers.getSigners();

  const ERC721Exchange = await ethers.getContractFactory("ERC721Exchange");
  const erc721Exchange = await ERC721Exchange.deploy();

  await erc721Exchange.deployed();

  const ERC721 = await ethers.getContractFactory("ERC721Token");
  const erc721 = await ERC721.deploy();

  await erc721.deployed();

  await erc721.mint(deployer.address);
  await erc721.approve(erc721Exchange.address, 1);

  const message = {
    token: erc721.address,
    tokenId: 1,
    price: ethers.utils.parseEther("0.1").toString(),
    expiresAt: getDate(1),
  };

  const accounts = config.networks.hardhat.accounts as HardhatNetworkHDAccountsConfig;
  const wallet1 = ethers.Wallet.fromMnemonic(accounts.mnemonic, accounts.path + `/0`);

  const deployerPrivateKey = wallet1.privateKey;

  const data = {
    types: {
      EIP712Domain: [
        { name: "name", type: "string" },
        { name: "version", type: "string" },
        { name: "chainId", type: "uint256" },
        { name: "verifyingContract", type: "address" },
        { name: "salt", type: "bytes32" },
      ],
      Sale: [
        { name: "token", type: "address" },
        { name: "tokenId", type: "uint256" },
        { name: "price", type: "uint256" },
        { name: "expiresAt", type: "uint256" },
      ],
    },
    primaryType: "Sale",
    domain: {
      name: await erc721Exchange.NAME(),
      version: await erc721Exchange.VERSION(),
      chainId: (await erc721Exchange.CHAIN_ID()).toNumber(),
      verifyingContract: erc721Exchange.address,
      salt: await erc721Exchange.SALT(),
    },
    message: message,
  };

  const signature = signTypedData<SignTypedDataVersion.V4, typeof data["types"]>({
    // @ts-ignore
    data,
    version: SignTypedDataVersion.V4,
    privateKey: Buffer.from(deployerPrivateKey.slice(2), "hex"),
  });

  // Split signature
  const { r, s, v } = ethers.utils.splitSignature(signature);

  const signer = await erc721Exchange.getSigner(message, r, s, v);

  console.log("Deployer address: ", deployer.address);
  console.log("Signer address:   ", signer);

  console.log("\n");

  // Get owner of nft tokenID 1
  const owner = await erc721.ownerOf(1);
  console.log("Owner of tokenId 1 address:     ", owner);
  const ethBalanceOfDeployer = await deployer.getBalance();
  console.log("Deployer ETH balance:           ", ethBalanceOfDeployer.toString());
  const ethBalanceOfUser1 = await user1.getBalance();
  console.log("User1 ETH balance:              ", ethBalanceOfUser1.toString());
  const ethBalanceOfContract = await ethers.provider.getBalance(erc721Exchange.address);
  console.log("Contract ETH balance:           ", ethBalanceOfContract.toString(), "\n");

  await erc721Exchange.connect(user1).buy(message, r, s, v, { value: message.price });

  // Get owner of nft tokenID 1
  const newOwner = await erc721.ownerOf(1);
  console.log("New owner of tokenId 1 address: ", newOwner);
  const newEthBalanceOfDeployer = await deployer.getBalance();
  console.log("Deployer ETH balance:           ", newEthBalanceOfDeployer.toString());
  const newEthBalanceOfUser1 = await user1.getBalance();
  console.log("User1 ETH balance:              ", newEthBalanceOfUser1.toString());
  const newEthBalanceOfContract = await ethers.provider.getBalance(erc721Exchange.address);
  console.log("Contract ETH balance:           ", newEthBalanceOfContract.toString());
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
