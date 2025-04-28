// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract FitechToken is ERC20 {
    constructor(address initialOwner)
        ERC20("FitechToken", "FTK")
    {
        require(initialOwner != address(0), "Initial owner cannot be zero address");
        _mint(initialOwner, 10000000000 * 10 ** decimals());
    }

    function mint(address to, uint256 amount) public {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) public {
        _burn(from, amount);
    }

    function getBalance(address account) public view returns (uint256) {
        return balanceOf(account);
    }

    function getTotalSupply() public view returns (uint256) {
        return totalSupply();
    }
}