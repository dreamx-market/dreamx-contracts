const Web3Utils = require("web3-utils");

module.exports = {
  MAKER_FEE_PER_ETHER_IN_WEI: Web3Utils.toWei('0.001'),
  TAKER_FEE_PER_ETHER_IN_WEI: Web3Utils.toWei('0.002'),
  MNEMONIC: "INSERT"
}