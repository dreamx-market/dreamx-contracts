require("dotenv").config();
const { keccak_256 } = require("js-sha3");
const eutil = require("ethereumjs-util");
const Web3Utils = require("web3-utils");
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
		await exchange.changeFeeCollector(accounts[4]);
		await exchange.changeOwner(accounts[9]);
		token = await Token.new();
		await token.initialize(name, symbol, unitsOneEthCanBuy, totalSupply);

		await token.approve(exchange.address, web3.toWei(100));
		await exchange.deposit(token.address, web3.toWei(100));
		await assertExchangeBalance(token.address, accounts[0], 100);

		await exchange.deposit(etherAddress, web3.toWei(1), {
			from: accounts[1],
			value: web3.toWei(1)
		});
		await assertExchangeBalance(etherAddress, accounts[1], 1);
	});

	describe("public maintenance", () => {
		it("owner can change fee account's address", async () => {
			const currentFeeCollector = await exchange.feeCollector.call();
			assert.equal(currentFeeCollector, accounts[4]);

			await exchange.changeFeeCollector(accounts[1], { from: accounts[9] });
			const newFeeCollector = await exchange.feeCollector.call();
			assert.equal(newFeeCollector, accounts[1]);
		});

		it("owner can change owner's address", async () => {
			const currentOwner = await exchange.owner.call();
			assert.equal(currentOwner, accounts[9]);

			await exchange.changeOwner(accounts[1], { from: accounts[9] });
			const newOwner = await exchange.owner.call();
			assert.equal(newOwner, accounts[1]);
		});

		it("owner can change owner's address", async () => {
			const currentOwner = await exchange.owner.call();
			assert.equal(currentOwner, accounts[9]);

			await exchange.changeOwner(accounts[1], { from: accounts[9] });
			const newOwner = await exchange.owner.call();
			assert.equal(newOwner, accounts[1]);
		});

		it("owner can change timelock duration", async () => {
			const currentDuration = await exchange.timelock.call();
			assert.equal(currentDuration, 100000);

			await exchange.setTimelock(1000000, { from: accounts[9] });
			const newDuration = await exchange.timelock.call();
			assert.equal(newDuration, 1000000);
		});

		it("timelock duration cannot exceed 1 million blocks", async () => {
			await assertFail(exchange.setTimelock, 1000001, { from: accounts[9] });
		});
	});

	describe("read features", () => {
		it("retrieves user's balance", async () => {
			const balance = await exchange.balances.call(token.address, accounts[0]);

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
			assert.equal(depositEvent.account, accounts[0]);
			assert.equal(web3.fromWei(depositEvent.amount.toNumber()), 0.5);
		});

		it("can deposit tokens", async () => {
			const depositWatcher = exchange.Deposit();

			await assertExchangeBalance(token.address, accounts[0], 100);

			await token.approve(exchange.address, web3.toWei(100));
			await exchange.deposit(token.address, web3.toWei(0.5));

			await assertExchangeBalance(token.address, accounts[0], 100.5);

			const depositEvent = depositWatcher.get()[0].args;
			assert.equal(depositEvent.token, token.address);
			assert.equal(depositEvent.account, accounts[0]);
			assert.equal(web3.fromWei(depositEvent.amount.toNumber()), 0.5);
		});
	});

	describe("withdraw", () => {
		beforeEach(async () => {
			await exchange.deposit(etherAddress, web3.toWei(0.5), {
				value: web3.toWei(0.5)
			});
			await assertExchangeBalance(etherAddress, accounts[0], 0.5);
		});

		it("should withdraw if owner has user's signature for the operation", async () => {
			const feeCollector = await exchange.feeCollector.call();
			assert.equal(feeCollector, accounts[4]);

			const token = etherAddress;
			const amount = web3.toWei(0.3);
			const account = accounts[0];
			const nonce = Date.now();
			const fee = web3.toWei(999);

			const msg = Web3Utils.soliditySha3(
				exchange.address,
				token,
				amount,
				account,
				nonce
			);
			const signedMsg = web3.eth.sign(account, msg);
			const { v, r, s } = eutil.fromRpcSig(signedMsg);

			assert.ok(
				await exchange.withdraw(
					etherAddress,
					amount,
					account,
					nonce,
					v,
					eutil.bufferToHex(r),
					eutil.bufferToHex(s),
					fee
				)
			);
			await assertExchangeBalance(etherAddress, accounts[0], 0.2);
			await assertExchangeBalance(etherAddress, accounts[4], 0.015);
		});

		it("cannot withdraw before timelock's expiry", async () => {
			await assertFail(
				exchange.withdrawEmergency,
				etherAddress,
				web3.toWei(0.1)
			);
		});

		it("should withdraw after timelock's expiry", async () => {
			await exchange.setTimelock(3, { from: accounts[9] });
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

	describe("trade", () => {
		it("should do a balance swap when an order is filled", async () => {
			const maker = accounts[0];
			const taker = accounts[1];
			const giveToken = token.address;
			const giveAmount = web3.toWei(100);
			const takeToken = etherAddress;
			const takeAmount = web3.toWei(0.005 * 100);
			const amount = giveAmount;

			await trade(
				maker,
				taker,
				amount,
				giveToken,
				takeToken,
				giveAmount,
				takeAmount
			);

			await assertExchangeBalance(etherAddress, accounts[0], 0.4995);
			await assertExchangeBalance(token.address, accounts[0], 0);
			await assertExchangeBalance(token.address, accounts[1], 99.8);
			await assertExchangeBalance(etherAddress, accounts[1], 0.5);
			await assertExchangeBalance(etherAddress, accounts[4], 0.0005);
			await assertExchangeBalance(token.address, accounts[4], 0.2);
		});
	});

	describe("airdrop", () => {
		beforeEach(async () => {
			airdrop = await Token.new();
			await airdrop.initialize(
				"AirdropToken",
				"AIR",
				unitsOneEthCanBuy,
				totalSupply
			);
			await airdrop.approve(exchange.address, web3.toWei(10000));
			await exchange.deposit(airdrop.address, web3.toWei(10000));
			await exchange.changeAirdropAccountAddress(accounts[0], {
				from: accounts[9]
			});
			await exchange.setAirdropStatus(true, { from: accounts[9] });
			await exchange.setAirdropTokenAddress(airdrop.address, {
				from: accounts[9]
			});
			await exchange.setAirdropRatePerEth(100, { from: accounts[9] });
		});

		it("should airdrop an amount equivalent to the traded amount", async () => {
			const maker = accounts[0];
			const taker = accounts[1];
			const giveToken = token.address;
			const giveAmount = web3.toWei(100);
			const takeToken = etherAddress;
			const takeAmount = web3.toWei(0.005 * 100);
			const amount = giveAmount;

			await trade(
				maker,
				taker,
				amount,
				giveToken,
				takeToken,
				giveAmount,
				takeAmount
			);

			await assertExchangeBalance(airdrop.address, accounts[0], 9950);
			await assertExchangeBalance(airdrop.address, accounts[1], 50);
		});
	});
});

const trade = async (
	maker,
	taker,
	amount,
	giveToken,
	takeToken,
	giveAmount,
	takeAmount
) => {
	const expiry = 100000;
	const nonce = Date.now();
	const makerFee = web3.toWei(0.001);
	const takerFee = web3.toWei(0.002);
	const order = Web3Utils.soliditySha3(
		exchange.address,
		maker,
		giveToken,
		giveAmount,
		takeToken,
		takeAmount,
		nonce,
		expiry
	);
	const signedOrder = web3.eth.sign(maker, order);
	const makerSig = eutil.fromRpcSig(signedOrder);
	const trade = Web3Utils.soliditySha3(
		exchange.address,
		order,
		taker,
		amount,
		nonce
	);
	const signedTrade = web3.eth.sign(taker, trade);
	const takerSig = eutil.fromRpcSig(signedTrade);
	const addresses = [maker, taker, giveToken, takeToken];
	const uints = [
		giveAmount,
		takeAmount,
		amount,
		nonce,
		nonce,
		makerFee,
		takerFee,
		expiry
	];
	const v = [makerSig.v, takerSig.v];
	const rs = [
		eutil.bufferToHex(makerSig.r),
		eutil.bufferToHex(makerSig.s),
		eutil.bufferToHex(takerSig.r),
		eutil.bufferToHex(takerSig.s)
	];
	await exchange.trade(addresses, uints, v, rs);
};

const assertExchangeBalance = async (token, account, expectedBalance) => {
	const balance = web3.fromWei(
		(await exchange.balances.call(token, account)).toNumber()
	);
	assert.equal(balance, expectedBalance);
};

const assertExchangeBalanceAtLeast = async (
	token,
	account,
	expectedBalance
) => {
	const balance = web3.fromWei(
		(await exchange.balances.call(token, account)).toNumber()
	);
	assert.isAtLeast(balance, expectedBalance);
};

const assertFail = async (fn, ...args) => {
	try {
		assert.fail(await fn(...args));
	} catch (err) {
		assert.equal(
			err.message,
			"VM Exception while processing transaction: revert"
		);
	}
};
