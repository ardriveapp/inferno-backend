// import { getAllTransactionsWithin } from './queries';

import { getWaleltsEligibleForStreak } from './queries';

// const minBlock = 916705;
// const maxBlock = 916756;

if (require.main === module) {
	console.log('TESTING');

	// getAllTransactionsWithin(minBlock, maxBlock).then((edges) => {
	// 	console.log(JSON.stringify(edges, null, 4));
	// });

	getWaleltsEligibleForStreak().then((result) => console.log('Staked tokens:\n', JSON.stringify(result, null, 4)));
}
