// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract StakingContract is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    IERC20 public stakingToken;  // I Am Referencing  the Pandas token
    uint256 public rewardRate;   // Reward rate per block
    uint256 public lockupPeriod; // Lockup period for staking

    struct Stake {
        uint256 amount;
        uint256 rewardDebt;
        uint256 lastStakeTime;
    }

    mapping(address => Stake) public stakes;

    uint256 public totalStaked;  // Total amount of tokens staked
    uint256 public totalRewards; // Total rewards distributed
    uint256 public rewardPool;   // Available reward tokens in the contract

    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount);
    event RewardClaimed(address indexed user, uint256 amount);
    event EmergencyWithdraw(address indexed user, uint256 amount);
    event RewardPoolFunded(uint256 amount);

    constructor(
        address initialOwner,
        address _stakingToken,
        uint256 _rewardRate,
        uint256 _lockupPeriod
    ) Ownable(initialOwner) {
        stakingToken = IERC20(_stakingToken);
        rewardRate = _rewardRate;
        lockupPeriod = _lockupPeriod;
    }

    // Modifier to check if the user has a valid lockup
    modifier lockupNotPassed(address _user) {
        require(
            block.timestamp >= stakes[_user].lastStakeTime + lockupPeriod,
            "Lockup period not passed"
        );
        _;
    }

    // Fund the reward pool admin only
    function fundRewardPool(uint256 amount) external onlyOwner {
        require(amount > 0, "Amount must be greater than 0");
        
        // Transfer tokens from owner to contract
        stakingToken.safeTransferFrom(msg.sender, address(this), amount);
        rewardPool += amount;
        
        emit RewardPoolFunded(amount);
    }

    // Stake tokens and start earning rewards
    function stake(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be greater than 0");

        // Transfer staking tokens to the contract
        stakingToken.safeTransferFrom(msg.sender, address(this), amount);

        // Update the user's stake
        Stake storage userStake = stakes[msg.sender];

        // Claim any rewards before updating stake
        _claimReward(msg.sender);

        userStake.amount += amount;
        userStake.lastStakeTime = block.timestamp;

        totalStaked += amount;

        emit Staked(msg.sender, amount);
    }

    // Unstake tokens after lockup period
    function unstake(uint256 amount) external nonReentrant lockupNotPassed(msg.sender) {
        require(amount > 0, "Amount must be greater than 0");
        require(stakes[msg.sender].amount >= amount, "Insufficient staked balance");

        // Claim any rewards before unstaking
        _claimReward(msg.sender);

        // Update stake
        stakes[msg.sender].amount -= amount;
        totalStaked -= amount;

        // Transfer the unstaked tokens back to the user
        stakingToken.safeTransfer(msg.sender, amount);

        emit Unstaked(msg.sender, amount);
    }

    // Claim accumulated rewards
    function claimReward() external nonReentrant {
        _claimReward(msg.sender);
    }

    // Internal function to handle reward claim logic
    function _claimReward(address _user) internal {
        uint256 reward = _calculateReward(_user);
        if (reward == 0) return;

        require(rewardPool >= reward, "Insufficient reward pool");

        // Update the user's reward debt to avoid re-claiming same rewards
        stakes[_user].rewardDebt += reward;
        stakes[_user].lastStakeTime = block.timestamp;

        totalRewards += reward;
        rewardPool -= reward;

        // Transfer the reward tokens to the user
        stakingToken.safeTransfer(_user, reward);

        emit RewardClaimed(_user, reward);
    }

    // Emergency withdrawal of staked tokens by the user (without rewards)
    function emergencyWithdraw() external nonReentrant {
        uint256 amount = stakes[msg.sender].amount;
        require(amount > 0, "No staked tokens to withdraw");

        // Reset the user's stake
        stakes[msg.sender].amount = 0;
        totalStaked -= amount;

        // Transfer tokens back to the user
        stakingToken.safeTransfer(msg.sender, amount);

        emit EmergencyWithdraw(msg.sender, amount);
    }

    // Calculate the reward for a specific user
    function _calculateReward(address _user) internal view returns (uint256) {
        Stake memory userStake = stakes[_user];
        if (userStake.amount == 0) return 0;
        
        uint256 timeStaked = block.timestamp - userStake.lastStakeTime;
        uint256 reward = (userStake.amount * rewardRate * timeStaked) / 1e18;
        return reward > userStake.rewardDebt ? reward - userStake.rewardDebt : 0;
    }

    // Update the reward rate (admin only)
    function updateRewardRate(uint256 newRewardRate) external onlyOwner {
        rewardRate = newRewardRate;
    }

    // Update the lockup period (admin only)
    function updateLockupPeriod(uint256 newLockupPeriod) external onlyOwner {
        lockupPeriod = newLockupPeriod;
    }

    // View function to get the user's staked amount
    function stakedAmount(address user) external view returns (uint256) {
        return stakes[user].amount;
    }

    // View function to get the total amount of rewards available to a user
    function availableReward(address user) external view returns (uint256) {
        return _calculateReward(user);
    }

    // View function to get total staked amount in the contract
    function getTotalStaked() external view returns (uint256) {
        return totalStaked;
    }
    
    // View function to get the current reward pool balance
    function getRewardPoolBalance() external view returns (uint256) {
        return rewardPool;
    }
}