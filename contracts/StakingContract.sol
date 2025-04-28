// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract StakingContract is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    IERC20 public rewardToken;   // FitechToken for rewards
    uint256 public rewardRate;   // Reward rate per second per ETH staked
    uint256 public lockupPeriod; // Lockup period for staking

    struct Stake {
        uint256 amount;         // Amount of ETH staked
        uint256 rewardDebt;     // Tracks rewards already claimed
        uint256 lastStakeTime;  // When the user last staked
    }

    mapping(address => Stake) public stakes;

    uint256 public totalStaked;  // Total ETH staked
    uint256 public totalRewards; // Total FitechToken rewards distributed
    uint256 public rewardPool;   // Available FitechToken in the contract

    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount);
    event RewardClaimed(address indexed user, uint256 amount);
    event EmergencyWithdraw(address indexed user, uint256 amount);
    event RewardPoolFunded(uint256 amount);

    constructor(
        address initialOwner,
        address _rewardToken,
        uint256 _rewardRate,
        uint256 _lockupPeriod
    ) Ownable(initialOwner) {
        rewardToken = IERC20(_rewardToken); // FitechToken address
        rewardRate = _rewardRate;
        lockupPeriod = _lockupPeriod;
    }

    // Allow contract to receive Ether
    receive() external payable {}

    // Modifier to check if the user has a valid lockup
    modifier lockupNotPassed(address _user) {
        require(
            block.timestamp >= stakes[_user].lastStakeTime + lockupPeriod,
            "Lockup period not passed"
        );
        _;
    }

    // Fund the reward pool with FitechToken (admin only)
    function fundRewardPool(uint256 amount) external onlyOwner {
        require(amount > 0, "Amount must be greater than 0");
        rewardToken.safeTransferFrom(msg.sender, address(this), amount);
        rewardPool += amount;
        emit RewardPoolFunded(amount);
    }

    // Stake Ether and start earning FitechToken rewards
    function stake() external payable nonReentrant {
        require(msg.value > 0, "Amount must be greater than 0");

        // Update the user's stake
        Stake storage userStake = stakes[msg.sender];

        // Claim any rewards before updating stake
        _claimReward(msg.sender);

        userStake.amount += msg.value;
        userStake.lastStakeTime = block.timestamp;

        totalStaked += msg.value;

        emit Staked(msg.sender, msg.value);
    }

    // Unstake Ether after lockup period
    function unstake(uint256 amount) external nonReentrant lockupNotPassed(msg.sender) {
        require(amount > 0, "Amount must be greater than 0");
        require(stakes[msg.sender].amount >= amount, "Insufficient staked balance");

        // Claim any rewards before unstaking
        _claimReward(msg.sender);

        // Update stake
        stakes[msg.sender].amount -= amount;
        totalStaked -= amount;

        // Transfer Ether back to the user
        (bool sent, ) = msg.sender.call{value: amount}("");
        require(sent, "Failed to send Ether");

        emit Unstaked(msg.sender, amount);
    }

    // Claim accumulated FitechToken rewards
    function claimReward() external nonReentrant {
        _claimReward(msg.sender);
    }

    // Internal function to handle reward claim logic
    function _claimReward(address _user) internal {
        uint256 reward = _calculateReward(_user);
        if (reward == 0) return;

        require(rewardPool >= reward, "Insufficient reward pool");

        // Update the user's reward debt and last stake time
        stakes[_user].rewardDebt += reward;
        stakes[_user].lastStakeTime = block.timestamp;

        totalRewards += reward;
        rewardPool -= reward;

        // Transfer FitechToken rewards to the user
        rewardToken.safeTransfer(_user, reward);

        emit RewardClaimed(_user, reward);
    }

    // Emergency withdrawal of staked Ether (without rewards)
    function emergencyWithdraw() external nonReentrant {
        uint256 amount = stakes[msg.sender].amount;
        require(amount > 0, "No staked Ether to withdraw");

        // Reset the user's stake
        stakes[msg.sender].amount = 0;
        totalStaked -= amount;

        // Transfer Ether back to the user
        (bool sent, ) = msg.sender.call{value: amount}("");
        require(sent, "Failed to send Ether");

        emit EmergencyWithdraw(msg.sender, amount);
    }

    // Calculate the FitechToken reward for a specific user
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

    // View function to get the user's staked Ether amount
    function stakedAmount(address user) external view returns (uint256) {
        return stakes[user].amount;
    }

    // View function to get the total amount of FitechToken rewards available to a user
    function availableReward(address user) external view returns (uint256) {
        return _calculateReward(user);
    }

    // View function to get total staked Ether in the contract
    function getTotalStaked() external view returns (uint256) {
        return totalStaked;
    }
    
    // View function to get the current FitechToken reward pool balance
    function getRewardPoolBalance() external view returns (uint256) {
        return rewardPool;
    }
}