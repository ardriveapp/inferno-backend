import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import { DailyOutput } from './daily_output';
import { getAllTransactionsWithin, getWalletsEligibleForStreak } from './queries';

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
	yargs(hideBin(process.argv)).command(
		'aggregate [minBlock] [maxBlock]',
		'Aggregates data into the output file',
		(yargs) => {
			return yargs
				.positional('minBlock', {
					describe: 'The block from where to start the query',
					type: 'number'
				})
				.demandOption('minBlock')
				.positional('maxBlock', {
					describe: 'The last block to query',
					type: 'number'
				})
				.demandOption('maxBlock');
		},
		(argv) => {
			const { minBlock, maxBlock } = argv;
			aggregateOutputData(minBlock, maxBlock);
		}
	);

	yargs.parse();
}

/**
 * The method that runs the data aggregation algorithm
 * @param minBlock an integer representing the block from where to query the data
 * @param maxBlock an integer representing the block until where to query the data
 */
async function aggregateOutputData(minBlock: number, maxBlock: number): Promise<void> {
	const output = new DailyOutput([minBlock, maxBlock]);
	const PSTHolders = await getWalletsEligibleForStreak();
	await output.feedPSTHolders(PSTHolders);
	const edges = await getAllTransactionsWithin(minBlock, maxBlock);
	await output.feedGQLData(edges);
	output.write();
}
