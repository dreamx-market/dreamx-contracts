pragma solidity ^0.4.22;

import 'openzeppelin-solidity/contracts/math/SafeMath.sol';
import 'openzeppelin-solidity/contracts/token/ERC20/StandardToken.sol';

contract Exchange {
	using SafeMath for uint;

  address public signer;
  address public owner;
  address public feeCollector;
	uint public timelock;
	mapping (address => uint) public lastActivity;
  mapping (address => mapping (address => uint)) public balances;
  mapping (bytes32 => uint) public orderFills;
  mapping (bytes32 => bool) public withdrawn;
  mapping (bytes32 => bool) public traded;
  bool public airdropStatus;
	address public airdropTokenAddress;
	uint public airdropRatePerEth;
	address public airdropAccountAddress;

  event Deposit(address token, address account, uint amount, uint balance);
	event Withdraw(address token, address account, uint amount, uint balance);
	event Trade(address tokenBuy, uint amountBuy, address tokenSell, uint amountSell, address get, address give);

	modifier signerOnly {
		require(msg.sender == signer);
		_;
	}

	modifier ownerOnly {
		require(msg.sender == owner);
		_;
	}

	constructor() public {
		signer = msg.sender;
		feeCollector = msg.sender;
		owner = msg.sender;
  	timelock = 100000;
  	airdropAccountAddress = msg.sender;
	}

	function setAirdropStatus(bool _status) public ownerOnly {
		airdropStatus = _status;
	}

	function setAirdropTokenAddress(address _address) public ownerOnly {
		airdropTokenAddress = _address;
	}

	function setAirdropRatePerEth(uint _ratePerEth) public ownerOnly {
		airdropRatePerEth = _ratePerEth;
	} 

	function changeAirdropAccountAddress(address _address) public ownerOnly {
		airdropAccountAddress = _address;
	}

	function changeFeeCollector(address _feeCollector) public ownerOnly {
		feeCollector = _feeCollector;
	}

	function changeSigner(address _signer) public ownerOnly {
		signer = _signer;
	}

	function changeOwner(address _owner) public ownerOnly {
		owner = _owner;
	}

	function setTimelock(uint _duration) public ownerOnly {
		require(_duration <= 1000000);
		timelock = _duration;
	}

	mapping (address => bool) public useFeeToken;
	uint public feeTokenRatePerEth;
	bool public feeTokenStatus;
	address public feeTokenAddress;

	function setFeeTokenRatePerEth(uint _rate) public ownerOnly {
		feeTokenRatePerEth = _rate;
	}

	function setFeeTokenStatus(bool _status) public ownerOnly {
		feeTokenStatus = _status;
	}

	function setFeeTokenAddress(address _address) public ownerOnly {
		feeTokenAddress = _address;
	}

	function deposit(address _token, uint _amount) public payable {
		lastActivity[msg.sender] = block.number;
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

	function withdraw(address _token, uint _amount, address _account, uint _nonce, uint8 v, bytes32 r, bytes32 s, uint _fee) public signerOnly {
		lastActivity[msg.sender] = block.number;
		bytes32 hash = keccak256(abi.encodePacked(this, _token, _amount, _account, _nonce));
		require(!withdrawn[hash]);
		withdrawn[hash] = true;
		require(recover(hash, v, r, s) == msg.sender);
		require(balances[_token][msg.sender] >= _amount);
    balances[_token][msg.sender] = balances[_token][msg.sender].sub(_amount);
    if (_fee > 50 finney) _fee = 50 finney;
    _fee = (_fee.mul(_amount)).div(1 ether);
    balances[_token][feeCollector] = balances[_token][feeCollector].add(_fee);
    _amount = _amount.sub(_fee);
    if (_token == 0) {
      require(msg.sender.send(_amount));
    } else {
      require(StandardToken(_token).transfer(msg.sender, _amount));
    }
    emit Withdraw(_token, msg.sender, _amount, balances[_token][msg.sender]);
	}

	function withdrawEmergency(address _token, uint _amount) public {
		require(block.number.sub(lastActivity[msg.sender]) > timelock);
		lastActivity[msg.sender] = block.number;
		require(balances[_token][msg.sender] >= _amount);
    balances[_token][msg.sender] = balances[_token][msg.sender].sub(_amount);
    if (_token == 0) {
      require(msg.sender.send(_amount));
    } else {
      require(StandardToken(_token).transfer(msg.sender, _amount));
    }
    emit Withdraw(_token, msg.sender, _amount, balances[_token][msg.sender]);
	}

	function trade(address[] _addresses, uint[] _uints, uint8[] v, bytes32[] rs) public signerOnly {
		/*
			_addresses[0] == maker
			_addresses[1] == taker
			_addresses[2] == giveToken
			_addresses[3] == takeToken
			_uints[0] == giveAmount
			_uints[1] == takeAmount
			_uints[2] == amount
			_uints[3] == makerNonce
			_uints[4] == takerNonce
			_uints[5] == makerFee
			_uints[6] == takerFee
			_uints[7] == expiry
			v[0] == makerV
			v[1] == takerV
			rs[0]..[1] == makerR, makerS
			rs[2]..[3] == takerR, takerS
		*/
		lastActivity[_addresses[0]] = block.number;
		lastActivity[_addresses[1]] = block.number;
		bytes32 orderHash = keccak256(abi.encodePacked(this, _addresses[0], _addresses[2], _uints[0], _addresses[3], _uints[1], _uints[3], _uints[7]));
		require(recover(orderHash, v[0], rs[0], rs[1]) == _addresses[0]);
		bytes32 tradeHash = keccak256(abi.encodePacked(this, orderHash, _addresses[1], _uints[2], _uints[4]));
		require(recover(tradeHash, v[1], rs[2], rs[3]) == _addresses[1]);
		require(!traded[tradeHash]);
		traded[tradeHash] = true;
		if (_uints[5] > 5 finney) _uints[5] = 5 finney;
		if (_uints[6] > 5 finney) _uints[6] = 5 finney;
		require(balances[_addresses[2]][_addresses[0]] >= _uints[2]);
		require(balances[_addresses[3]][_addresses[1]] >= (_uints[1].div(_uints[0])).mul(_uints[2]));
		require(orderFills[orderHash].add(_uints[2]) <= _uints[0]);
		uint totalTradedAmount = _uints[0];
		if (_addresses[3] == 0) totalTradedAmount = _uints[1];
		uint takerFee = (_uints[6].mul(_uints[2])).div(1 ether);
		if (useFeeToken[_addresses[1]]) {
			if (balances[feeTokenAddress][_addresses[1]] >= totalTradedAmount.mul(feeTokenRatePerEth)) {
				takerFee = 0;
				balances[feeTokenAddress][_addresses[1]] = balances[feeTokenAddress][_addresses[1]].sub(totalTradedAmount.mul(feeTokenRatePerEth));
			}
		}
		balances[_addresses[2]][_addresses[0]] = balances[_addresses[2]][_addresses[0]].sub(_uints[2]);
		balances[_addresses[2]][_addresses[1]] = balances[_addresses[2]][_addresses[1]].add((_uints[2]).sub(takerFee));
		balances[_addresses[2]][feeCollector] = balances[_addresses[2]][feeCollector].add(takerFee);
		uint makerFee = (_uints[5].mul((_uints[1].mul(_uints[2])).div(_uints[0]))).div(1 ether);
		if (useFeeToken[_addresses[0]]) {
			if (balances[feeTokenAddress][_addresses[0]] >= totalTradedAmount.mul(feeTokenRatePerEth)) {
				makerFee = 0;
				balances[feeTokenAddress][_addresses[0]] = balances[feeTokenAddress][_addresses[0]].sub(totalTradedAmount.mul(feeTokenRatePerEth));
			}
		}
		balances[_addresses[3]][_addresses[0]] = balances[_addresses[3]][_addresses[0]].add(((_uints[1].mul(_uints[2])).div(_uints[0])).sub(makerFee));
		balances[_addresses[3]][_addresses[1]] = balances[_addresses[3]][_addresses[1]].sub((_uints[1].mul(_uints[2])).div(_uints[0]));
		balances[_addresses[3]][feeCollector] = balances[_addresses[3]][feeCollector].add(makerFee);
		orderFills[orderHash] = orderFills[orderHash].add(_uints[2]);
		if (airdropStatus) {
			uint airdropAmount = totalTradedAmount.mul(airdropRatePerEth);
			if (balances[airdropTokenAddress][airdropAccountAddress] >= airdropAmount) {
				if (makerFee != 0) {
					balances[airdropTokenAddress][airdropAccountAddress] = balances[airdropTokenAddress][airdropAccountAddress].sub(airdropAmount);
					balances[airdropTokenAddress][_addresses[0]] = balances[airdropTokenAddress][_addresses[0]].add(airdropAmount);
				}
				if (takerFee != 0) {
					balances[airdropTokenAddress][airdropAccountAddress] = balances[airdropTokenAddress][airdropAccountAddress].sub(airdropAmount);
					balances[airdropTokenAddress][_addresses[1]] = balances[airdropTokenAddress][_addresses[1]].add(airdropAmount);
				}
			}
		}
	}

	function recover(bytes32 _hash, uint8 v, bytes32 r, bytes32 s) private pure returns (address) {
    bytes memory prefix = "\x19Ethereum Signed Message:\n32";
    bytes32 hash = keccak256(abi.encodePacked(prefix, _hash));
    return ecrecover(hash, v, r, s);
	}
}

