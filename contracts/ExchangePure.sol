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
    uint64 next;
    uint64 prev;
  }

  struct Market {
  	mapping (uint64 => Order) orderbook;
  	RedBlackTree.Tree priceTree;
    uint64 bid;
    uint64 ask;
  }

  uint64 private lastId;
  address private owner;
  address private feeCollector;
  mapping (address => mapping (address => Balance)) private balances;
  mapping (uint => uint) private fees;
  mapping (address => Market) private markets;

  event Deposit(address indexed token, address indexed user, uint amount, uint balance);
	event Withdraw(address indexed token, address indexed user, uint amount, uint balance);
	event NewOrder(address indexed user, address indexed market, uint64 indexed id, uint price, uint amount, uint timestamp, bool sell);
	event Ask(address indexed token, uint price);
  event Bid(address indexed token, uint price);
  event Trade(address indexed token, uint64 indexed bid, uint64 indexed ask, uint price, uint amount, uint timestamp, bool sell);

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

	function createOrder(address _marketAddress, uint _amount, uint _price, bool _sell) public {
		require(_marketAddress != 0);

		if (_sell) {
			balances[_marketAddress][msg.sender].available = balances[_marketAddress][msg.sender].available.sub(_amount);
			balances[_marketAddress][msg.sender].reserved = balances[_marketAddress][msg.sender].reserved.add(_amount);
		} else {
			uint etherAmount = (_price.mul(_amount)).div(1 ether);
			balances[0][msg.sender].available = balances[0][msg.sender].available.sub(etherAmount);
			balances[0][msg.sender].reserved = balances[0][msg.sender].reserved.add(etherAmount);
		}

		Market storage market = markets[_marketAddress];
		Order memory order;
		order.user = msg.sender;
		order.amount = _amount;
		order.price = _price;
		order.sell = _sell;
		order.timestamp = now;

		uint64 orderId = ++lastId;

		uint64 parentId = market.priceTree.find(order.price);
		Order storage parent = market.orderbook[parentId];
		Order storage parentPrev = market.orderbook[parent.prev];
		Order storage parentNext = market.orderbook[parent.next];

		// matchOrder(_marketAddress, market, order, orderId);

		if (order.amount != 0) {
			if (parentId != 0) {
				if (_price >= parent.price) {
					order.next = parent.next;
					order.prev = parentId;
					parent.next = orderId;
					parentNext.prev = orderId;
				} else {
					order.next = parentId;
					order.prev = parent.prev;
					parent.prev = orderId;
					parentPrev.next = orderId;
				}
			} else {
				order.next = 0;
				order.prev = 0;
			}

			if ((order.sell && market.bid == 0) || (order.sell && order.price < market.orderbook[market.bid].price)) {
				market.bid = orderId;
				emit Bid(_marketAddress, _price);
			}

			if ((!order.sell && market.ask == 0) || (!order.sell && order.price > market.orderbook[market.ask].price)) {
				market.ask = orderId;
				emit Ask(_marketAddress, _price);
			}

			market.priceTree.placeAfter(parentId, orderId, order.price);
			market.orderbook[orderId] = order;
			emit NewOrder(msg.sender, _marketAddress, orderId, _price, _amount, now, _sell);
		}
	}

	function matchOrder(address _marketAddress, Market storage market, Order memory order, uint64 orderId) private {
		uint64 matchedId;
		if (order.sell) {
			matchedId = market.ask;
		} else {
			matchedId = market.bid;
		}

		// if (order.sell) {
		// 	while (matchedId != 0 && order.amount != 0 && order.price <= market.orderbook[matchedId].price) {
		// 		// determine the order to be filled/ fill the orders
		// 		// trade the balances
		// 		// emit a trade event
		// 		// remove the filled order
		// 	}
		// 	if (market.ask != matchedId) {
  //       market.ask = matchedId;
  //       emit Ask(_marketAddress, matchedOrder.price);
  //   	}
		// } else {
		if (!order.sell) {	
			while (matchedId != 0 && order.amount != 0 && order.price <= market.orderbook[matchedId].price) {
				Order storage matchedOrder = market.orderbook[matchedId];

				uint tradeAmountInTokens;
				if (order.amount >= matchedOrder.amount) {
					tradeAmountInTokens = matchedOrder.amount;
				} else {
					tradeAmountInTokens = order.amount;
				}
				uint tradeAmountInEther = (tradeAmountInTokens.mul(matchedOrder.price)).div(1 ether);
				order.amount = order.amount.sub(tradeAmountInTokens);
				matchedOrder.amount = matchedOrder.amount.sub(tradeAmountInTokens);

				uint makerFee = (fees[uint(Fee.Maker)].mul(tradeAmountInEther)).div(1 ether);
				uint takerFee = (fees[uint(Fee.Taker)].mul(tradeAmountInTokens)).div(1 ether);
				balances[_marketAddress][matchedOrder.user].reserved = balances[_marketAddress][matchedOrder.user].reserved.sub(tradeAmountInTokens);
				balances[0][matchedOrder.user].available = balances[0][matchedOrder.user].available.add(tradeAmountInEther.sub(makerFee));
				balances[0][order.user].reserved = balances[0][order.user].reserved.sub(tradeAmountInEther);
				balances[_marketAddress][order.user].available = balances[_marketAddress][order.user].available.add(tradeAmountInTokens.sub(takerFee));
				balances[_marketAddress][feeCollector].available = balances[_marketAddress][feeCollector].available.add(takerFee);
				balances[0][feeCollector].available = balances[0][feeCollector].available.add(makerFee);

				emit Trade(_marketAddress, orderId, matchedId, matchedOrder.price, tradeAmountInTokens, now, order.sell);

				if (matchedOrder.amount != 0) {
					break;
				}

				Order memory removed = remove(market, matchedOrder, matchedId);
				matchedId = removed.next;
			}

			if (market.bid != matchedId) {
        market.bid = matchedId;
        emit Bid(_marketAddress, market.orderbook[matchedId].price);
    	}
		}
	}

	function cancelOrder(address _marketAddress, uint64 _orderId) public {
		require(_marketAddress != 0);
		Market storage market = markets[_marketAddress];
		Order storage order = market.orderbook[_orderId];
		require(order.user == msg.sender);

		if (order.sell) {
			balances[_marketAddress][msg.sender].available = balances[_marketAddress][msg.sender].available.add(order.amount);
			balances[_marketAddress][msg.sender].reserved = balances[_marketAddress][msg.sender].reserved.sub(order.amount);
		} else {
			uint etherAmount = (order.price.mul(order.amount)).div(1 ether);
			balances[0][msg.sender].available = balances[0][msg.sender].available.add(etherAmount);
			balances[0][msg.sender].reserved = balances[0][msg.sender].reserved.sub(etherAmount);
		}

		remove(market, order, _orderId);
	}

	function remove(Market storage market, Order storage order, uint64 _orderId) private returns (Order) {
		Order storage next = market.orderbook[order.next];
		Order storage prev = market.orderbook[order.prev];
		next.prev = order.prev;
		prev.next = order.next;		
		market.priceTree.remove(_orderId);
		delete market.orderbook[_orderId];
		return order;
	}

	function getOrder(address _marketAddress, uint64 _orderId) public view returns (address user, uint amount, uint price, uint64 next, uint64 prev, bool sell) {
		require(_marketAddress != 0);
		Order memory order = markets[_marketAddress].orderbook[_orderId];
		user = order.user;
		amount = order.amount;
		price = order.price;
		next = order.next;
		prev = order.prev;
		sell = order.sell;
	}

	function getMarketInfo(address _marketAddress) public view returns (uint64 bid, uint64 ask) {
		require(_marketAddress != 0);
		Market memory market = markets[_marketAddress];
		bid = market.bid;
		ask = market.ask;
	}
}

