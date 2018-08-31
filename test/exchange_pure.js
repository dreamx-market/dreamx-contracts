require("dotenv").config();
const Exchange = artifacts.require("ExchangePure");
const Token = artifacts.require("Token");
const name = process.env.TOKEN_NAME;
const symbol = process.env.TOKEN_SYMBOL;
const unitsOneEthCanBuy = process.env.TOKEN_RATE;
const totalSupply = process.env.TOKEN_SUPPLY;
const etherAddress = "0x0000000000000000000000000000000000000000";
const [makerFee, takerFee, withdrawalFee] = [0, 1, 2];
let feeAccount;

contract("ExchangePure", function(accounts) {
	beforeEach(async () => {
		exchange = await Exchange.new();
		feeAccount = accounts[9];
		await exchange.changeFeeCollector(feeAccount);
		token = await Token.new(name, symbol, unitsOneEthCanBuy, totalSupply);
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

			assert.equal(order3[0], "0x0000000000000000000000000000000000000000");
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

		it("sell orders are sorted correctly", async () => {
			await token.approve(exchange.address, web3.toWei(100));
			await exchange.deposit(token.address, web3.toWei(100));

			const orderWatcher = exchange.NewOrder();

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

			const order1 = await exchange.getOrder(token.address, 1);
			const order2 = await exchange.getOrder(token.address, 2);
			const order3 = await exchange.getOrder(token.address, 3);
			const order4 = await exchange.getOrder(token.address, 4);
			const order5 = await exchange.getOrder(token.address, 5);

			assert.equal(order1[3].toNumber(), 5);
			assert.equal(order1[4].toNumber(), 4);

			assert.equal(order2[3].toNumber(), 0);
			assert.equal(order2[4].toNumber(), 3);

			assert.equal(order3[3].toNumber(), 2);
			assert.equal(order3[4].toNumber(), 5);

			assert.equal(order4[3].toNumber(), 1);
			assert.equal(order4[4].toNumber(), 0);

			assert.equal(order5[3].toNumber(), 3);
			assert.equal(order5[4].toNumber(), 1);

			await assertMarket(token.address, 4, 0);
		});

		it("buy orders are sorted correctly", async () => {
			await exchange.deposit(etherAddress, web3.toWei(1), {
				value: web3.toWei(1)
			});

			const orderWatcher = exchange.NewOrder();

			await exchange.createOrder(
				token.address,
				web3.toWei(0.1),
				web3.toWei(1),
				false
			);
			await exchange.createOrder(
				token.address,
				web3.toWei(0.1),
				web3.toWei(1.2),
				false
			);
			await exchange.createOrder(
				token.address,
				web3.toWei(0.1),
				web3.toWei(1.1),
				false
			);
			await exchange.createOrder(
				token.address,
				web3.toWei(0.1),
				web3.toWei(0.9),
				false
			);
			await exchange.createOrder(
				token.address,
				web3.toWei(0.1),
				web3.toWei(1.05),
				false
			);

			const order1 = await exchange.getOrder(token.address, 1);
			const order2 = await exchange.getOrder(token.address, 2);
			const order3 = await exchange.getOrder(token.address, 3);
			const order4 = await exchange.getOrder(token.address, 4);
			const order5 = await exchange.getOrder(token.address, 5);

			assert.equal(order1[3].toNumber(), 4);
			assert.equal(order1[4].toNumber(), 5);

			assert.equal(order2[3].toNumber(), 3);
			assert.equal(order2[4].toNumber(), 0);

			assert.equal(order3[3].toNumber(), 5);
			assert.equal(order3[4].toNumber(), 2);

			assert.equal(order4[3].toNumber(), 0);
			assert.equal(order4[4].toNumber(), 1);

			assert.equal(order5[3].toNumber(), 1);
			assert.equal(order5[4].toNumber(), 3);

			await assertMarket(token.address, 0, 2);
		});
	});

	describe("trading", () => {
		beforeEach(async () => {
			await token.approve(exchange.address, web3.toWei(100));
			await exchange.deposit(token.address, web3.toWei(100));

			await assertExchangeBalance(token.address, feeAccount, 0);
			await assertExchangeBalance(etherAddress, feeAccount, 0);
			await exchange.changeFee(makerFee, web3.toWei(9999));
			await exchange.changeFee(takerFee, web3.toWei(9999));

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
		});

		it.only("should match a sell order", async () => {
			const tradeWatcher = exchange.Trade();

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
			assert.equal(tradeEvent.bid.toNumber(), 6);
			assert.equal(tradeEvent.ask.toNumber(), 4);
			assert.equal(web3.fromWei(tradeEvent.price.toNumber()), 0.9);
			assert.equal(web3.fromWei(tradeEvent.amount.toNumber()), 1);
			assert.equal(tradeEvent.sell, false);

			const order = await exchange.getOrder(token.address, 6);
			assert.equal(order[0], accounts[1]);

			await assertExchangeBalance(etherAddress, accounts[0], 0.855);
			await assertExchangeBalance(token.address, accounts[1], 0.95);
			await assertExchangeBalance(token.address, feeAccount, 0.05);
			await assertExchangeBalance(etherAddress, feeAccount, 0.045);
		});

		// it("should match a buy order", async () => {});

		// it('should match multiple sell orders', async () => {
		// 	await exchange.deposit(etherAddress, web3.toWei(10), {
		// 		value: web3.toWei(10),
		// 		from: accounts[1]
		// 	});

		// 	await exchange.createOrder(
		// 		token.address,
		// 		web3.toWei(3),
		// 		web3.toWei(1.05),
		// 		true
		// 	)
		// })

		// it("should match multiple buy orders", async () => {});
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
