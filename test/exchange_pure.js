require("dotenv").config();
const Exchange = artifacts.require("ExchangePure");
const Token = artifacts.require("Token");
const name = process.env.TOKEN_NAME;
const symbol = process.env.TOKEN_SYMBOL;
const unitsOneEthCanBuy = process.env.TOKEN_RATE;
const totalSupply = process.env.TOKEN_SUPPLY;
const etherAddress = "0x0000000000000000000000000000000000000000";
const [makerFee, takerFee, withdrawalFee] = [0, 1, 2];
let feeAccount, exchange, token;

contract("ExchangePure", function(accounts) {
	beforeEach(async () => {
		exchange = await Exchange.new();
		feeAccount = accounts[9];
		await exchange.changeFeeCollector(feeAccount);
		token = await Token.new();
		await token.initialize(name, symbol, unitsOneEthCanBuy, totalSupply);
	});

	describe("deposits", () => {
		it("can deposit ether", async () => {
			const depositWatcher = exchange.Deposit();

			await assertExchangeBalance(etherAddress, accounts[0], 0);

			await exchange.deposit(etherAddress, web3.toWei(0.5), {
				value: web3.toWei(0.5)
			});

			await assertExchangeBalance(etherAddress, accounts[0], 0.5);

			const depositEvent = depositWatcher.get()[0].args;
			assert.equal(depositEvent.token, etherAddress);
			assert.equal(depositEvent.user, accounts[0]);
			assert.equal(web3.fromWei(depositEvent.amount.toNumber()), 0.5);
		});

		it("can deposit tokens", async () => {
			const depositWatcher = exchange.Deposit();

			await assertExchangeBalance(token.address, accounts[0], 0);

			await token.approve(exchange.address, web3.toWei(100));
			await exchange.deposit(token.address, web3.toWei(0.5));

			await assertExchangeBalance(token.address, accounts[0], 0.5);

			const depositEvent = depositWatcher.get()[0].args;
			assert.equal(depositEvent.token, token.address);
			assert.equal(depositEvent.user, accounts[0]);
			assert.equal(web3.fromWei(depositEvent.amount.toNumber()), 0.5);
		});
	});

	describe("withdrawals", () => {
		it("can withdraw", async () => {
			await token.transfer(accounts[1], web3.toWei(1));
			const withdrawWatcher = exchange.Withdraw();

			await exchange.changeFee(withdrawalFee, web3.toWei(9999));

			await token.approve(exchange.address, web3.toWei(1), {
				from: accounts[1]
			});
			await exchange.deposit(token.address, web3.toWei(1), {
				from: accounts[1]
			});

			await assertExchangeBalance(token.address, accounts[1], 1);
			await assertExchangeBalance(token.address, feeAccount, 0);

			await exchange.withdraw(token.address, web3.toWei(1), {
				from: accounts[1]
			});

			await assertExchangeBalance(token.address, accounts[1], 0);
			await assertExchangeBalance(token.address, feeAccount, 0.05);
			await assertTokenBalance(accounts[1], 0.95);

			const withdrawEvent = withdrawWatcher.get()[0].args;
			assert.equal(withdrawEvent.token, token.address);
			assert.equal(withdrawEvent.user, accounts[1]);
			assert.equal(web3.fromWei(withdrawEvent.amount.toNumber()), 1);
		});
	});

	describe("orders", () => {
		it("cannot place order without sufficient tokens", async () => {
			const amount = web3.toWei(10);
			const price = web3.toWei(0.3);
			const sell = true;
			await assertFail(
				exchange.createOrder,
				token.address,
				amount,
				price,
				sell,
				{
					from: accounts[1]
				}
			);
		});

		it("cannot place order without sufficient ether", async () => {
			const amount = web3.toWei(5);
			const price = web3.toWei(1);
			const sell = false;
			await assertFail(
				exchange.createOrder,
				token.address,
				amount,
				price,
				sell,
				{
					from: accounts[1]
				}
			);
		});

		it("can place an order", async () => {
			await token.approve(exchange.address, web3.toWei(100));
			await exchange.deposit(token.address, web3.toWei(100));

			const orderWatcher = exchange.NewOrder();

			const amount = web3.toWei(10);
			const price = web3.toWei(0.3);
			const sell = true;

			const orderId = await exchange.createOrder(
				token.address,
				amount,
				price,
				sell
			);

			const orderEvent = orderWatcher.get()[0].args;
			assert.equal(orderEvent.market, token.address);
			assert.equal(orderEvent.user, accounts[0]);
			assert.equal(orderEvent.sell, sell);
			assert.equal(orderEvent.price, price);
			assert.equal(orderEvent.amount, amount);

			const order = await exchange.getOrder(token.address, orderEvent.id);
			assert.equal(order[0], accounts[0]);
			assert.equal(order[1].toNumber(), amount);
			assert.equal(order[2].toNumber(), price);
			assert.equal(order[5], sell);
		});

		it("can cancel orders and preserve the order chain", async () => {
			await token.approve(exchange.address, web3.toWei(100));
			await exchange.deposit(token.address, web3.toWei(100));

			await exchange.createOrder(
				token.address,
				web3.toWei(1),
				web3.toWei(1),
				true
			);
			await exchange.createOrder(
				token.address,
				web3.toWei(1),
				web3.toWei(1.2),
				true
			);
			await exchange.createOrder(
				token.address,
				web3.toWei(1),
				web3.toWei(1.1),
				true
			);
			await exchange.createOrder(
				token.address,
				web3.toWei(1),
				web3.toWei(0.9),
				true
			);
			await exchange.createOrder(
				token.address,
				web3.toWei(1),
				web3.toWei(1.05),
				true
			);
			await assertExchangeBalance(token.address, accounts[0], 95);

			let order1, order2, order3, order4, order5;
			order1 = await exchange.getOrder(token.address, 1);
			order2 = await exchange.getOrder(token.address, 2);
			order3 = await exchange.getOrder(token.address, 3);
			order4 = await exchange.getOrder(token.address, 4);
			order5 = await exchange.getOrder(token.address, 5);

			assert.equal(order1[3].toNumber(), 5);
			assert.equal(order1[4].toNumber(), 4);

			assert.equal(order2[3].toNumber(), 0);
			assert.equal(order2[4].toNumber(), 3);

			assert.equal(order3[0], accounts[0]);
			assert.equal(order3[3].toNumber(), 2);
			assert.equal(order3[4].toNumber(), 5);

			assert.equal(order4[3].toNumber(), 1);
			assert.equal(order4[4].toNumber(), 0);

			assert.equal(order5[3].toNumber(), 3);
			assert.equal(order5[4].toNumber(), 1);

			await exchange.cancelOrder(token.address, 3);
			await assertExchangeBalance(token.address, accounts[0], 96);

			order1 = await exchange.getOrder(token.address, 1);
			order2 = await exchange.getOrder(token.address, 2);
			order3 = await exchange.getOrder(token.address, 3);
			order4 = await exchange.getOrder(token.address, 4);
			order5 = await exchange.getOrder(token.address, 5);

			assert.equal(order1[3].toNumber(), 5);
			assert.equal(order1[4].toNumber(), 4);

			assert.equal(order2[3].toNumber(), 0);
			assert.equal(order2[4].toNumber(), 5);

			assert.equal(order3[0], etherAddress);
			assert.equal(order3[3].toNumber(), 0);
			assert.equal(order3[4].toNumber(), 0);

			assert.equal(order4[3].toNumber(), 1);
			assert.equal(order4[4].toNumber(), 0);

			assert.equal(order5[3].toNumber(), 2);
			assert.equal(order5[4].toNumber(), 1);
		});

		it("should refund ether on cancelling buy orders", async () => {
			await assertExchangeBalance(etherAddress, accounts[0], 0);

			await exchange.deposit(etherAddress, web3.toWei(0.5), {
				value: web3.toWei(0.5)
			});
			await assertExchangeBalance(etherAddress, accounts[0], 0.5);

			await exchange.createOrder(
				token.address,
				web3.toWei(1),
				web3.toWei(0.2),
				false
			);
			await assertExchangeBalance(etherAddress, accounts[0], 0.3);

			await exchange.cancelOrder(token.address, 1);
			await assertExchangeBalance(etherAddress, accounts[0], 0.5);
		});

		it("orders are sorted correctly", async () => {
			const orderWatcher = exchange.NewOrder();

			await populateOrders(accounts);

			const order1 = await exchange.getOrder(token.address, 1);
			const order2 = await exchange.getOrder(token.address, 2);
			const order3 = await exchange.getOrder(token.address, 3);
			const order4 = await exchange.getOrder(token.address, 4);
			const order5 = await exchange.getOrder(token.address, 5);
			const order6 = await exchange.getOrder(token.address, 6);
			const order7 = await exchange.getOrder(token.address, 7);
			const order8 = await exchange.getOrder(token.address, 8);
			const order9 = await exchange.getOrder(token.address, 9);
			const order10 = await exchange.getOrder(token.address, 10);

			assert.equal(order1[3].toNumber(), 5);
			assert.equal(order1[4].toNumber(), 4); // sell: 1

			assert.equal(order2[3].toNumber(), 0);
			assert.equal(order2[4].toNumber(), 3); // sell: 1.2

			assert.equal(order3[3].toNumber(), 2);
			assert.equal(order3[4].toNumber(), 5); // sell: 1.1

			assert.equal(order4[3].toNumber(), 1);
			assert.equal(order4[4].toNumber(), 9); // sell: 0.9

			assert.equal(order5[3].toNumber(), 3);
			assert.equal(order5[4].toNumber(), 1); // sell: 1.05

			assert.equal(order6[3].toNumber(), 7);
			assert.equal(order6[4].toNumber(), 8); // buy: 0.56

			assert.equal(order7[3].toNumber(), 10);
			assert.equal(order7[4].toNumber(), 6); // buy: 0.6

			assert.equal(order8[3].toNumber(), 6);
			assert.equal(order8[4].toNumber(), 0); // buy: 0.5

			assert.equal(order9[3].toNumber(), 4);
			assert.equal(order9[4].toNumber(), 10); // buy:  0.8

			assert.equal(order10[3].toNumber(), 9);
			assert.equal(order10[4].toNumber(), 7); // buy:  0.7

			await assertMarket(token.address, 4, 9);
		});
	});

	describe("trading", () => {
		beforeEach(async () => {
			await assertExchangeBalance(token.address, feeAccount, 0);
			await assertExchangeBalance(etherAddress, feeAccount, 0);
			await exchange.changeFee(makerFee, web3.toWei(9999));
			await exchange.changeFee(takerFee, web3.toWei(9999));
			await populateOrders(accounts);
		});

		it("cannot create sell orders without sufficient funds", async () => {
			await assertExchangeBalance(token.address, accounts[5], 0);

			await assertFail(
				exchange.createOrder,
				token.address,
				web3.toWei(10),
				web3.toWei(10),
				true,
				{
					from: accounts[5]
				}
			);

			const order = await exchange.getOrder(token.address, 11);
			assert.equal(order[0], etherAddress);
		});

		it("cannot create buy orders without sufficient funds", async () => {
			await assertExchangeBalance(etherAddress, accounts[5], 0);

			await assertFail(
				exchange.createOrder,
				token.address,
				web3.toWei(10),
				web3.toWei(10),
				false,
				{
					from: accounts[5]
				}
			);

			const order = await exchange.getOrder(token.address, 11);
			assert.equal(order[0], etherAddress);
		});

		it("should match a sell order", async () => {
			const tradeWatcher = exchange.Trade();

			let market = await exchange.getMarketInfo(token.address);

			assert.equal(market[0].toNumber(), 4);
			assert.equal(market[1].toNumber(), 9);

			await exchange.deposit(etherAddress, web3.toWei(10), {
				value: web3.toWei(10),
				from: accounts[1]
			});

			await exchange.createOrder(
				token.address,
				web3.toWei(3),
				web3.toWei(0.9),
				false,
				{
					from: accounts[1]
				}
			);

			const tradeEvent = tradeWatcher.get()[0].args;
			assert.equal(tradeEvent.token, token.address);
			assert.equal(tradeEvent.bid.toNumber(), 11);
			assert.equal(tradeEvent.ask.toNumber(), 4);
			assert.equal(web3.fromWei(tradeEvent.price.toNumber()), 0.9);
			assert.equal(web3.fromWei(tradeEvent.amount.toNumber()), 1);
			assert.equal(tradeEvent.sell, false);

			const order = await exchange.getOrder(token.address, 11);
			assert.equal(order[0], accounts[1]);
			assert.equal(order[3].toNumber(), 1);
			assert.equal(order[4].toNumber(), 9);

			await assertExchangeBalance(etherAddress, accounts[0], 0.855);
			await assertExchangeBalance(token.address, accounts[1], 0.95);
			await assertExchangeBalance(token.address, feeAccount, 0.05);
			await assertExchangeBalance(etherAddress, feeAccount, 0.045);

			market = await exchange.getMarketInfo(token.address);
			assert.equal(market[0].toNumber(), 1);
			assert.equal(market[1].toNumber(), 11);
		});

		it("should match a buy order", async () => {
			const tradeWatcher = exchange.Trade();

			await token.transfer(accounts[1], web3.toWei(10));
			await token.approve(exchange.address, web3.toWei(10), {
				from: accounts[1]
			});
			await exchange.deposit(token.address, web3.toWei(10), {
				from: accounts[1]
			});

			await exchange.createOrder(
				token.address,
				web3.toWei(3),
				web3.toWei(0.8),
				true,
				{
					from: accounts[1]
				}
			);

			const tradeEvent = tradeWatcher.get()[0].args;
			assert.equal(tradeEvent.token, token.address);
			assert.equal(tradeEvent.bid.toNumber(), 11);
			assert.equal(tradeEvent.ask.toNumber(), 9);
			assert.equal(web3.fromWei(tradeEvent.price.toNumber()), 0.8);
			assert.equal(web3.fromWei(tradeEvent.amount.toNumber()), 1);
			assert.equal(tradeEvent.sell, true);

			const order = await exchange.getOrder(token.address, 11);
			assert.equal(order[0], accounts[1]);
			assert.equal(order[3].toNumber(), 4);
			assert.equal(order[4].toNumber(), 10);

			await assertExchangeBalance(etherAddress, accounts[1], 0.76);
			await assertExchangeBalance(token.address, accounts[2], 0.95);
			await assertExchangeBalance(token.address, feeAccount, 0.05);
			await assertExchangeBalance(etherAddress, feeAccount, 0.04);
		});

		it("should match multiple sell orders", async () => {
			const tradeWatcher = exchange.Trade();

			await assertMarket(token.address, 4, 9);

			await exchange.deposit(etherAddress, web3.toWei(10), {
				value: web3.toWei(10),
				from: accounts[1]
			});

			await exchange.createOrder(
				token.address,
				web3.toWei(2.5),
				web3.toWei(4),
				false,
				{
					from: accounts[1]
				}
			);

			const order = await exchange.getOrder(token.address, 11);
			const order1 = await exchange.getOrder(token.address, 1);
			const order4 = await exchange.getOrder(token.address, 4);
			const order5 = await exchange.getOrder(token.address, 5);
			assert.equal(order[0], etherAddress);
			assert.equal(order1[0], etherAddress);
			assert.equal(order4[0], etherAddress);
			assert.equal(order5[0], accounts[0]);
			assert.equal(web3.fromWei(order5[1].toNumber()), 0.5);
			assert.equal(web3.fromWei(order5[2].toNumber()), 1.05);
			assert.equal(order5[3].toNumber(), 3);
			assert.equal(order5[4].toNumber(), 9);

			await assertMarket(token.address, 5, 9);

			await assertExchangeBalance(etherAddress, accounts[0], 2.30375);
			await assertExchangeBalance(token.address, accounts[1], 2.375);
			await assertReserveBalance(etherAddress, accounts[1], 0);
			await assertReserveBalance(token.address, accounts[1], 0);
			await assertExchangeBalance(etherAddress, accounts[1], 7.575);
			await assertExchangeBalance(token.address, feeAccount, 0.125);
			await assertExchangeBalance(etherAddress, feeAccount, 0.12125);
		});

		it("should match multiple buy orders", async () => {
			const tradeWatcher = exchange.Trade();

			await assertMarket(token.address, 4, 9);

			await token.transfer(accounts[1], web3.toWei(10));
			await token.approve(exchange.address, web3.toWei(10), {
				from: accounts[1]
			});
			await exchange.deposit(token.address, web3.toWei(10), {
				from: accounts[1]
			});

			await exchange.createOrder(
				token.address,
				web3.toWei(3.5),
				web3.toWei(0),
				true,
				{
					from: accounts[1]
				}
			);

			const order = await exchange.getOrder(token.address, 11);
			const order10 = await exchange.getOrder(token.address, 10);
			const order9 = await exchange.getOrder(token.address, 9);
			const order7 = await exchange.getOrder(token.address, 7);
			const order6 = await exchange.getOrder(token.address, 6);
			assert.equal(order[0], etherAddress);
			assert.equal(order10[0], etherAddress);
			assert.equal(order9[0], etherAddress);
			assert.equal(order7[0], etherAddress);
			assert.equal(order6[0], accounts[2]);
			assert.equal(web3.fromWei(order6[1].toNumber()), 0.5);
			assert.equal(web3.fromWei(order6[2].toNumber()), 0.56);
			assert.equal(order6[3].toNumber(), 4);
			assert.equal(order6[4].toNumber(), 8);

			await assertMarket(token.address, 4, 6);

			await assertExchangeBalance(token.address, accounts[2], 3.325);
			await assertExchangeBalance(etherAddress, accounts[1], 2.261);
			await assertReserveBalance(etherAddress, accounts[1], 0);
			await assertReserveBalance(token.address, accounts[1], 0);
			await assertExchangeBalance(token.address, feeAccount, 0.175);
			await assertExchangeBalance(etherAddress, feeAccount, 0.119);
		});

		it("ignore orders with 0 volume", async () => {
			await assertMarket(token.address, 4, 9);

			await exchange.deposit(etherAddress, web3.toWei(10), {
				value: web3.toWei(10),
				from: accounts[1]
			});

			await exchange.createOrder(
				token.address,
				web3.toWei(0),
				web3.toWei(3),
				false,
				{
					from: accounts[1]
				}
			);

			const order = await exchange.getOrder(token.address, 11);
			assert.equal(order[0], etherAddress);

			await assertMarket(token.address, 4, 9);
		});

		it("should match multiple sell orders and place a rest order", async () => {
			const tradeWatcher = exchange.Trade();

			await assertMarket(token.address, 4, 9);

			await exchange.deposit(etherAddress, web3.toWei(10), {
				value: web3.toWei(10),
				from: accounts[1]
			});

			await exchange.createOrder(
				token.address,
				web3.toWei(5),
				web3.toWei(1.05),
				false,
				{
					from: accounts[1]
				}
			);

			const order = await exchange.getOrder(token.address, 11);
			const order1 = await exchange.getOrder(token.address, 1);
			const order4 = await exchange.getOrder(token.address, 4);
			const order5 = await exchange.getOrder(token.address, 5);
			assert.equal(order[0], accounts[1]);
			assert.equal(order1[0], etherAddress);
			assert.equal(order4[0], etherAddress);
			assert.equal(order5[0], etherAddress);
			assert.equal(web3.fromWei(order[1].toNumber()), 2);
			assert.equal(web3.fromWei(order[2].toNumber()), 1.05);
			assert.equal(order[3].toNumber(), 3);
			assert.equal(order[4].toNumber(), 9);

			await assertMarket(token.address, 3, 11);

			await assertExchangeBalance(etherAddress, accounts[0], 2.8025);
			await assertExchangeBalance(token.address, accounts[1], 2.85);
			await assertReserveBalance(etherAddress, accounts[1], 2.1);
			await assertReserveBalance(token.address, accounts[1], 0);
			await assertExchangeBalance(etherAddress, accounts[1], 4.95);
			await assertExchangeBalance(token.address, feeAccount, 0.15);
			await assertExchangeBalance(etherAddress, feeAccount, 0.1475);
		});

		it("should match multiple buy orders and place a rest order", async () => {
			const tradeWatcher = exchange.Trade();

			await assertMarket(token.address, 4, 9);

			await token.transfer(accounts[1], web3.toWei(10));
			await token.approve(exchange.address, web3.toWei(10), {
				from: accounts[1]
			});
			await exchange.deposit(token.address, web3.toWei(10), {
				from: accounts[1]
			});

			await exchange.createOrder(
				token.address,
				web3.toWei(5),
				web3.toWei(0.6),
				true,
				{
					from: accounts[1]
				}
			);

			const order = await exchange.getOrder(token.address, 11);
			const order10 = await exchange.getOrder(token.address, 10);
			const order9 = await exchange.getOrder(token.address, 9);
			const order7 = await exchange.getOrder(token.address, 7);
			assert.equal(order[0], accounts[1]);
			assert.equal(order10[0], etherAddress);
			assert.equal(order9[0], etherAddress);
			assert.equal(order7[0], etherAddress);
			assert.equal(web3.fromWei(order[1].toNumber()), 2);
			assert.equal(web3.fromWei(order[2].toNumber()), 0.6);
			assert.equal(order[3].toNumber(), 4);
			assert.equal(order[4].toNumber(), 6);

			await assertMarket(token.address, 11, 6);

			await assertExchangeBalance(token.address, accounts[2], 2.85);
			await assertExchangeBalance(etherAddress, accounts[1], 1.995);
			await assertReserveBalance(etherAddress, accounts[1], 0);
			await assertReserveBalance(token.address, accounts[1], 2);
			await assertExchangeBalance(token.address, feeAccount, 0.15);
			await assertExchangeBalance(etherAddress, feeAccount, 0.105);
		});
	});
});

