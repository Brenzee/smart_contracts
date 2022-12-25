import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { formatUnits } from "ethers/lib/utils";

const amount = "1000";
const amountWithDecimals = amount + "0".repeat(18);

async function main() {
  const [deployer, user1, user2] = await ethers.getSigners();

  const TokenContract = await ethers.getContractFactory("ERC20Token");
  const token = await TokenContract.deploy("Token", "TKN", 1_000_000);
  await token.deployed();

  await token.connect(user1).mint(BigInt(amountWithDecimals) * BigInt(2));
  await token.connect(user2).mint(BigInt(amountWithDecimals) * BigInt(10));

  const rewardToken = await TokenContract.deploy("Reward Token", "RTKN", 1_000_000);
  await rewardToken.deployed();

  const StakingRewards = await ethers.getContractFactory("StakingRewards");
  const stakingRewards = await StakingRewards.deploy(token.address, rewardToken.address);

  await stakingRewards.deployed();

  await rewardToken.transfer(stakingRewards.address, BigInt(1_000_000) * BigInt(1e18));

  await token.approve(stakingRewards.address, await token.totalSupply());
  await token.connect(user1).approve(stakingRewards.address, await token.totalSupply());
  await token.connect(user2).approve(stakingRewards.address, await token.totalSupply());

  console.log("Staking with deployer");
  await stakingRewards.stake(BigInt(amountWithDecimals) * BigInt(2));

  console.log("");
  console.log("Staking with user1");
  await stakingRewards.connect(user1).stake(BigInt(amountWithDecimals));

  console.log("");
  console.log("Staking with user2");
  await stakingRewards.connect(user2).stake(BigInt(amountWithDecimals) * BigInt(10));

  await time.increase(10);

  console.log("");
  console.log("Pending rewards of deployer");
  const pendingReward = await stakingRewards.pendingReward(deployer.address);
  console.log(formatUnits(pendingReward.toString(), 18));

  console.log("");
  console.log("Pending rewards of user1");
  const pendingRewardsUser1 = await stakingRewards.pendingReward(user1.address);
  console.log(formatUnits(pendingRewardsUser1.toString(), 18));

  console.log("");
  console.log("Pending rewards of user2");
  const pendingRewardsUser2 = await stakingRewards.pendingReward(user2.address);
  console.log(formatUnits(pendingRewardsUser2.toString(), 18));

  console.log(" ");
  console.log(" ");

  await time.increase(1);

  console.log("");
  console.log("Pending rewards of deployer after 1");
  const pendingReward1 = await stakingRewards.pendingReward(deployer.address);
  console.log(formatUnits(pendingReward1.toString(), 18));

  console.log("");
  console.log("Pending rewards of user1 after 1");
  const pendingRewardsUser11 = await stakingRewards.pendingReward(user1.address);
  console.log(formatUnits(pendingRewardsUser11.toString(), 18));

  console.log("");
  console.log("Pending rewards of user2 after 1");
  const pendingRewardsUser21 = await stakingRewards.pendingReward(user2.address);
  console.log(formatUnits(pendingRewardsUser21.toString(), 18));

  console.log(" ");
  console.log(" ");

  await time.increase(3600);

  // await stakingRewards.connect(user1).stake(amountWithDecimals);

  await time.increase(3600);

  console.log(" ");
  console.log(" ");

  console.log("Pending rewards of deployer after 2 hours");
  const pendingRewardAfter = await stakingRewards.pendingReward(deployer.address);
  console.log(formatUnits(pendingRewardAfter.toString(), 18));
  console.log(" ");

  console.log("Pending rewards of user1 after 2 hours");
  const pendingRewardsUser1After = await stakingRewards.pendingReward(user1.address);
  console.log(formatUnits(pendingRewardsUser1After.toString(), 18));
  console.log(" ");

  console.log("Pending rewards of user2 after 2 hours");
  const pendingRewardsUser2After = await stakingRewards.pendingReward(user2.address);
  console.log(formatUnits(pendingRewardsUser2After.toString(), 18));

  console.log(" ");
  console.log(" ");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
