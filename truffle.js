const HDWalletProvider = require("truffle-hdwallet-provider");
const Web3Utils = require("web3-utils");
const { 
  MNEMONIC
} = require('./config')

module.exports = {
  networks: {
    development: {
      host: "localhost",
      port: 8545,
      network_id: "*",
      gasPrice: Web3Utils.toWei("1", "gwei"),
      gas: 4700000
    },
    "rinkeby": {
      provider: () =>
        new HDWalletProvider(
          MNEMONIC,
          "https://rinkeby.infura.io/pVTvEWYTqXvSRvluzCCe"
        ),
      network_id: "4",
      gasPrice: Web3Utils.toWei("1", "gwei"),
      gas: 4700000
    },
    "ropsten": {
      provider: () =>
        new HDWalletProvider(
          MNEMONIC,
          "https://ropsten.infura.io/v3/b41fd9db5b3442a5b3be799b1bc91bf0"
        ),
      network_id: "3",
      gasPrice: Web3Utils.toWei("1", "gwei"),
      gas: 4700000
    }
  },
  solc: {
    optimizer: {
      enabled: true,
      runs: 200
    }
  },
  compilers: {
    solc: {
        version: '^0.4.22'
    }
  }
};
