const eutil = require("ethereumjs-util");
const Web3Utils = require("web3-utils");
const Exchange = artifacts.require("Exchange");
const Token = artifacts.require("Token");

contract("Exchange", function(accounts) {
  const maker = accounts[0]
  const taker = accounts[1]
  const owner = accounts[2]
  const feeCollector = accounts[3]
  const server = accounts[4]

  beforeEach(async () => {
    const tokenTotalSupply = "1000000000000000000000"; // 1000 units
    token = await Token.new(tokenTotalSupply);
    tokenAddress = token.address
    etherAddress = "0x0000000000000000000000000000000000000000"
    exchange = await Exchange.new();
    await exchange.changeFeeCollector(feeCollector);
    await exchange.changeServer(server);
    await exchange.changeOwner(owner);
    await token.approve(exchange.address, web3.toWei(100));
    await exchange.deposit(tokenAddress, web3.toWei(100));
    await exchange.deposit(etherAddress, web3.toWei(1), {
      from: taker,
      value: web3.toWei(1)
    });
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

      await exchange.deposit(etherAddress, web3.toWei(0.5), {
        value: web3.toWei(0.5)
      });

      await assertExchangeBalance(etherAddress, maker, 0.5);
      const depositEvent = depositWatcher.get()[0].args;
      assert.equal(depositEvent.token, etherAddress);
      assert.equal(depositEvent.account, maker);
      assert.equal(web3.fromWei(depositEvent.amount), 0.5);
    });

    it("can deposit tokens", async () => {
      const depositWatcher = exchange.Deposit();
      await assertExchangeBalance(tokenAddress, maker, 100);

      await token.approve(exchange.address, web3.toWei(100));
      await exchange.deposit(tokenAddress, web3.toWei(0.5));

      await assertExchangeBalance(tokenAddress, maker, 100.5);
      const depositEvent = depositWatcher.get()[0].args;
      assert.equal(depositEvent.token, tokenAddress);
      assert.equal(depositEvent.account, maker);
      assert.equal(web3.fromWei(depositEvent.amount), 0.5);
    });
  });

  describe("withdraw", () => {
    it("should withdraw if owner has user's signature for the operation", async () => {
      const tokenAddress = tokenAddress;
      const amount = web3.toWei(3);
      const account = maker;
      const fee = web3.toWei(999);

      assert.ok(await exchange.withdraw(tokenAddress, amount, account, fee));

      await assertExchangeBalance(tokenAddress, maker, 97);
      await assertExchangeBalance(tokenAddress, feeCollector, 0.15);
    });

    it("can use withdrawEmergency if it is enabled", async () => {
      await exchange.setContractManualWithdraws(true, { from: owner });
      assert.ok(await exchange.withdrawEmergency(tokenAddress, web3.toWei(0.1)));
    });

    it('can use withdrawEmergency if it is selectively enabled', async () => {
      await exchange.setAccountManualWithdraws(maker, true, { from: owner });
      assert.ok(await exchange.withdrawEmergency(tokenAddress, web3.toWei(0.1)));
    })

    it('the server can also use setAccountManualWithdraws', async () => {
      assert.ok(await exchange.setAccountManualWithdraws(maker, true, { from: server }));
    })

    it("cannot use withdrawEmergency if it hasnt been enabled", async () => {
      await assertFail(exchange.withdrawEmergency, tokenAddress, web3.toWei(1));
    });
  });

  describe("trade", () => {
    it.only("should swap balances once an order is filled", async () => {
      const giveToken = tokenAddress;
      const giveAmount = web3.toWei(1);
      const takeToken = etherAddress;
      const takeAmount = web3.toWei(0.5);
      const amount = giveAmount;

      await trade({ maker, taker, giveToken, takeToken, giveAmount, takeAmount, amount });
      // console.log(await getBalance(tokenAddress, maker))
      // console.log(await getBalance(etherAddress, taker))

      // await assertExchangeBalance(etherAddress, maker, 0.4995);
      // await assertExchangeBalance(tokenAddress, accounts[0], 0);
      // await assertExchangeBalance(tokenAddress, accounts[1], 99.8);
      // await assertExchangeBalance(etherAddress, accounts[1], 0.5);
      // await assertExchangeBalance(etherAddress, accounts[4], 0.0005);
      // await assertExchangeBalance(tokenAddress, accounts[4], 0.2);
    });

    it("fails if the order has been bulk-cancelled", () => {
      return new Promise(async (resolve, reject) => {
        const maker = accounts[0];
        const taker = accounts[1];
        const giveToken = tokenAddress;
        const giveAmount = web3.toWei(100);
        const takeToken = etherAddress;
        const takeAmount = web3.toWei(0.005 * 100);
        const amount = giveAmount;
        const expiry = 100000;
        const nonce = Date.now();
        const makerFee = web3.toWei(0.001);
        const takerFee = web3.toWei(0.002);
        const order = Web3Utils.soliditySha3(
          exchange.address,
          maker,
          giveToken,
          giveAmount,
          takeToken,
          takeAmount,
          nonce,
          expiry
        );
        const signedOrder = web3.eth.sign(maker, order);
        const makerSig = eutil.fromRpcSig(signedOrder);
        const trade = Web3Utils.soliditySha3(
          exchange.address,
          order,
          taker,
          amount,
          nonce
        );
        const signedTrade = web3.eth.sign(taker, trade);
        const takerSig = eutil.fromRpcSig(signedTrade);
        const addresses = [maker, taker, giveToken, takeToken];
        const uints = [
          giveAmount,
          takeAmount,
          amount,
          nonce,
          nonce,
          makerFee,
          takerFee,
          expiry
        ];
        const v = [makerSig.v, takerSig.v];
        const rs = [
          eutil.bufferToHex(makerSig.r),
          eutil.bufferToHex(makerSig.s),
          eutil.bufferToHex(takerSig.r),
          eutil.bufferToHex(takerSig.s)
        ];

        await exchange.bulkCancelOrders(maker, nonce);

        try {
          await exchange.trade(addresses, uints, v, rs);
        } catch (err) {
          resolve();
        }
      });
    });

    it("fails if the order has been cancelled", () => {
      return new Promise(async (resolve, reject) => {
        const maker = accounts[0];
        const taker = accounts[1];
        const giveToken = tokenAddress;
        const giveAmount = web3.toWei(100);
        const takeToken = etherAddress;
        const takeAmount = web3.toWei(0.005 * 100);
        const amount = giveAmount;
        const expiry = 100000;
        const nonce = Date.now();
        const makerFee = web3.toWei(0.001);
        const takerFee = web3.toWei(0.002);
        const order = Web3Utils.soliditySha3(
          exchange.address,
          maker,
          giveToken,
          giveAmount,
          takeToken,
          takeAmount,
          nonce,
          expiry
        );
        const signedOrder = web3.eth.sign(maker, order);
        const makerSig = eutil.fromRpcSig(signedOrder);
        const trade = Web3Utils.soliditySha3(
          exchange.address,
          order,
          taker,
          amount,
          nonce
        );
        const signedTrade = web3.eth.sign(taker, trade);
        const takerSig = eutil.fromRpcSig(signedTrade);
        const addresses = [maker, taker, giveToken, takeToken];
        const uints = [
          giveAmount,
          takeAmount,
          amount,
          nonce,
          nonce,
          makerFee,
          takerFee,
          expiry
        ];
        const v = [makerSig.v, takerSig.v];
        const rs = [
          eutil.bufferToHex(makerSig.r),
          eutil.bufferToHex(makerSig.s),
          eutil.bufferToHex(takerSig.r),
          eutil.bufferToHex(takerSig.s)
        ];

        await exchange.cancelOrder(order);

        try {
          await exchange.trade(addresses, uints, v, rs);
        } catch (err) {
          resolve();
        }
      });
    });
  });

  describe("airdrop", () => {
    beforeEach(async () => {
      airdrop = await Token.new();
      await airdrop.initialize(
        "AirdropToken",
        "AIR",
        unitsOneEthCanBuy,
        totalSupply
      );
      await airdrop.approve(exchange.address, web3.toWei(10000));
      await exchange.deposit(airdrop.address, web3.toWei(10000));
      await exchange.changeAirdropAccountAddress(accounts[0], {
        from: accounts[9]
      });
      await exchange.setAirdropStatus(true, { from: accounts[9] });
      await exchange.setAirdropTokenAddress(airdrop.address, {
        from: accounts[9]
      });
      await exchange.setAirdropRatePerEth(100, { from: accounts[9] });
      await exchange.setFeeTokenRatePerEth(100, { from: accounts[9] });
      await exchange.setFeeTokenStatus(true, { from: accounts[9] });
      await exchange.setFeeTokenAddress(airdrop.address, { from: accounts[9] });
    });

    it("should airdrop an amount equivalent to the traded amount", async () => {
      const maker = accounts[0];
      const taker = accounts[1];
      const giveToken = tokenAddress;
      const giveAmount = web3.toWei(100);
      const takeToken = etherAddress;
      const takeAmount = web3.toWei(0.005 * 100);
      const amount = giveAmount;

      await trade(
        maker,
        taker,
        amount,
        giveToken,
        takeToken,
        giveAmount,
        takeAmount
      );

      await assertExchangeBalance(airdrop.address, accounts[0], 9950);
      await assertExchangeBalance(airdrop.address, accounts[1], 50);
    });

    it("can use airdrop tokens to pay for trading fee", async () => {
      await exchange.setFeeTokenStatus(true, { from: accounts[9] });
      const maker = accounts[0];
      const taker = accounts[1];
      const giveToken = tokenAddress;
      const giveAmount = web3.toWei(100);
      const takeToken = etherAddress;
      const takeAmount = web3.toWei(0.005 * 100);
      const amount = giveAmount;

      await trade(
        maker,
        taker,
        amount,
        giveToken,
        takeToken,
        giveAmount,
        takeAmount
      );

      await assertExchangeBalance(airdrop.address, accounts[0], 9950);
    });
  });

  // helpers
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
