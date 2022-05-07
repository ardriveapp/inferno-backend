import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import { DailyOutput } from './daily_output';
import { getAllArDriveTransactionsWithin, getWalletsEligibleForStreak } from './queries';
import { getBlockHeight, getMinBlockHeight } from './common';
import { LoggerFactory } from 'redstone-smartweave';
import { createTransactions, sendTokens } from './distribution';

/**
 * A Python-like approach to determine if the JS code is running this exact module, and not being imported
 * 🐍🐍🐍
 */
if (require.main === module) {
	// supress the redstone debug logging
	LoggerFactory.INST.setOptions({
		type: 'json',
		displayFilePath: 'hidden',
		displayInstanceName: false,
		minLevel: 'error'
	});

	// run the main method
	run();
} else {
	throw new Error('This module should not be imported');
}

/**
 * The main method. It handles the CLI commands and parameters
 */
function run(): void {
	yargs(hideBin(process.argv))
		.command(
			'aggregate [minBlock] [maxBlock]',
			'Aggregates data into the output file',
			(yargs) => {
				return yargs
					.positional('minBlock', {
						describe: 'The block from where to start the query',
						type: 'number'
					})
					.positional('maxBlock', {
						describe: 'The last block to query',
						type: 'number'
					});
			},
			(argv) => {
				const { minBlock, maxBlock } = argv;
				aggregateOutputData(minBlock, maxBlock);
			}
		)
		.command(
			'distribute [distributionType]',
			'Distribute weekly or streak rewards',
			(yargs) => {
				return yargs
					.positional('distributionType', {
						describe: 'Weekly or Streak',
						requiresArg: true,
						type: 'string'
					})
					.option('confirm', {
						describe: 'Actually send transactions',
						type: 'boolean'
					});
			},
			(argv) => {
				const { distributionType, confirm } = argv;
				distributeTokens(distributionType as 'weekly' | 'streak' | undefined, confirm);
			}
		);

	yargs.parse();
}

/**
 * The method that runs the data aggregation algorithm
 * @param minBlock an integer representing the block from where to query the data
 * @param maxBlock an integer representing the block until where to query the data
 */
async function aggregateOutputData(minBlock?: number, maxBlock?: number): Promise<void> {
	const minimumBlock = minBlock ?? getMinBlockHeight();
	const maximumBlock = maxBlock ?? (await getBlockHeight());
	const output = new DailyOutput([minimumBlock, maximumBlock]);
	const PSTHolders = await getWalletsEligibleForStreak();
	await output.feedPSTHolders(PSTHolders);
	const edges = await getAllArDriveTransactionsWithin(minimumBlock, maximumBlock);
	await output.feedGQLData(edges);
	output.write();
}

/**
 * The method that distribute the tokens
 * @param distributionType an string representing which distribution will be made (weekly or streak)
 * @param confirm a boolean confirmim that it should actually send the transactions
 */
async function distributeTokens(distributionType?: 'weekly' | 'streak', confirm?: boolean) {
	if (distributionType === 'weekly') {
		const transactions = await createTransactions(distributionType);

		if (!confirm) {
			transactions?.forEach(async (transaction) => {
				const { id, target, qty } = await transaction;
				console.log({ txId: id, target, qty });
			});

			return;
		}

		if (transactions) {
			await sendTokens(transactions);
		}
	}
}
