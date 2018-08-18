require("dotenv").config();
const Exchange = artifacts.require("Exchange");
const Token = artifacts.require("Token");
const name = process.env.TOKEN_NAME;
const symbol = process.env.TOKEN_SYMBOL;
const unitsOneEthCanBuy = process.env.TOKEN_RATE;
const totalSupply = process.env.TOKEN_SUPPLY;
const etherAddress = "0x0000000000000000000000000000000000000000";

contract("Exchange", function(accounts) {
	beforeEach(async () => {
		exchange = await Exchange.new();
		token = await Token.new(name, symbol, unitsOneEthCanBuy, totalSupply);
	});

	describe("public maintenance", () => {
		it("owner can change fee account's address", async () => {
			const currentFeeAccount = await exchange.feeAccount.call();
			assert.equal(currentFeeAccount, accounts[0]);

			await exchange.changeFeeAccount(accounts[1]);
			const newFeeAccount = await exchange.feeAccount.call();
			assert.equal(newFeeAccount, accounts[1]);
		});

		it("owner can change owner's address", async () => {
			const currentOwner = await exchange.owner.call();
			assert.equal(currentOwner, accounts[0]);

			await exchange.changeOwner(accounts[1]);
			const newOwner = await exchange.owner.call();
			assert.equal(newOwner, accounts[1]);
		});

		it("owner can change timelock duration", async () => {
			const currentDuration = await exchange.timelock.call();
			assert.equal(currentDuration, 100000);

			await exchange.setTimelock(1000000);
			const newDuration = await exchange.timelock.call();
			assert.equal(newDuration, 1000000);
		});

		it("timelock duration cannot exceed 1 million blocks", async () => {
			assertFail(exchange.setTimelock, 1000001);
		});
	});

	describe("read features", () => {
		it("retrieves user's balance", async () => {
			const balance = await exchange.balances.call(
				token.address,
				accounts[0]
			);

			assert.ok(balance);
		});
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

	describe("withdraw", () => {
		it("cannot withdraw before timelock's expiry", async () => {
			await exchange.deposit(etherAddress, web3.toWei(0.5), {
				value: web3.toWei(0.5)
			});
			await assertFail(
				exchange.withdrawEmergency,
				etherAddress,
				web3.toWei(0.1)
			);
		});

		it.only("should withdraw after timelock's expiry", async () => {
			await exchange.setTimelock(3);
			await exchange.deposit(etherAddress, web3.toWei(0.5), {
				value: web3.toWei(0.5)
			});

			for (let i = 0; i < 5; i++) {
				await web3.eth.sendTransaction({
					from: accounts[1],
					to: accounts[2],
					value: web3.toWei(0.01)
				});
			}

			assert.ok(
				await exchange.withdrawEmergency(etherAddress, web3.toWei(0.1))
			);
		});
	});
});

assertExchangeBalance = async (token, account, expectedBalance) => {
	const balance = web3.fromWei(
		(await exchange.balances.call(token, account)).toNumber()
	);
	assert.equal(balance, expectedBalance);
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
