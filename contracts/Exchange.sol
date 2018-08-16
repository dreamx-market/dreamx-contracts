pragma solidity ^0.4.22;

import 'openzeppelin-solidity/contracts/math/SafeMath.sol';
import 'openzeppelin-solidity/contracts/token/ERC20/StandardToken.sol';

contract Exchange {
	using SafeMath for uint;

    address public owner;
    address public feeAccount;
	uint public timelock;

	mapping (address => uint256) public lastActivity;
    mapping (address => mapping (address => uint)) public balances;

    event Deposit(address token, address user, uint amount, uint balance);
	// event Withdraw(address token, address user, uint amount, uint balance);
	// event Order(address tokenBuy, uint amountBuy, address tokenSell, uint amountSell, uint expires, uint nonce, address user, uint8 v, bytes32 r, bytes32 s);
	// event Cancel(address tokenBuy, uint amountBuy, address tokenSell, uint amountSell, uint expires, uint nonce, address user, uint8 v, bytes32 r, bytes32 s);
	// event Trade(address tokenBuy, uint amountBuy, address tokenSell, uint amountSell, address get, address give);

	modifier ownerOnly {
		require(msg.sender == owner);
		_;
	}

	constructor() public {
		owner = msg.sender;
		feeAccount = msg.sender;
    	timelock = 100000;
	}

	function changeFeeAccount(address _feeAccount) public ownerOnly {
		feeAccount = _feeAccount;
	}

	function changeOwner(address _owner) public ownerOnly {
		owner = _owner;
	}

	function setTimelock(uint _duration) public ownerOnly {
		require(_duration <= 1000000);
		timelock = _duration;
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

	// function withdraw() public ownerOnly {}

	// function withdrawEmergency() public {}

	// function trade() public ownerOnly {}
}

