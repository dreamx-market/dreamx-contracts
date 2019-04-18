require("dotenv").config();
const HDWalletProvider = require("truffle-hdwallet-provider");

module.exports = {
  networks: {
    development: {
      host: "localhost",
      port: 8545,
      network_id: "*",
      gas: 4700000
    },
    "rinkeby-infura": {
      provider: () =>
        new HDWalletProvider(
          process.env.MNEMONIC_PROD,
          "https://rinkeby.infura.io/pVTvEWYTqXvSRvluzCCe"
        ),
      network_id: "4",
      gas: 4700000
    },
    "ropsten-infura": {
      provider: () =>
        new HDWalletProvider(
          process.env.MNEMONIC_PROD,
          "https://ropsten.infura.io/v3/b41fd9db5b3442a5b3be799b1bc91bf0"
        ),
      network_id: "3",
      gas: 4700000
    }
  },
  solc: {
    optimizer: {
      enabled: true,
      runs: 200
    }
  }
};
