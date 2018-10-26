pragma solidity ^0.4.24;


/**
 * @title SafeMath
 * @dev Math operations with safety checks that throw on error
 */
library SafeMath {

  /**
  * @dev Multiplies two numbers, throws on overflow.
  */
  function mul(uint256 _a, uint256 _b) internal pure returns (uint256 c) {
    // Gas optimization: this is cheaper than asserting 'a' not being zero, but the
    // benefit is lost if 'b' is also tested.
    // See: https://github.com/OpenZeppelin/openzeppelin-solidity/pull/522
    if (_a == 0) {
      return 0;
    }

    c = _a * _b;
    assert(c / _a == _b);
    return c;
  }

  /**
  * @dev Integer division of two numbers, truncating the quotient.
  */
  function div(uint256 _a, uint256 _b) internal pure returns (uint256) {
    // assert(_b > 0); // Solidity automatically throws when dividing by 0
    // uint256 c = _a / _b;
    // assert(_a == _b * c + _a % _b); // There is no case in which this doesn't hold
    return _a / _b;
  }

  /**
  * @dev Subtracts two numbers, throws on overflow (i.e. if subtrahend is greater than minuend).
  */
  function sub(uint256 _a, uint256 _b) internal pure returns (uint256) {
    assert(_b <= _a);
    return _a - _b;
  }

  /**
  * @dev Adds two numbers, throws on overflow.
  */
  function add(uint256 _a, uint256 _b) internal pure returns (uint256 c) {
    c = _a + _b;
    assert(c >= _a);
    return c;
  }
}



/**
 * @title ERC20Basic
 * @dev Simpler version of ERC20 interface
 * See https://github.com/ethereum/EIPs/issues/179
 */
contract ERC20Basic {
  function totalSupply() public view returns (uint256);
  function balanceOf(address _who) public view returns (uint256);
  function transfer(address _to, uint256 _value) public returns (bool);
  event Transfer(address indexed from, address indexed to, uint256 value);
}












/**
 * @title Basic token
 * @dev Basic version of StandardToken, with no allowances.
 */
contract BasicToken is ERC20Basic {
  using SafeMath for uint256;

  mapping(address => uint256) internal balances;

  uint256 internal totalSupply_;

  /**
  * @dev Total number of tokens in existence
  */
  function totalSupply() public view returns (uint256) {
    return totalSupply_;
  }

  /**
  * @dev Transfer token for a specified address
  * @param _to The address to transfer to.
  * @param _value The amount to be transferred.
  */
  function transfer(address _to, uint256 _value) public returns (bool) {
    require(_value <= balances[msg.sender]);
    require(_to != address(0));

    balances[msg.sender] = balances[msg.sender].sub(_value);
    balances[_to] = balances[_to].add(_value);
    emit Transfer(msg.sender, _to, _value);
    return true;
  }

  /**
  * @dev Gets the balance of the specified address.
  * @param _owner The address to query the the balance of.
  * @return An uint256 representing the amount owned by the passed address.
  */
  function balanceOf(address _owner) public view returns (uint256) {
    return balances[_owner];
  }

}






/**
 * @title ERC20 interface
 * @dev see https://github.com/ethereum/EIPs/issues/20
 */
contract ERC20 is ERC20Basic {
  function allowance(address _owner, address _spender)
    public view returns (uint256);

  function transferFrom(address _from, address _to, uint256 _value)
    public returns (bool);

  function approve(address _spender, uint256 _value) public returns (bool);
  event Approval(
    address indexed owner,
    address indexed spender,
    uint256 value
  );
}



/**
 * @title Standard ERC20 token
 *
 * @dev Implementation of the basic standard token.
 * https://github.com/ethereum/EIPs/issues/20
 * Based on code by FirstBlood: https://github.com/Firstbloodio/token/blob/master/smart_contract/FirstBloodToken.sol
 */
