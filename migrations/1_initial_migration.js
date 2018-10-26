require("dotenv").config();

const Migrations = artifacts.require("./Migrations.sol");
const Token = artifacts.require("./Token.sol");
const Exchange = artifacts.require("./Exchange.sol");
const ExchangePure = artifacts.require("./ExchangePure.sol");
const RBT = artifacts.require("./lib/RedBlackTree.sol");

module.exports = function(deployer) {
	deployer.deploy(Migrations);
	deployer.deploy(Exchange);
	// deployer.deploy(Token);
	// deployer.deploy(RBT);
	// deployer.link(RBT, ExchangePure);
	// deployer.deploy(ExchangePure);
};
