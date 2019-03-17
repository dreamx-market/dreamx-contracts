pragma solidity ^0.4.22;

import 'openzeppelin-solidity/contracts/token/ERC20/StandardToken.sol';

contract Token is StandardToken {
  using SafeMath for uint;

  constructor(uint256 _totalSupply) public {
    totalSupply_ = _totalSupply;
    balances[msg.sender] = _totalSupply;
  }
}
