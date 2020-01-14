const eutil = require("ethereumjs-util");
const Web3Utils = require("web3-utils");
const Exchange = artifacts.require("Exchange");
const Token = artifacts.require("Token");

contract("Exchange", function(accounts) {
  const server = accounts[0]
  const maker = accounts[1]
  const taker = accounts[2]
  const owner = accounts[3]
  const feeCollector = accounts[4]

  beforeEach(async () => {
    const tokenTotalSupply = "1000000000000000000000"; // 1000 units
    token = await Token.new(tokenTotalSupply, { from: maker });
    exchange = await Exchange.new();
    tokenAddress = token.address
    exchangeAddress = exchange.address
    etherAddress = "0x0000000000000000000000000000000000000000"
    await exchange.changeFeeCollector(feeCollector);
    await exchange.changeOwner(owner);
    await token.approve(exchangeAddress, web3.toWei(100), { from: maker });
    await exchange.deposit(tokenAddress, web3.toWei(100), { from: maker });
    await exchange.deposit(etherAddress, web3.toWei(1), { from: taker, value: web3.toWei(1) });
  });

  it("requires taker to have a sufficient balance", async () => {
    const taker_with_insufficient_balance = taker
    const giveToken = tokenAddress;
    const giveAmount = web3.toWei(100);
    const takeToken = etherAddress;
    const takeAmount = web3.toWei(110);
    const amount = giveAmount;
    const args = { maker, taker: taker_with_insufficient_balance, giveToken, giveAmount, takeToken, takeAmount, amount }
    await assertFail(trade, args)
  })

  describe("public maintenance", () => {
    it("owner can change fee account's address", async () => {
      await exchange.changeFeeCollector(maker, { from: owner });
      const newFeeCollector = await exchange.feeCollector.call();
      assert.equal(newFeeCollector, maker);
    });

    it("owner can change owner's address", async () => {
      await exchange.changeOwner(maker, { from: owner });
      const newOwner = await exchange.owner.call();
      assert.equal(newOwner, maker);
    });
  });

  describe("read features", () => {
    it("retrieves user's balance", async () => {
      const balance = await exchange.balances.call(tokenAddress, maker);
      assert.ok(balance);
    });
  });

  describe("deposit", () => {
    it("can deposit ether", async () => {
      const depositWatcher = exchange.Deposit();
      await assertExchangeBalance(etherAddress, maker, 0);

      await exchange.deposit(etherAddress, web3.toWei(0.5), { from: maker, value: web3.toWei(0.5) });

      await assertExchangeBalance(etherAddress, maker, 0.5);
      const depositEvent = depositWatcher.get()[0].args;
      assert.equal(depositEvent.token, etherAddress);
      assert.equal(depositEvent.account, maker);
      assert.equal(web3.fromWei(depositEvent.amount), 0.5);
    });

    it("can deposit tokens", async () => {
      const depositWatcher = exchange.Deposit();
      await assertExchangeBalance(tokenAddress, maker, 100);

      await token.approve(exchangeAddress, web3.toWei(100), { from: maker });
      await exchange.deposit(tokenAddress, web3.toWei(0.5), { from: maker });

      await assertExchangeBalance(tokenAddress, maker, 100.5);
      const depositEvent = depositWatcher.get()[0].args;
      assert.equal(depositEvent.token, tokenAddress);
      assert.equal(depositEvent.account, maker);
      assert.equal(web3.fromWei(depositEvent.amount), 0.5);
    });

    it("cannot deposit if exchange is inactive", async () => {
      await exchange.setInactive(true, { from: owner })
      await assertFail(exchange.deposit, etherAddress, web3.toWei(0.5), { from: maker, value: web3.toWei(0.5) });
    })
  });

  describe("withdraw", () => {
    it("should withdraw a users balance", async () => {
      const amount = web3.toWei(3);
      const account = maker;
      const fee = web3.toWei(999);

      assert.ok(await exchange.withdraw(tokenAddress, amount, account, fee));

      await assertExchangeBalance(tokenAddress, maker, 97);
      await assertExchangeBalance(tokenAddress, feeCollector, 0.15);
    });

    it("can use withdrawEmergency if it is enabled", async () => {
      await exchange.setContractManualWithdraws(true, { from: owner });
      assert.ok(await exchange.withdrawEmergency(tokenAddress, web3.toWei(0.1), { from: maker }));
    });

    it('can use withdrawEmergency if it is selectively enabled', async () => {
      await exchange.setAccountManualWithdraws(maker, true, { from: owner });
      assert.ok(await exchange.withdrawEmergency(tokenAddress, web3.toWei(0.1), { from: maker }));
    })

    it('the server can also use setAccountManualWithdraws', async () => {
      assert.ok(await exchange.setAccountManualWithdraws(maker, true));
    })

    it("cannot use withdrawEmergency if it hasnt been enabled", async () => {
      await assertFail(exchange.withdrawEmergency, tokenAddress, web3.toWei(1), { from: maker });
    });
  });

  describe("trade", () => {
    it("should swap balances once an order is filled", async () => {
      const giveToken = tokenAddress;
      const giveAmount = web3.toWei(100);
      const takeToken = etherAddress;
      const takeAmount = web3.toWei(0.5);
      const amount = giveAmount;

      await trade({ maker, taker, giveToken, takeToken, giveAmount, takeAmount, amount });

      await assertExchangeBalance(etherAddress, maker, 0.4995);
      await assertExchangeBalance(tokenAddress, maker, 0);
      await assertExchangeBalance(tokenAddress, taker, 99.8);
      await assertExchangeBalance(etherAddress, taker, 0.5);
      await assertExchangeBalance(etherAddress, feeCollector, 0.0005);
      await assertExchangeBalance(tokenAddress, feeCollector, 0.2);
    });

    it("should swap balances with negative fee for maker", async () => {
      await exchange.setNegativeFees(true, { from: owner })
      const giveToken = tokenAddress;
      const giveAmount = web3.toWei(100);
      const takeToken = etherAddress;
      const takeAmount = web3.toWei(0.5);
      const amount = giveAmount;

      await trade({ maker, taker, giveToken, takeToken, giveAmount, takeAmount, amount });

      await assertExchangeBalance(etherAddress, maker, 0.5005);
      await assertExchangeBalance(tokenAddress, maker, 0);
      await assertExchangeBalance(tokenAddress, taker, 99.8);
      await assertExchangeBalance(etherAddress, taker, 0.5);
      await assertExchangeBalance(etherAddress, feeCollector, 0);
      await assertExchangeBalance(tokenAddress, feeCollector, 0.2);
    })

    it("fails if the order has been bulk-cancelled", async () => {
      const nonce = Date.now() * 2; // trade() uses Date.now() for nonces
      await exchange.bulkCancelOrders(maker, nonce);

      const giveToken = tokenAddress;
      const giveAmount = web3.toWei(100);
      const takeToken = etherAddress;
      const takeAmount = web3.toWei(0.5);
      const amount = giveAmount;

      const args = { maker, taker, giveToken, takeToken, giveAmount, takeAmount, amount }
      await assertFail(trade, args)
    });

    it("fails if the order has been cancelled", async () => {
      const giveToken = tokenAddress;
      const giveAmount = web3.toWei(100);
      const takeToken = etherAddress;
      const takeAmount = web3.toWei(0.5);
      const amount = giveAmount;

      const orderHash = generateOrderHash({ maker, giveToken, giveAmount, takeToken, takeAmount })
      await exchange.cancelOrder(orderHash);

      const args = { maker, taker, giveToken, takeToken, giveAmount, takeAmount, amount, orderHash }
      await assertFail(trade, args)
    });
  });

  // helpers
  const generateOrderHash = ({ maker, giveToken, giveAmount, takeToken, takeAmount }) => {
    const nonce = Date.now();
    const expiry = 4705572264000;
    const orderHash = Web3Utils.soliditySha3(exchangeAddress, maker, giveToken, giveAmount, takeToken, takeAmount, nonce, expiry);
    return orderHash
  }

  const generateTradeHash = ({ orderHash, taker, amount }) => {
    const nonce = Date.now();
    const tradeHash = Web3Utils.soliditySha3(exchangeAddress, orderHash, taker, amount, nonce);
    return tradeHash
  }

  const trade = async ({ maker, taker, giveToken, giveAmount, takeToken, takeAmount, amount, orderHash }) => {
    const nonce = Date.now();
    const expiry = 4705572264000;
    const order = orderHash || Web3Utils.soliditySha3(exchangeAddress, maker, giveToken, giveAmount, takeToken, takeAmount, nonce, expiry);
    const signedOrder = web3.eth.sign(maker, order);
    const makerSig = eutil.fromRpcSig(signedOrder);

    const trade = Web3Utils.soliditySha3(exchangeAddress, order, taker, amount, nonce);
    const signedTrade = web3.eth.sign(taker, trade);
    const takerSig = eutil.fromRpcSig(signedTrade);

    const addresses = [maker, taker, giveToken, takeToken];
    const makerFee = web3.toWei(0.001);
    const takerFee = web3.toWei(0.002);
    const uints = [giveAmount, takeAmount, amount, nonce, nonce, makerFee, takerFee, expiry];
    const v = [makerSig.v, takerSig.v];
    const rs = [eutil.bufferToHex(makerSig.r), eutil.bufferToHex(makerSig.s), eutil.bufferToHex(takerSig.r), eutil.bufferToHex(takerSig.s)];
    await exchange.trade(addresses, uints, v, rs);
  };

  const assertExchangeBalance = async (token, account, expectedBalance) => {
    const balance = web3.fromWei((await exchange.balances.call(token, account)).toNumber());
    assert.equal(balance, expectedBalance);
  };

  const getBalance = async (token, account) => {
    const balance = web3.fromWei((await exchange.balances.call(token, account)).toNumber());
    return balance
  }

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
});
