// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "hardhat/console.sol";

contract StakingRewards {
    IERC20 public immutable stakingToken;
    IERC20 public immutable rewardsToken;

    // Owner of the staking contract, who can update reward rate
    address public owner;

    // Timestamp when action took place in staking contract (stake, withdraw, getReward)
    uint public updatedAt;
    // How much does the staking contract reward per second
    // Reward gets split between all stakers according to their share
    uint public rewardRate = 1 * 1e12;
    // Sum of (reward rate * dt * 1e18 / total supply)
    uint public rewardPerTokenStored;
    uint public totalSupply;

    /* How much to subtract from the reward per token

    Explanation:
    Doesn't reward the user for time before they haven't staked */
    mapping(address => uint) public stakersFeePerTokenStaked;

    // How much reward the user has earned after depositing more tokens
    mapping(address => uint) public rewards;

    // How much tokens the user has staked
    mapping(address => uint) public balanceOf;

    constructor(address _stakingToken, address _rewardToken) {
        stakingToken = IERC20(_stakingToken);
        rewardsToken = IERC20(_rewardToken);
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    modifier updateReward(address _account) {
        rewardPerTokenStored = rewardPerToken();
        updatedAt = block.timestamp;

        if (_account != address(0)) {
            rewards[_account] = pendingReward(_account);
            stakersFeePerTokenStaked[_account] = rewardPerTokenStored;
        }

        _;
    }

    function rewardPerToken() public view returns (uint) {
        if (totalSupply == 0) {
            return rewardPerTokenStored;
        }

        return rewardPerTokenStored + (rewardRate * (block.timestamp - updatedAt) * 1e18) / totalSupply;
    }

    function stake(uint _amount) external updateReward(msg.sender) {
        require(_amount > 0, "amount = 0");
        stakingToken.transferFrom(msg.sender, address(this), _amount);
        balanceOf[msg.sender] += _amount;
        totalSupply += _amount;
    }

    function withdraw(uint _amount) external updateReward(msg.sender) {
        require(_amount > 0, "amount = 0");
        balanceOf[msg.sender] -= _amount;
        totalSupply -= _amount;
        stakingToken.transfer(msg.sender, _amount);
    }

    function pendingReward(address _account) public view returns (uint) {
        return
            ((balanceOf[_account] * (rewardPerToken() - stakersFeePerTokenStaked[_account])) / 1e18) +
            rewards[_account];
    }

    function getReward() external updateReward(msg.sender) {
        uint reward = rewards[msg.sender];
        if (reward > 0) {
            rewards[msg.sender] = 0;
            rewardsToken.transfer(msg.sender, reward);
        }
    }

    function updateRewardRate(uint _rewardRate) external onlyOwner updateReward(address(0)) {
        rewardRate = _rewardRate;
    }
}
