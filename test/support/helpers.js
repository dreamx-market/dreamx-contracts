const Web3Utils = require("web3-utils");
const eutil = require("ethereumjs-util");
const { 
  MAKER_FEE_PER_ETHER_IN_WEI,
  TAKER_FEE_PER_ETHER_IN_WEI
} = require('../../config')

const trade = async ({ maker, taker, giveToken, giveAmount, takeToken, takeAmount, amount }) => {
  const exchangeAddress = exchange.address
  const nonce = Date.now();
  const expiry = 4705572264000;
  const order = Web3Utils.soliditySha3(exchangeAddress, maker, giveToken, giveAmount, takeToken, takeAmount, nonce, expiry);
  const signedOrder = web3.eth.sign(maker, order);
  const makerSig = eutil.fromRpcSig(signedOrder);

  const trade = Web3Utils.soliditySha3(exchangeAddress, order, taker, amount, nonce);
  const signedTrade = web3.eth.sign(taker, trade);
  const takerSig = eutil.fromRpcSig(signedTrade);

  const addresses = [maker, taker, giveToken, takeToken];
  const makerFee = MAKER_FEE_PER_ETHER_IN_WEI;
  const takerFee = TAKER_FEE_PER_ETHER_IN_WEI;
  const uints = [giveAmount, takeAmount, amount, nonce, nonce, makerFee, takerFee, expiry];
  const v = [makerSig.v, takerSig.v];
  const rs = [eutil.bufferToHex(makerSig.r), eutil.bufferToHex(makerSig.s), eutil.bufferToHex(takerSig.r), eutil.bufferToHex(takerSig.s)];
  await exchange.trade(addresses, uints, v, rs);
};

const assertExchangeBalance = async (token, account, expectedBalance) => {
  const balance = web3.fromWei((await exchange.balances.call(token, account)).toNumber());
  assert.equal(balance, expectedBalance);
};

const assertFail = async (fn, ...args) => {
  try {
    assert.fail(await fn(...args));
  } catch (err) {
    assert.equal(err.message, "VM Exception while processing transaction: revert");
  }
};

const mine = async blocks => {
  for (let i = 0; i < blocks; i++) {
    await web3.currentProvider.send({ jsonrpc: "2.0", method: "evm_mine" }) 
  }
};

module.exports = {
  trade,
  assertExchangeBalance,
  assertFail,
  mine
}