pragma solidity ^0.4.22;

import 'openzeppelin-solidity/contracts/math/SafeMath.sol';
import 'openzeppelin-solidity/contracts/token/ERC20/StandardToken.sol';
import "./lib/RedBlackTree.sol";

contract ExchangePure {
	using SafeMath for uint;

  address public owner;
  address public feeCollector;

  mapping (address => mapping (address => uint)) public balances;

  event Deposit(address token, address account, uint amount, uint balance);
	event Withdraw(address token, address account, uint amount, uint balance);

	modifier ownerOnly {
		require(msg.sender == owner);
		_;
	}

	constructor() public {
		owner = msg.sender;
		feeCollector = msg.sender;
	}

	function changeFeeCollector(address _feeCollector) public ownerOnly {
		feeCollector = _feeCollector;
	}

	// function changeFee() public {}

	function changeOwner(address _owner) public ownerOnly {
		owner = _owner;
	}

	function deposit(address _token, uint _amount) public payable {
		if (_token == 0) {
		require(msg.value == _amount);
		balances[0][msg.sender] = balances[0][msg.sender].add(msg.value);
    } else {
		require(msg.value == 0);
		balances[_token][msg.sender] = balances[_token][msg.sender].add(_amount);
		require(StandardToken(_token).transferFrom(msg.sender, this, _amount));
    }
    emit Deposit(_token, msg.sender, _amount, balances[_token][msg.sender]);
	}

	function withdraw(address _token, uint _amount) public {
		require(balances[_token][msg.sender] >= _amount);
    balances[_token][msg.sender] = balances[_token][msg.sender].sub(_amount);
    if (_token == 0) {
      require(msg.sender.send(_amount));
    } else {
      require(StandardToken(_token).transfer(msg.sender, _amount));
    }
    emit Withdraw(_token, msg.sender, _amount, balances[_token][msg.sender]);
	}

	// function placeOrder() public {}

	// function matchOrder() private {}

	// function trade() private {}

	// function cancelOrder() public {}

	// function getBalance() public {}

	// function getOrderBook() public {}
}

