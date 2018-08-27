require("dotenv").config();
const Exchange = artifacts.require("ExchangePure");
const Token = artifacts.require("Token");
const name = process.env.TOKEN_NAME;
const symbol = process.env.TOKEN_SYMBOL;
const unitsOneEthCanBuy = process.env.TOKEN_RATE;
const totalSupply = process.env.TOKEN_SUPPLY;
const etherAddress = "0x0000000000000000000000000000000000000000";

contract("ExchangePure", function(accounts) {
	beforeEach(async () => {
		exchange = await Exchange.new();
		await exchange.changeFeeCollector(accounts[9]);
		token = await Token.new(name, symbol, unitsOneEthCanBuy, totalSupply);
	});

	describe("deposit", () => {
		it("can deposit ether", async () => {
			const depositWatcher = exchange.Deposit();

			await assertExchangeBalance(etherAddress, accounts[0], 0);

			await exchange.deposit(etherAddress, web3.toWei(0.5), {
				value: web3.toWei(0.5)
			});

			await assertExchangeBalance(etherAddress, accounts[0], 0.5);

			const depositEvent = depositWatcher.get()[0].args;
			assert.equal(depositEvent.token, etherAddress);
			assert.equal(depositEvent.account, accounts[0]);
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
			assert.equal(depositEvent.account, accounts[0]);
			assert.equal(web3.fromWei(depositEvent.amount.toNumber()), 0.5);
		});
	});

	describe("withdraw", () => {
		it.only("can withdraw", async () => {
			const withdrawWatcher = exchange.Withdraw();

			await exchange.changeFee(2, web3.toWei(1));

			await exchange.deposit(etherAddress, web3.toWei(0.5), {
				value: web3.toWei(0.5),
				from: accounts[0]
			});

			await assertExchangeBalance(etherAddress, accounts[0], 0.5);
			await assertExchangeBalance(etherAddress, accounts[9], 0);

			await exchange.withdraw(etherAddress, web3.toWei(0.5));

			await assertExchangeBalance(etherAddress, accounts[0], 0);
			await assertExchangeBalance(etherAddress, accounts[9], 0.025);

			const withdrawEvent = withdrawWatcher.get()[0].args;
			assert.equal(withdrawEvent.token, etherAddress);
			assert.equal(withdrawEvent.account, accounts[0]);
			assert.equal(web3.fromWei(withdrawEvent.amount.toNumber()), 0.5);
		});
	});
});

assertExchangeBalance = async (token, account, expectedBalance) => {
	const balance = web3.fromWei(
		(await exchange.balances.call(token, account)).toNumber()
	);
	assert.equal(balance, expectedBalance);
};

assertExchangeBalanceAtLeast = async (token, account, expectedBalance) => {
	const balance = web3.fromWei(
		(await exchange.balances.call(token, account)).toNumber()
	);
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
