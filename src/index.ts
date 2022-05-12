import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import { DailyOutput } from './daily_output';
import { getAllArDriveTransactionsWithin, getWalletsEligibleForStreak } from './queries';
import { getBlockHeight, getMinBlockHeight } from './common';
import { distributeTokens } from './distribute';

/**
 * A Python-like approach to determine if the JS code is running this exact module, and not being imported
 * 🐍🐍🐍
 */
if (require.main === module) {
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
			'distribute',
			'Distribute weekly rewards',
			(yargs) => {
				return yargs.option('confirm', {
					describe: 'confirm the token distribution',
					default: false,
					type: 'boolean'
				});
			},
			(argv) => {
				const { confirm } = argv;
				distributeTokens(confirm);
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
