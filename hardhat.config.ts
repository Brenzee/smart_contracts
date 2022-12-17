import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@openzeppelin/hardhat-upgrades";
import "hardhat-gas-reporter";

const config: HardhatUserConfig = {
  solidity: "0.8.17",
  networks: {
    hardhat: {
      forking: {
        url: "https://eth-mainnet.g.alchemy.com/v2/sBFOUbHhuX8WlgXtZ6kueGIGTY3UAxdM",
      },
    },
  },
  gasReporter: {
    enabled: true,
  },
};

export default config;
