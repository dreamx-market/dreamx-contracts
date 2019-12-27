const Exchange = artifacts.require("./Exchange.sol");
// const Token = artifacts.require("./Token.sol");

module.exports = async function(deployer) {
  deployer.deploy(Exchange);
  // const tokenTotalSupply = "1000000000000000000000"; // 1000 units
  // deployer.deploy(Token, tokenTotalSupply);
  // deployer.deploy(Token, tokenTotalSupply);
};
