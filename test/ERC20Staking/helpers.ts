import { formatUnits } from "ethers/lib/utils";
import { testArgs } from "./ERC20Staking.test";

export const getPendingRewards = async (user: string) => {
  const pendingRewards = await testArgs.erc20Staking.pendingRewards(user);
  return formatUnits(pendingRewards, 18);
};
