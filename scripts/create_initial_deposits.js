const Web3 = require("web3");
const Exchange = require("../build/contracts/Exchange.json");
const Token = require("../build/contracts/Token.json");

const exchange_address = "0xa038fe0d3209256cdab852bbfc2c132168c53be9";
const ether_address = "0x0000000000000000000000000000000000000000";
const token_one_address = "0x5cbdca87f2c7b4dbded09871f7fee66e4fbda1e4";
const token_two_address = "0x362e78b22105d639f8c20ed047e4b9093b2a7ee8";

const web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
const exchange = web3.eth.contract(Exchange.abi).at(exchange_address);
const token_one = web3.eth.contract(Token.abi).at(token_one_address);
const token_two = web3.eth.contract(Token.abi).at(token_two_address);
const accounts = web3.eth.accounts;
web3.eth.defaultAccount = accounts[0];

(async function() {
  const depositAmount = web3.toWei(10);

  await token_one.approve(exchange.address, depositAmount);
  await token_two.approve(exchange.address, depositAmount);

  await exchange.deposit(ether_address, depositAmount, {
    value: depositAmount
  });
  await exchange.deposit(token_one.address, depositAmount);
  await exchange.deposit(token_two.address, depositAmount);

  const deposited_eth = web3.fromWei(
    await exchange.balances(ether_address, accounts[0]).toNumber()
  );
  const deposited_token_one = web3.fromWei(
    await exchange.balances(token_one_address, accounts[0]).toNumber()
  );
  const deposited_token_two = web3.fromWei(
    await exchange.balances(token_two_address, accounts[0]).toNumber()
  );

  console.log(`deposited ${deposited_eth} ETH`);
  console.log(`deposited ${deposited_token_one} ONE`);
  console.log(`deposited ${deposited_token_two} TWO`);
})();
