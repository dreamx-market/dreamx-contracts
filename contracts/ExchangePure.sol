pragma solidity ^0.4.22;

import './lib/ERC20.sol';
import './lib/SafeMath.sol';
import './lib/RedBlackTree.sol';

contract ExchangePure {
	using SafeMath for uint;
	using RedBlackTree for RedBlackTree.Tree;

	enum Fee {
		Maker,
		Taker,
		Withdrawal
	}

	struct Balance {
		uint available;
		uint reserved;
	}

	struct Order {
    address user;
    uint amount;
    uint price;
    bool sell;
    uint timestamp;
    uint next;
    uint prev;
  }

  struct Market {
  	mapping (uint => Order) orderbook;
  	RedBlackTree.Tree prices;
    uint bid;
    uint ask;
    uint firstOrder;
    uint lastOrder;
  }

  uint private lastOrderId;
  address private owner;
  address private feeCollector;
  mapping (address => mapping (address => Balance)) private balances;
  mapping (uint => uint) private fees;
  mapping (address => Market) private markets;

  event Deposit(address indexed token, address indexed user, uint amount, uint balance);
	event Withdraw(address indexed token, address indexed user, uint amount, uint balance);
	event NewOrder(address indexed user, address indexed token, uint indexed id, uint price, uint amount, uint timestamp, bool sell);

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
			balances[0][msg.sender].available = balances[0][msg.sender].available.add(msg.value);
    } else {
			require(msg.value == 0);
			balances[_token][msg.sender].available = balances[_token][msg.sender].available.add(_amount);
			require(ERC20(_token).transferFrom(msg.sender, this, _amount));
    }
    emit Deposit(_token, msg.sender, _amount, balances[_token][msg.sender].available);
	}

	function withdraw(address _token, uint _amount) public {
		require(balances[_token][msg.sender].available >= _amount);
    balances[_token][msg.sender].available = balances[_token][msg.sender].available.sub(_amount);
    uint fee = (fees[uint(Fee.Withdrawal)].mul(_amount)).div(1 ether);
    balances[_token][feeCollector].available = balances[_token][feeCollector].available.add(fee);
    if (_token == 0) {
      require(msg.sender.send(_amount.sub(fee)));
    } else {
      require(ERC20(_token).transfer(msg.sender, _amount.sub(fee)));
    }
    emit Withdraw(_token, msg.sender, _amount, balances[_token][msg.sender].available);
	}

	function getBalance(address _token, address _user) public view returns(uint available, uint reserved) {
		available = balances[_token][_user].available;
    reserved = balances[_token][_user].reserved;
	}

	function createOrder(address _token, uint _amount, uint _price, bool _sell) public {
		require(_token != 0);

		if (_sell) {
			balances[_token][msg.sender].available = balances[_token][msg.sender].available.sub(_amount);
			balances[_token][msg.sender].reserved = balances[_token][msg.sender].reserved.add(_amount);
		} else {
			uint etherAmount = (_price.mul(_amount)).div(1 ether);
			balances[0][msg.sender].available = balances[_token][msg.sender].available.sub(etherAmount);
			balances[0][msg.sender].reserved = balances[_token][msg.sender].reserved.add(etherAmount);
		}

		Order memory order;
		order.user = msg.sender;
		order.amount = _amount;
		order.price = _price;
		order.sell = _sell;
		order.timestamp = now;

		uint id = ++lastOrderId;

		Market storage market = markets[_token];
		market.orderbook[id] = order;

		emit NewOrder(msg.sender, _token, id, _price, _amount, now, _sell);
	}

	// function matchOrder() private {}

	// function trade() private {}

	function getOrder(address _market, uint _orderId) public view returns (address user, uint amount, uint price, bool sell) {
		Order memory order = markets[_market].orderbook[_orderId];
		user = order.user;
		amount = order.amount;
		price = order.price;
		sell = order.sell;
	}

	function getMarketInfo(address _market) public view returns (uint bid, uint ask, uint firstOrder, uint lastOrder) {
		Market memory market = markets[_market];
		bid = market.bid;
		ask = market.ask;
		firstOrder = market.firstOrder;
		lastOrder = market.lastOrder;
	}

	// function cancelOrder() public {}
}

