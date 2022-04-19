import { getAllTransactionsWithin } from './queries';

const minBlock = 916705;
const maxBlock = 916756;

console.log('TESTING');

getAllTransactionsWithin(minBlock, maxBlock).then((edges) => {
	console.log(JSON.stringify(edges, null, 4));
});
