pragma solidity ^0.4.22;

import 'openzeppelin-solidity/contracts/math/SafeMath.sol';
import 'openzeppelin-solidity/contracts/token/ERC20/StandardToken.sol';
import "./lib/RedBlackTree.sol";

contract ExchangePure {
	using SafeMath for uint;

	enum Fee {
		Maker,
		Taker,
		Withdrawal
	}

  address public owner;
  address public feeCollector;

  mapping (address => mapping (address => uint)) public balances;
  mapping (uint => uint) public fees;

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

	function changeFee(uint _type, uint _value) public {
		if (_value > 50 finney) _value = 50 finney;
		fees[_type] = _value;
	}

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
    uint fee = (fees[uint(Fee.Withdrawal)].mul(_amount)).div(1 ether);
    balances[_token][feeCollector] = balances[_token][feeCollector].add(fee);
    if (_token == 0) {
      require(msg.sender.send(_amount.sub(fee)));
    } else {
      require(StandardToken(_token).transfer(msg.sender, _amount.sub(fee)));
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

