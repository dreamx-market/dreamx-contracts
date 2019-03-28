const Web3 = require("web3");
const Tx = require("ethereumjs-tx");
const Exchange = require("../build/contracts/Exchange.json");

const ether_address = "0x0000000000000000000000000000000000000000";
const exchange_address = "0x8137064a86006670d407c24e191b5a55da5b2889";

const web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
const exchange = web3.eth.contract(Exchange.abi).at(exchange_address);
const accounts = web3.eth.accounts;
const privateKey = Buffer.from(
  "d15b17f51f613d0d89c64c7b629ffff7ae9c19e509afc9518dac1650e9812c18",
  "hex"
);
web3.eth.defaultAccount = accounts[0];

(async () => {
  // let balance = web3.fromWei(
  //   await exchange.balances(ether_address, accounts[0]).toNumber()
  // );
  // console.log(balance);

  // withdraw_payload.js output
  // contract_address 0x8137064a86006670d407c24e191b5a55da5b2889
  // token_address: 0x0000000000000000000000000000000000000000
  // amount: 100000000000000000000
  // account_address: 0xe37a4faa73fced0a177da51d8b62d02764f2fc45
  // nonce: 1551375034000
  // withdraw_hash: 0xc51a816c41e602a14ae243a92237f100461b9bcea4cc45ff0947e0272cc7eb44
  // salted_withdraw_hash 0x57ee40e282c0627136602d28f425df0fbcba91bc8375cda45e2b4e96839e8533
  // signature: 0xc15d5e26c28a79bf21f5b22deca5ff223e8ba44c819d7810ff41ef1558971da46f979f1b370d38d452f8eb8e00bde6ba92ee1db91e247fedd7bded81e62d88d91c

  const token = "0x0000000000000000000000000000000000000000";
  const amount = 100000000000000000000;
  const account = "0xe37a4faa73fced0a177da51d8b62d02764f2fc45";
  const nonce = 1551375034000;
  const v = 28;
  const r =
    "0xc15d5e26c28a79bf21f5b22deca5ff223e8ba44c819d7810ff41ef1558971da4";
  const s =
    "0x6f979f1b370d38d452f8eb8e00bde6ba92ee1db91e247fedd7bded81e62d88d9";
  const fee = 0;

  const data = exchange.withdraw.getData(
    token,
    amount,
    account,
    nonce,
    v,
    r,
    s,
    fee
  );
  const gasLimit = 6721975;
  const gasPrice = 20000000000;
  const txNonce = await web3.eth.getTransactionCount(account);
  const rawTx = {
    from: account,
    gas: gasLimit,
    to: exchange_address,
    nonce: txNonce,
    gasPrice: gasPrice,
    data: data
  };
  const tx = new Tx(rawTx);
  tx.sign(privateKey);
  const serializedTx = "0x" + tx.serialize().toString("hex");
  console.log(serializedTx);
  // web3.eth.sendRawTransaction(serializedTx, function(err, hash) {
  //   if (!err) {
  //     console.log(hash);
  //   }
  // });
  // await exchange.withdraw(token, amount, account, nonce, v, r, s, fee);
})();