contract StandardToken is ERC20, BasicToken {

  mapping (address => mapping (address => uint256)) internal allowed;


  /**
   * @dev Transfer tokens from one address to another
   * @param _from address The address which you want to send tokens from
   * @param _to address The address which you want to transfer to
   * @param _value uint256 the amount of tokens to be transferred
   */
  function transferFrom(
    address _from,
    address _to,
    uint256 _value
  )
    public
    returns (bool)
  {
    require(_value <= balances[_from]);
    require(_value <= allowed[_from][msg.sender]);
    require(_to != address(0));

    balances[_from] = balances[_from].sub(_value);
    balances[_to] = balances[_to].add(_value);
    allowed[_from][msg.sender] = allowed[_from][msg.sender].sub(_value);
    emit Transfer(_from, _to, _value);
    return true;
  }

  /**
   * @dev Approve the passed address to spend the specified amount of tokens on behalf of msg.sender.
   * Beware that changing an allowance with this method brings the risk that someone may use both the old
   * and the new allowance by unfortunate transaction ordering. One possible solution to mitigate this
   * race condition is to first reduce the spender's allowance to 0 and set the desired value afterwards:
   * https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729
   * @param _spender The address which will spend the funds.
   * @param _value The amount of tokens to be spent.
   */
  function approve(address _spender, uint256 _value) public returns (bool) {
    allowed[msg.sender][_spender] = _value;
    emit Approval(msg.sender, _spender, _value);
    return true;
  }

  /**
   * @dev Function to check the amount of tokens that an owner allowed to a spender.
   * @param _owner address The address which owns the funds.
   * @param _spender address The address which will spend the funds.
   * @return A uint256 specifying the amount of tokens still available for the spender.
   */
  function allowance(
    address _owner,
    address _spender
   )
    public
    view
    returns (uint256)
  {
    return allowed[_owner][_spender];
  }

  /**
   * @dev Increase the amount of tokens that an owner allowed to a spender.
   * approve should be called when allowed[_spender] == 0. To increment
   * allowed value is better to use this function to avoid 2 calls (and wait until
   * the first transaction is mined)
   * From MonolithDAO Token.sol
   * @param _spender The address which will spend the funds.
   * @param _addedValue The amount of tokens to increase the allowance by.
   */
  function increaseApproval(
    address _spender,
    uint256 _addedValue
  )
    public
    returns (bool)
  {
    allowed[msg.sender][_spender] = (
      allowed[msg.sender][_spender].add(_addedValue));
    emit Approval(msg.sender, _spender, allowed[msg.sender][_spender]);
    return true;
  }

  /**
   * @dev Decrease the amount of tokens that an owner allowed to a spender.
   * approve should be called when allowed[_spender] == 0. To decrement
   * allowed value is better to use this function to avoid 2 calls (and wait until
   * the first transaction is mined)
   * From MonolithDAO Token.sol
   * @param _spender The address which will spend the funds.
   * @param _subtractedValue The amount of tokens to decrease the allowance by.
   */
  function decreaseApproval(
    address _spender,
    uint256 _subtractedValue
  )
    public
    returns (bool)
  {
    uint256 oldValue = allowed[msg.sender][_spender];
    if (_subtractedValue >= oldValue) {
      allowed[msg.sender][_spender] = 0;
    } else {
      allowed[msg.sender][_spender] = oldValue.sub(_subtractedValue);
    }
    emit Approval(msg.sender, _spender, allowed[msg.sender][_spender]);
    return true;
  }

}


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
	}

	function changeFeeCollector(address _feeCollector) public ownerOnly {
		feeCollector = _feeCollector;
	}

	function changeSigner(address _signer) public ownerOnly {
		signer = _signer;
	}

	function changeOwner (address _owner) public ownerOnly {
		owner = _owner;
	}

	function setTimelock(uint _duration) public ownerOnly {
		require(_duration <= 1000000);
		timelock = _duration;
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
		uint takerFee = (_uints[6].mul(_uints[2])).div(1 ether);
		balances[_addresses[2]][_addresses[0]] = balances[_addresses[2]][_addresses[0]].sub(_uints[2]);
		balances[_addresses[2]][_addresses[1]] = balances[_addresses[2]][_addresses[1]].add((_uints[2]).sub(takerFee));
		balances[_addresses[2]][feeCollector] = balances[_addresses[2]][feeCollector].add(takerFee);
		uint makerFee = (_uints[5].mul((_uints[1].mul(_uints[2])).div(_uints[0]))).div(1 ether);
		balances[_addresses[3]][_addresses[0]] = balances[_addresses[3]][_addresses[0]].add(((_uints[1].mul(_uints[2])).div(_uints[0])).sub(makerFee));
		balances[_addresses[3]][_addresses[1]] = balances[_addresses[3]][_addresses[1]].sub((_uints[1].mul(_uints[2])).div(_uints[0]));
		balances[_addresses[3]][feeCollector] = balances[_addresses[3]][feeCollector].add(makerFee);
		orderFills[orderHash] = orderFills[orderHash].add(_uints[2]);
	}

	function recover(bytes32 _hash, uint8 v, bytes32 r, bytes32 s) public pure returns (address) {
    bytes memory prefix = "\x19Ethereum Signed Message:\n32";
    bytes32 hash = keccak256(abi.encodePacked(prefix, _hash));
    return ecrecover(hash, v, r, s);
	}
}

