require("dotenv").config();

const Migrations = artifacts.require("./Migrations.sol");
const Token = artifacts.require("./Token.sol");
const Exchange = artifacts.require("./Exchange.sol");
const ExchangePure = artifacts.require("./ExchangePure.sol");
const RBT = artifacts.require("./lib/RedBlackTree.sol");
const name = process.env.TOKEN_NAME;
const symbol = process.env.TOKEN_SYMBOL;
const unitsOneEthCanBuy = process.env.TOKEN_RATE;
const totalSupply = process.env.TOKEN_SUPPLY;

module.exports = function(deployer) {
	deployer.deploy(Migrations, { overwrite: false });
	deployer.deploy(Token, name, symbol, unitsOneEthCanBuy, totalSupply, {
		overwrite: false
	});
	deployer.deploy(Exchange, { overwrite: false });
	deployer.deploy(RBT, { overwrite: false });
	deployer.link(RBT, ExchangePure);
	deployer.deploy(ExchangePure, { overwrite: false });
};
