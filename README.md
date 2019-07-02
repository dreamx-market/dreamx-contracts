# Deployment

## Development:

* rebuild the dev chain by replacing the `chaindata` folder with an empty one, start ganache from it, from the truffle project, deploy the exchange and token contracts with `truffle migrate --reset`, run `/scripts/setup_dev_contract.js`, remove the empty `chaindata` folder, run `mv .chaindata chaindata` to save the new dev chain
* update ENV['CONTRACT_ADDRESS'] in `config/environments/test.rb`
* update the library artifacts in /lib/contract/artifacts and the library code responsible for interacting with the contract to accomodate the new changes

## Production:

* generate a single-use mnemonic seed with ganache-cli, in the truffle project, replace MNEMONIC_PROD in /.env with it, fund the first address, make sure it has been funded sufficiently using MyEtherWallet, deploy with `truffle migrate --reset`, change the admin addresses, remove the remaining funds from the single-use address 

# Running the test suite

* clone this repo
* `yarn install`
* create a .env file by copying .env.sample
* start ganache-cli
* truffle test