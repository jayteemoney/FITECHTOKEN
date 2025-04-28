// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract StakingContract {
    IERC20 public rewardToken;
    uint256 public rewardRate;
    uint256 public lockupPeriod;
    uint256 public rewardPool;
    uint256 public totalStaked;
    address public owner;

    struct StakeInfo {
        uint256 amount;
        uint256 stakeTime;
        uint256 lastClaimTime;
    }

    mapping(address => StakeInfo) public stakes;

    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount);
    event RewardClaimed(address indexed user, uint256 amount);
    event RewardPoolFunded(uint256 amount);
    event EmergencyWithdrawn(address indexed user, uint256 amount);

    constructor(address _owner, address _rewardToken, uint256 _rewardRate, uint256 _lockupPeriod) {
        require(_owner != address(0), "Owner cannot be zero address");
        owner = _owner;
        rewardToken = IERC20(_rewardToken);
        rewardRate = _rewardRate;
        lockupPeriod = _lockupPeriod;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }

    function stake() external payable {
        require(msg.value > 0, "Stake amount must be greater than 0");
        StakeInfo storage userStake = stakes[msg.sender];
        if (userStake.amount > 0) {
            claimReward();
        }
        userStake.amount += msg.value;
        userStake.stakeTime = block.timestamp;
        userStake.lastClaimTime = block.timestamp;
        totalStaked += msg.value;
        emit Staked(msg.sender, msg.value);
    }

    function unstake(uint256 amount) external {
        StakeInfo storage userStake = stakes[msg.sender];
        require(userStake.amount >= amount, "Insufficient staked amount");
        require(block.timestamp >= userStake.stakeTime + lockupPeriod, "Lockup period not passed");
        claimReward();
        userStake.amount -= amount;
        totalStaked -= amount;
        payable(msg.sender).transfer(amount);
        emit Unstaked(msg.sender, amount);
    }

    function claimReward() public {
        uint256 reward = availableReward(msg.sender);
        require(reward > 0, "No reward available");
        require(rewardPool >= reward, "Insufficient reward pool");
        StakeInfo storage userStake = stakes[msg.sender];
        userStake.lastClaimTime = block.timestamp;
        rewardPool -= reward;
        rewardToken.transfer(msg.sender, reward);
        emit RewardClaimed(msg.sender, reward);
    }

    function availableReward(address user) public view returns (uint256) {
        StakeInfo memory userStake = stakes[user];
        if (userStake.amount == 0) return 0;
        uint256 timeElapsed = block.timestamp - userStake.lastClaimTime;
        return (userStake.amount * rewardRate * timeElapsed) / 1e18;
    }

    function fundRewardPool(uint256 amount) external onlyOwner {
        require(amount > 0, "Amount must be greater than 0");
        rewardPool += amount;
        rewardToken.transferFrom(msg.sender, address(this), amount);
        emit RewardPoolFunded(amount);
    }

    function emergencyWithdraw() external {
        StakeInfo storage userStake = stakes[msg.sender];
        uint256 amount = userStake.amount;
        require(amount > 0, "No staked amount");
        userStake.amount = 0;
        totalStaked -= amount;
        payable(msg.sender).transfer(amount);
        emit EmergencyWithdrawn(msg.sender, amount);
    }

    function stakedAmount(address user) external view returns (uint256) {
        return stakes[user].amount;
    }

    function getRewardPoolBalance() external view returns (uint256) {
        return rewardPool;
    }

    function getTotalStaked() external view returns (uint256) {
        return totalStaked;
    }
}