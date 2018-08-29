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
		it("can place an order", async () => {
			const orderWatcher = exchange.NewOrder()

			const token = token.address;
			const amount = web3.toWei(10);
			const price = web3.toWei(0.3);
			const sell = true;

			const orderId = await exchange.placeOrder(token, amount, price, sell);

			const order = await exchange.getOrder(orderId);
			assert.equal(order.id, id);
			assert.equal(order.amount, amount);
			assert.equal(order.price, price);
			assert.equal(order.sell, sell);

			const orderEvent = orderWatcher.get()[0].args
			assert.equal(orderEvent.token, token)
			assert.equal(orderEvent.owner, accounts[0])
			assert.equal(orderEvent.id, id)
			assert.equal(orderEvent.sell, sell)
			assert.equal(orderEvent.price, price)
			assert.equal(orderEvent.amount, amount)
			assert.equal(orderEvent.timestamp, timestamp)
		});
		});
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
