pragma solidity ^0.4.22;

import 'openzeppelin-solidity/contracts/math/SafeMath.sol';
import 'openzeppelin-solidity/contracts/token/ERC20/StandardToken.sol';

contract Exchange {
	using SafeMath for uint;

    address public owner;
    address public feeAccount;
	uint256 public timelock;

    mapping (address => mapping (address => uint)) public balances;

    event Deposit(address token, address user, uint amount, uint balance);
	event Withdraw(address token, address user, uint amount, uint balance);
	event Order(address tokenBuy, uint256 amountBuy, address tokenSell, uint256 amountSell, uint256 expires, uint256 nonce, address user, uint8 v, bytes32 r, bytes32 s);
	event Cancel(address tokenBuy, uint256 amountBuy, address tokenSell, uint256 amountSell, uint256 expires, uint256 nonce, address user, uint8 v, bytes32 r, bytes32 s);
	event Trade(address tokenBuy, uint256 amountBuy, address tokenSell, uint256 amountSell, address get, address give);

	modifier isOwner {
		require(msg.sender == owner);
		_;
	}

	constructor() public {
		owner = msg.sender;
		feeAccount = msg.sender;
    	timelock = 100000;
	}

	function changeFeeAccount(address _feeAccount) public isOwner {
		feeAccount = _feeAccount;
	}

	function changeOwner(address _owner) public isOwner {
		owner = _owner;
	}

	function deposit() public payable {}

	// function withdraw() public {}

	// function withdrawEmergency() public {}

	// function trade() public {}
}