assertMarket = async (market, bid, ask) => {
	const marketInfo = await exchange.getMarketInfo(market);
	assert.equal(marketInfo[0].toNumber(), bid);
	assert.equal(marketInfo[1].toNumber(), ask);
};

assertTokenBalance = async (account, value) => {
	const balance = web3.fromWei((await token.balanceOf(account)).toNumber());
	assert.equal(balance, value);
};

assertExchangeBalance = async (token, account, expectedBalance) => {
	const balances = await exchange.getBalance.call(token, account);
	const balance = web3.fromWei(balances[0].toNumber());
	assert.equal(balance, expectedBalance);
};

assertReserveBalance = async (token, account, expectedBalance) => {
	const balances = await exchange.getBalance.call(token, account);
	const reserve = web3.fromWei(balances[1].toNumber());
	assert.equal(reserve, expectedBalance);
};

assertExchangeBalanceAtLeast = async (token, account, expectedBalance) => {
	const balances = await exchange.getBalance.call(token, account);
	const balance = web3.fromWei(balances[0].toNumber());
	assert.isAtLeast(balance, expectedBalance);
};

assertFail = async (fn, ...args) => {
	try {
		assert.fail(await fn(...args));
	} catch (err) {
		assert.equal(
			err.message,
			"VM Exception while processing transaction: revert"
		);
	}
};

