# ezstake

Smart contract for customizable NFT staking using Atomicassets standard.

This contract is designed to work out-of-the-box, without the need to modify the source code.

All the main features are fully configurable by the contract owner.

## Features

#### For the admin:

-   customizable configurations:
    -   token contract and symbol
    -   minimum claim period
    -   unstaking period
    -   hourly rate per template
    -   per template control
-   freeze/unfreeze the contract functionalities
-   force reset/unstake user's assets

#### For the user:

-   register
-   stake/unstake the assets
-   claim the tokens

## Testing

The contract is fully tested using proton's [VeRT](https://docs.protonchain.com/contract-sdk/testing.html)

-   To build the contract for testing [blanc](https://github.com/haderech/blanc) is required.

```bash
npm install # or yarn or pnpm
npm run build:dev # to compile the contract using blanc++
npm test
```

## Deployment

-   To build & deploy the contract, both of the Antelope [cdt](https://github.com/AntelopeIO/cdt) and [leap](https://github.com/AntelopeIO/leap) are required.

```bash
npm build:prod # to compile the contract using cdt-cpp

# deploy the contract
cleos -u <your_api_endpoint> set contract <account> $PWD contract/ezstake.wasm contract/ezstake.abi -p <account>@active

# dont forget to add eosio.code permission
cleos -u <your_api_endpoint> set account permission <account> active --add-code
```

## Want more features ?

_Hire me_ ;)

[![Discord Badge](https://img.shields.io/static/v1?message=Discord&label=Benjie%235458&style=flat&logo=discord&color=7289da&logoColor=7289da)](https://discordapp.com/users/789556474002014219)
[![Telegram Badge](https://img.shields.io/static/v1?message=Telegram&label=benjie_wh&style=flat&logo=telegram&color=229ED9)](https://t.me/benjie_wh)
[![Protonmail Badge](https://img.shields.io/static/v1?message=Email&label=ProtonMail&style=flat&logo=protonmail&color=6d4aff&logoColor=white)](mailto:benjiewheeler@protonmail.com)
[![Github Badge](https://img.shields.io/static/v1?message=Github&label=benjiewheeler&style=flat&logo=github&color=171515)](https://github.com/benjiewheeler)
