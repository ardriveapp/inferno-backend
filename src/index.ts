import { DailyOutput } from './daily_output';
import { getAllTransactionsWithin, getWalletsEligibleForStreak } from './queries';

const minBlock = 916705;
const maxBlock = 916756;

if (require.main === module) {
	console.log('TESTING');

	const output = new DailyOutput();
	getWalletsEligibleForStreak().then((PSTHolders) => {
		output.feedPSTHolders(PSTHolders);
		getAllTransactionsWithin(minBlock, maxBlock).then((edges) => {
			output.feedGQLData(edges);
			output.write();
		});
	});
}