populateOrders = async accounts => {
	await token.approve(exchange.address, web3.toWei(100));
	await exchange.deposit(token.address, web3.toWei(100));
	await exchange.deposit(etherAddress, web3.toWei(10), {
		value: web3.toWei(10),
		from: accounts[2]
	});

	await exchange.createOrder(token.address, web3.toWei(1), web3.toWei(1), true);
	await exchange.createOrder(
		token.address,
		web3.toWei(1),
		web3.toWei(1.2),
		true
	);
	await exchange.createOrder(
		token.address,
		web3.toWei(1),
		web3.toWei(1.1),
		true
	);
	await exchange.createOrder(
		token.address,
		web3.toWei(1),
		web3.toWei(0.9),
		true
	);
	await exchange.createOrder(
		token.address,
		web3.toWei(1),
		web3.toWei(1.05),
		true
	);
	await exchange.createOrder(
		token.address,
		web3.toWei(1),
		web3.toWei(0.56),
		false,
		{
			from: accounts[2]
		}
	);
	await exchange.createOrder(
		token.address,
		web3.toWei(1),
		web3.toWei(0.6),
		false,
		{
			from: accounts[2]
		}
	);
	await exchange.createOrder(
		token.address,
		web3.toWei(1),
		web3.toWei(0.5),
		false,
		{
			from: accounts[2]
		}
	);
	await exchange.createOrder(
		token.address,
		web3.toWei(1),
		web3.toWei(0.8),
		false,
		{
			from: accounts[2]
		}
	);
	await exchange.createOrder(
		token.address,
		web3.toWei(1),
		web3.toWei(0.7),
		false,
		{
			from: accounts[2]
		}
	);
};
