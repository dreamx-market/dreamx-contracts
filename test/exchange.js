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
    await exchange.depositToken(tokenAddress, maker, web3.toWei(100), { from: server });
    await exchange.deposit({ from: taker, value: web3.toWei(1) });
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

    it("only owner can change accountEjectionTimelock", async () => {
      assertOk(exchange.setAccountEjectionTimelock, 1000, { from: owner })
      assert.equal(await exchange.accountEjectionTimelock(), 1000)
      assertFail(exchange.setAccountEjectionTimelock, 0, { from: maker })
      assert.equal(await exchange.accountEjectionTimelock(), 1000)
    })
  });

  describe("read features", () => {
    it("retrieves user's balance", async () => {
      assertOk(exchange.balances, tokenAddress, maker)
    });
  });

  describe("deposit", () => {
    it("can deposit ether", async () => {
      const depositWatcher = exchange.Deposit();
      await assertExchangeBalance(etherAddress, maker, 0);

      await exchange.deposit({ from: maker, value: web3.toWei(0.5) });

      await assertExchangeBalance(etherAddress, maker, 0.5);
      const depositEvent = depositWatcher.get()[0].args;
      assert.equal(depositEvent.token, etherAddress);
      assert.equal(depositEvent.account, maker);
      assert.equal(web3.fromWei(depositEvent.amount), 0.5);
    });

    it("can deposit tokens", async () => {
      const depositWatcher = exchange.Deposit();
      await assertExchangeBalance(tokenAddress, maker, 100);

      await token.approve(exchangeAddress, web3.toWei(0.5), { from: maker });
      await exchange.depositToken(tokenAddress, maker, web3.toWei(0.5), { from: server });

      await assertExchangeBalance(tokenAddress, maker, 100.5);
      const depositEvent = depositWatcher.get()[0].args;
      assert.equal(depositEvent.token, tokenAddress);
      assert.equal(depositEvent.account, maker);
      assert.equal(web3.fromWei(depositEvent.amount), 0.5);
    });

    it("cannot deposit tokens unless is server", async () => {
      const depositWatcher = exchange.Deposit();
      await assertExchangeBalance(tokenAddress, maker, 100);

      await token.approve(exchangeAddress, web3.toWei(0.5), { from: maker });
      await assertFail(exchange.depositToken, tokenAddress, maker, web3.toWei(0.5), { from: maker });
    })

    it("cannot deposit if exchange is inactive", async () => {
      await exchange.deactivate({ from: owner })
      await token.approve(exchangeAddress, web3.toWei(0.5), { from: maker });

      await assertFail(exchange.deposit, { from: maker, value: web3.toWei(0.5) });
      await assertFail(exchange.depositToken, tokenAddress, maker, web3.toWei(0.5), { from: server });
    })
  });

  describe("withdraw", () => {
    it("should withdraw a users balance", async () => {
      const amount = web3.toWei(3);
      const account = maker;
      const fee = web3.toWei(999);

      assertOk(exchange.withdraw, tokenAddress, amount, account, fee)

      await assertExchangeBalance(tokenAddress, maker, 97)
      await assertExchangeBalance(tokenAddress, feeCollector, 0.15)
    })

    it("can use directWithdraw if exchange has been de-activated", async () => {
      await exchange.deactivate({ from: owner })
      assertOk(exchange.directWithdraw, tokenAddress, web3.toWei(0.1), { from: maker })
    });

    it('cannot use directWithdraw if account has only been ejected recently', async () => {
      await exchange.setAccountEjectionTimelock(2, { from: owner })
      await exchange.eject({ from: maker })
      await mine(1)
      assertFail(await exchange.directWithdraw, tokenAddress, web3.toWei(0.1), { from: maker })
    })

    it('can use directWithdraw if account has been ejected and enough time has passed', async () => {
      await exchange.setAccountEjectionTimelock(2, { from: owner })
      await exchange.eject({ from: maker })
      await mine(2)
      assertOk(exchange.directWithdraw, tokenAddress, web3.toWei(0.1), { from: maker })
      await assertExchangeBalance(tokenAddress, maker, 99.9);
    })
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

  describe("ejection", () => {
    it("ejects an account", async () => {
      const ejectionWatcher = exchange.Ejection();
      const tx = await exchange.eject({ from: maker })
      const ejectionEvent = ejectionWatcher.get()[0].args;
      const accountEjectedAt = await exchange.accountEjectedAt(maker)
      assert.equal(tx.receipt.blockNumber, accountEjectedAt.toNumber())
      assert.equal(ejectionEvent.account, maker)
    })

    it("cannot ejects an account twice", async () => {
      await assertOk(exchange.eject, { from: maker })
      await assertFail(exchange.eject, { from: maker })
    })
  })

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

  const assertOk = async (fn, ...args) => {
    assert.ok(await fn(...args));
  };

  const mine = async blocks => {
    for (let i = 0; i < blocks; i++) {
      await web3.currentProvider.send({ jsonrpc: "2.0", method: "evm_mine" }) 
    }
  };
});
