require("dotenv").config();
const Exchange = artifacts.require("ExchangePure");
const Token = artifacts.require("Token");
const name = process.env.TOKEN_NAME;
const symbol = process.env.TOKEN_SYMBOL;
const unitsOneEthCanBuy = process.env.TOKEN_RATE;
const totalSupply = process.env.TOKEN_SUPPLY;
const etherAddress = "0x0000000000000000000000000000000000000000";
const [makerFee, takerFee, withdrawalFee] = [0, 1, 2];

contract("ExchangePure", function(accounts) {
	beforeEach(async () => {
		exchange = await Exchange.new();
		await exchange.changeFeeCollector(accounts[9]);
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
			await assertExchangeBalance(token.address, accounts[9], 0);

			await exchange.withdraw(token.address, web3.toWei(1), {
				from: accounts[1]
			});

			await assertExchangeBalance(token.address, accounts[1], 0);
			await assertExchangeBalance(token.address, accounts[9], 0.05);
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

		it("can cancel orders", async () => {
			await token.approve(exchange.address, web3.toWei(100));
			await exchange.deposit(token.address, web3.toWei(100));
			await exchange.createOrder(token.address, 1, web3.toWei(1), true);

			let order;
			order = await exchange.getOrder(token.address, 1);
			assert.equal(order[0], accounts[0]);

			await exchange.cancelOrder(token.address, 1);

			order = await exchange.getOrder(token.address, 1);
			assert.equal(order[0], "0x0000000000000000000000000000000000000000");
		});

		// it("sell orders are sorted correctly", async () => {
		// 	await token.approve(exchange.address, web3.toWei(100));
		// 	await exchange.deposit(token.address, web3.toWei(100));

		// 	const orderWatcher = exchange.NewOrder();

		// 	await exchange.createOrder(token.address, 1, web3.toWei(1), true);
		// 	await exchange.createOrder(token.address, 1, web3.toWei(1.2), true);
		// 	await exchange.createOrder(token.address, 1, web3.toWei(1.1), true);

		//	const order1 = await exchange.getOrder(token.address, 1);
		// 	const order2 = await exchange.getOrder(token.address, 2);
		// 	const order3 = await exchange.getOrder(token.address, 3);

		// 	assert.equal(order1[4].toNumber(), 0);
		// 	assert.equal(order1[5].toNumber(), 3);
		// 	assert.equal(order2[4].toNumber(), 3);
		// 	assert.equal(order2[5].toNumber(), 0);
		// 	assert.equal(order3[4].toNumber(), 1);
		// 	assert.equal(order3[5].toNumber(), 2);
		// });
	});
});

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
