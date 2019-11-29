# Deployment

## Development:

* rebuild the dev chain by replacing the `chaindata` folder with an empty one, start ganache from it
* from the truffle project, go to `./migrations/1_initial_migration.js` and uncomment these lines to deploy the test tokens
  ```
  // deployer.deploy(Token, "1000000000000000000000");
  // deployer.deploy(Token, "1000000000000000000000");
  ```
* deploy the exchange and token contracts with `truffle migrate --reset`
* restore `./migrations/1_initial_migration.js` to its initial state
* run `./scripts/setup_dev_contract.js`, make sure the constant `fee_collector_address` match with `ENV['FEE_COLLECTOR_ADDRESS']` on the API and the constant `server_address` is the public address for `ENV['SERVER_PRIVATE_KEY']` on the API
* remove the empty `chaindata` folder, run `mv .chaindata chaindata` to save the new dev chain
* update ENV['CONTRACT_ADDRESS'] for test environment it it has changed
* update the library artifacts in /lib/contract/artifacts and the library code responsible for interacting with the contract to accomodate the new changes

## Production:

* generate a single-use mnemonic seed with ganache-cli
* in the truffle project, replace MNEMONIC_PROD in /.env with it
* fund the first address, make sure it has been funded sufficiently using MyEtherWallet 
* deploy with `truffle migrate --reset --network [NETWORK]`, replace [NETWORK] with the network to deploy to
* flatten Exchange.sol with https://github.com/poanetwork/solidity-flattener and verify on Etherscan with the "Optimization" option set to "yes"
* change the admin addresses (owner, server, feeCollector)
* remove the remaining funds from the single-use address
* re-deploy the server, updating CONTRACT_ADDRESS

# Running the test suite

* clone this repo
* `yarn install`
* create a .env file by copying .env.sample
* start ganache-cli
* truffle test