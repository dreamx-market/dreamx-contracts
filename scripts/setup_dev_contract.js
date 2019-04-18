const Web3 = require("web3");
const Exchange = require("../build/contracts/Exchange.json");
const Token = require("../build/contracts/Token.json");

const exchange_address = "0xf675cf9c811022a8d934df1c96bb8af884dc92ee";
const ether_address = "0x0000000000000000000000000000000000000000";
const token_one_address = "0x8137064a86006670d407c24e191b5a55da5b2889";
const token_two_address = "0x75d417ab3031d592a781e666ee7bfc3381ad33d5";

const web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
const exchange = web3.eth.contract(Exchange.abi).at(exchange_address);
const token_one = web3.eth.contract(Token.abi).at(token_one_address);
const token_two = web3.eth.contract(Token.abi).at(token_two_address);
const accounts = web3.eth.accounts;
web3.eth.defaultAccount = accounts[0];

(async function() {
  const depositAmount = web3.toWei(1000);

  await token_one.approve(exchange.address, depositAmount);
  await token_two.approve(exchange.address, depositAmount);

  await exchange.deposit(ether_address, depositAmount, {
    value: depositAmount
  });
  await exchange.deposit(token_one.address, depositAmount);
  await exchange.deposit(token_two.address, depositAmount);
  await exchange.deposit(ether_address, depositAmount, {
    value: depositAmount,
    from: accounts[1]
  });

  const deposited_eth = web3.fromWei(
    await exchange.balances(ether_address, accounts[0]).toNumber()
  );
  const deposited_token_one = web3.fromWei(
    await exchange.balances(token_one_address, accounts[0]).toNumber()
  );
  const deposited_token_two = web3.fromWei(
    await exchange.balances(token_two_address, accounts[0]).toNumber()
  );
  const deposited_eth_2 = web3.fromWei(
    await exchange.balances(ether_address, accounts[1]).toNumber()
  );

  console.log(`deposited ${deposited_eth} ETH for ${accounts[0]}`);
  console.log(`deposited ${deposited_token_one} ONE ${accounts[0]}`);
  console.log(`deposited ${deposited_token_two} TWO ${accounts[0]}`);
  console.log(`deposited ${deposited_eth_2} ETH ${accounts[1]}`);

  await exchange.changeServer(accounts[1]);

  console.log(`changed server to: ${accounts[1]}`);
})();
