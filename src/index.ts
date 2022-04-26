import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import { DailyOutput } from './daily_output';
import { getAllTransactionsWithin, getWalletsEligibleForStreak } from './queries';

if (require.main === module) {
	run();
}

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
				.positional('maxBlock', {
					describe: 'The last block to query',
					type: 'number'
				});
		},
		(argv) => {
			const { minBlock, maxBlock } = argv;
			if (!(minBlock && maxBlock)) {
				throw new Error('You must specify the min and max block height to query');
			}
			aggregateOutputData(minBlock, maxBlock);
		}
	);

	yargs.parse();
}

async function aggregateOutputData(minBlock: number, maxBlock: number): Promise<void> {
	const output = new DailyOutput();
	const PSTHolders = await getWalletsEligibleForStreak();
	output.feedPSTHolders(PSTHolders);
	const edges = await getAllTransactionsWithin(minBlock, maxBlock);
	output.feedGQLData(edges);
	output.write();
}
