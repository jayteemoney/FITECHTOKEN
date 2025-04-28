// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract FitechToken is ERC20, Ownable, ERC20Permit {
    constructor(address initialOwner)
        ERC20("FitechToken", "FTK")
        Ownable(initialOwner)
        ERC20Permit("FitechToken")
    {
        _mint(msg.sender, 10000000000 * 10 ** decimals());
    }

    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) public onlyOwner {
        _burn(from, amount);
    }

    function getBalance(address account) public view returns (uint256) {
        return balanceOf(account);
    }

    function getTotalSupply() public view returns (uint256) {
        return totalSupply();
    }
}