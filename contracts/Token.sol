pragma solidity ^0.4.22;

import 'openzeppelin-solidity/contracts/math/SafeMath.sol';
import 'openzeppelin-solidity/contracts/token/ERC20/StandardToken.sol';

contract Token is StandardToken {
  using SafeMath for uint;

  string public name;
  string public symbol;
  uint8 public decimals;
  uint256 public unitsOneEthCanBuy;
  uint256 public totalEthInWei;
  address public owner;
  bool initialized = false;

  constructor() public {
    decimals = 18;
    owner = msg.sender;
  }

  modifier restricted {
		require(msg.sender == owner);
		_;
	}

	modifier uninitialized {
		require(initialized == false);
		_;	
	}

  function initialize(
  	string _name,
    string _symbol,
    uint256 _unitsOneEthCanBuy,
    uint256 _totalSupply
  ) public restricted uninitialized {
  	totalSupply_ = _totalSupply;
    balances[owner] = _totalSupply;
    name = _name;
    symbol = _symbol;
    unitsOneEthCanBuy = _unitsOneEthCanBuy;
    initialized = true;
  }

  function() public payable {
    totalEthInWei = totalEthInWei + msg.value;
    uint256 amount = msg.value * unitsOneEthCanBuy;
    require(balances[owner] >= amount);
    balances[owner] = balances[owner].sub(amount);
    balances[msg.sender] = balances[msg.sender].add(amount);
    emit Transfer(owner, msg.sender, amount);
    owner.transfer(msg.value);
  }
}
