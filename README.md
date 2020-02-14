# Dependencies

* truffle 4.1.14

# Deployment

## For development environment:

* rebuild the dev chain by replacing the `chaindata` folder with an empty one, start ganache from it by running `rake ganache:up`
* from the truffle project, go to `./migrations/1_initial_migration.js` and uncomment these lines to deploy the test tokens
  ```
  // const Token = artifacts.require("./Token.sol");
  ...
  // const tokenTotalSupply = "1000000000000000000000"; // 1000 units
  // deployer.deploy(Token, tokenTotalSupply);
  // deployer.deploy(Token, tokenTotalSupply);
  ```
* deploy the exchange and token contracts with `truffle migrate --reset`
* restore `./migrations/1_initial_migration.js` to its initial state
* run `./scripts/setup_dev_contract.js`, make sure the constant `fee_collector_address` match with `ENV['FEE_COLLECTOR_ADDRESS']` on the API and the constant `server_address` is the public address for `ENV['SERVER_PRIVATE_KEY']` on the API
* remove the empty `chaindata` folder, run `mv .chaindata chaindata` to save the new dev chain
* update ENV['CONTRACT_ADDRESS'] for test environment it it has changed
* update the library artifacts in /lib/contract/artifacts
* update the library code responsible for interacting with the contract to accomodate the new changes

## For production environment:

* generate a single-use mnemonic seed with ganache-cli
* create a config.js file by copying config.js.sample, insert MNEMONIC with the single-use mnemonic
* fund the first address, make sure it has been funded sufficiently using MyEtherWallet 
* go to `truffle.js`, update `gasPrice` if necessary
* deploy with `truffle migrate --reset --network [NETWORK]`, replace [NETWORK] with the network to deploy to
* flatten Exchange.sol with https://github.com/poanetwork/solidity-flattener and verify on Etherscan with the "Optimization" option set to "yes"
* change the admin addresses (owner, server, feeCollector)
* remove the remaining funds from the single-use address
* re-deploy the server, updating CONTRACT_ADDRESS

# Running the test suite

* clone this repo
* `yarn install`
* start ganache-cli
* truffle test
