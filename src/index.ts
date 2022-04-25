import { DailyOutput } from './daily_output';
import { getAllTransactionsWithin, getWaleltsEligibleForStreak } from './queries';

const minBlock = 916705;
const maxBlock = 916756;

if (require.main === module) {
	console.log('TESTING');

	const output = new DailyOutput();
	getWaleltsEligibleForStreak().then((PSTHolders) => {
		output.feedPSTHolders(PSTHolders);
		getAllTransactionsWithin(minBlock, maxBlock).then((edges) => {
			output.feedGQLData(edges);
			output.write();
		});
	});
}
