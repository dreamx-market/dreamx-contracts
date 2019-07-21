require("dotenv").config();

const Migrations = artifacts.require("./Migrations.sol");
const Token = artifacts.require("./Token.sol");
const Exchange = artifacts.require("./Exchange.sol");

module.exports = async function(deployer) {
  // deployer.deploy(Migrations);
  deployer.deploy(Exchange);
  deployer.deploy(Token, "1000000000000000000000");
  deployer.deploy(Token, "1000000000000000000000");
};
