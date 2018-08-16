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

	describe("public maintainence", () => {
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
});
