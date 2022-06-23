# Inferno backend

The backend of the Inferno Rewards project. It's intended to determine the awarded addresses and to distribute the weekly rewards to them.

## Setup

Install dependencies

-   [nvm](https://github.com/nvm-sh/nvm/blob/master/README.md)

Then run:

```sh
$ nvm install && nvm use
$ npm add -g yarn
$ yarn && yarn build
```

At this point you will have a directory at `./lib`, there will be the compiled JS files.

## Cache

The folder `./cache` contains the immutable cached blocks returned from the GQL query. Every time you run the `aggregate` command, the non-cached blocks will be added there.

## Run the aggregation proccess

You can call the built in script by running:

```sh
$ yarn node ./lib/index.js aggregate
```

to aggregate data since the previously aggregated block (specified at `./daily_output.json`, defaults to the height specified at `./daily_output.base.json` if not present) until the current height.

Or you can specify a custom height range by passing them as positional arguments:

```sh
$ yarn node ./lib/index.js aggregate <minBlock> <maxBlock>
```

You will simply have to ensure that the `minBlock` is greater or equal than the previously aggregated block.

### Output file

The `daily_output.json` is what the Leaderboard takes as source of data, and is written each time the aggregation process suceeds running. It is updated by the ArDrive team at the public file with ID: `7fa5d4e3-0087-422a-acb3-2e481d98d08b`.

You can check for the file info by doing:

```sh
$ ardrive file-info -f 7fa5d4e3-0087-422a-acb3-2e481d98d08b
{
    "appName": "ArDrive-CLI",
    "appVersion": "1.13.0",
    "arFS": "0.11",
    "contentType": "application/json",
    "driveId": "a721a0cf-0162-4514-aa97-f6b4771a8fd2",
    "entityType": "file",
    "name": "daily_output.json",
    "txId": "6i8RhIf5Hkra5pOSTIRYkdm8_VZ6SQ75MZmTwaHhpxU",
    "unixTime": 1651811275,
    "size": 116219,
    "lastModifiedDate": 1651811208184,
    "dataTxId": "a0lzr7zVuf6irrOpjVTyyf6ZNUH1MQRkXG9814lGTCM",
    "dataContentType": "application/json",
    "parentFolderId": "d62a47c3-0b9d-4442-ac72-252a239d0469",
    "entityId": "7fa5d4e3-0087-422a-acb3-2e481d98d08b",
    "fileId": "7fa5d4e3-0087-422a-acb3-2e481d98d08b"
}
```

or download the file:

```sh
ardrive download-file -f 7fa5d4e3-0087-422a-acb3-2e481d98d08b
```

The basic JSON schema:

```ts
interface OutputData {
    // The timestamp for when the data aggregation has run
    lastUpdated: number;

    // The last block height read
    blockHeight: number;

    // The last block's timestamp read
    timestamp: number;

    // PST Holders' staked tokens
    PSTHolders: StakedPSTHolders;

    // Per wallet stats
    wallets: WalletsStats;

    ranks: Ranks;
}
```

For more information about the file schema please see: `./src/inferno_types.ts`.

## Rewards distribution

You can use ´distribute´ command to automatically create and post transactions for each wallet that won a rewards.
The script checks last week rank and rewards and it should be ran after the reward cycle ends.
By default the script runs in dry mode only creating and printing the created transactions in the terminal. To be able to send you need to add a `--confirm` flag. Is recommended to first run the script in dry run mode to manually check the output and only after run with `--confirm` flag to create and post the transactions.

First you need to download the latest version of the rank, running on the root folder of this project:

```sh
$ ardrive download-file -f 7fa5d4e3-0087-422a-acb3-2e481d98d08b
```

After that you need to identify which wallet will sign and post the transactions. For that you will need to call the script with a environment variable called ´KEYFILE´.

```sh
$ export KEYFILE=path/to/a/json/keyfile
```

Providing both dependencies it's time to run the `distribute` command:

```sh
$ yarn node ./lib/index.js distribute
```

After a careful manual check you can finally run:

```sh
$ yarn node ./lib/index.js distribute --confirm
```
