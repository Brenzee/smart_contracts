import { ethers, network } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { StakingRewards, ERC20Token } from "../../typechain-types";
import { formatUnits } from "ethers/lib/utils";
import { getPendingRewards } from "./helpers";

class TestArgs {
  stakingRewards: StakingRewards;
  token: ERC20Token;
  rewardToken: ERC20Token;
  deployer: SignerWithAddress;
  user1: SignerWithAddress;

  constructor({
    stakingRewards,
    token,
    rewardToken,
    deployer,
    user1,
  }: {
    stakingRewards: StakingRewards;
    token: ERC20Token;
    rewardToken: ERC20Token;
    deployer: SignerWithAddress;
    user1: SignerWithAddress;
  }) {
    this.stakingRewards = stakingRewards;
    this.deployer = deployer;
    this.token = token;
    this.rewardToken = rewardToken;
    this.user1 = user1;
  }
}

export let testArgs: TestArgs;

const amount = "1000";
const amountWithDecimals = amount + "0".repeat(18);

describe("ERC20 Staking Contract", function () {
  describe("Deployment", function () {
    it("Should deploy contracts", async function () {
      const [deployer, user1] = await ethers.getSigners();

      const TokenContract = await ethers.getContractFactory("ERC20Token");
      const token = await TokenContract.deploy("Token", "TKN", 1_000_000);
      await token.deployed();

      await token.connect(user1).mint(BigInt(amountWithDecimals) * BigInt(2));

      const rewardToken = await TokenContract.deploy("Reward Token", "RTKN", 1_000_000);
      await rewardToken.deployed();

      const StakingRewards = await ethers.getContractFactory("StakingRewards");
      const stakingRewards = await StakingRewards.deploy(token.address, rewardToken.address);

      await stakingRewards.deployed();

      await rewardToken.transfer(stakingRewards.address, BigInt(1_000_000) * BigInt(1e18));

      testArgs = new TestArgs({ stakingRewards, token, rewardToken, deployer, user1 });
    });
  });
  describe("Staking/depositing", () => {
    it("Should deposit tokens", async () => {
      const { stakingRewards, deployer, token, rewardToken, user1 } = testArgs;
      await stakingRewards.deposit(amountWithDecimals);
      console.log("Before user1 staking", await getPendingRewards(deployer.address));

      await network.provider.send("hardhat_mine", [`0x${(100).toString(16)}`]);

      await stakingRewards.connect(user1).deposit(BigInt(amountWithDecimals) * BigInt(2));

      console.log("Rewards deployer", await getPendingRewards(deployer.address));
      console.log("Rewards user1", await getPendingRewards(user1.address));

      await network.provider.send("hardhat_mine", [`0x${(10).toString(16)}`]);

      console.log("Rewards deployer after 10 blocks", await getPendingRewards(deployer.address));
      console.log("Rewards user1 after 10 blocks", await getPendingRewards(user1.address));

      await network.provider.send("hardhat_mine", [`0x${(15).toString(16)}`]);

      const rewardsDeployer = await getPendingRewards(deployer.address);
      const rewardsUser1 = await getPendingRewards(user1.address);

      console.log("Rewards deployer after 25 blocks", rewardsDeployer);
      console.log("Rewards user1 after 25 blocks", rewardsUser1);

      await network.provider.send("hardhat_mine", [`0x${(1).toString(16)}`]);

      const rewardsDeployerAfter1Block = await getPendingRewards(deployer.address);
      const rewardsUser1After1Block = await getPendingRewards(user1.address);

      console.log("Rewards deployer after 26 blocks", rewardsDeployerAfter1Block);
      console.log("Rewards user1 after 26 blocks", rewardsUser1After1Block);

      console.log("Rewards deployer diff", parseFloat(rewardsDeployerAfter1Block) - parseFloat(rewardsDeployer));
      console.log("Rewards user1 diff", parseFloat(rewardsUser1After1Block) - parseFloat(rewardsUser1));

      await stakingRewards.withdraw(amountWithDecimals);

      console.log("Rewards deployer after withdraw", await getPendingRewards(deployer.address));
      console.log("Rewards user1 after withdraw", await getPendingRewards(user1.address));

      const balance = await token.balanceOf(deployer.address);
      console.log(formatUnits(balance, 18));

      const reward = await rewardToken.balanceOf(deployer.address);
      console.log(formatUnits(reward, 18));
    });
  });
});
