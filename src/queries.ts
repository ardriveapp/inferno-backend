import { GQLEdgeInterface } from './gql_types';
import { StakedPSTHolders } from './inferno_types';
import { ArDriveCommunityOracle } from './community/ardrive_community_oracle';
import { BLOCKS_PER_MONTH } from './constants';
import { getBlockHeight, ardriveOracle } from './common';
import { GQLCache } from './gql_cache';
import { HeightRange } from './height_range';
import { getAllParsedTransactionsOfBlock } from './queries_layer_1';
import { ardriveTxFilter } from './utils/layer_one_helpers';

/**
 * Filters the result of getStakedPSTHolders in order to get the holders that staked at least ↁ200
 * @returns {Promise<StakedPSTHolders>}
 */
export async function getWalletsEligibleForStreak(): Promise<StakedPSTHolders> {
	return getStakedPSTHolders()
		.then((result) => Object.entries(result))
		.then((entries) => entries.filter((data) => data[1] >= 200))
		.then((entries) => Object.fromEntries(entries));
}

/**
 * Queries for all PST holders that staked tokens for at least 21600 blocks
 * @returns {Promise<StakedPSTHolders>}
 */
async function getStakedPSTHolders(): Promise<StakedPSTHolders> {
	const blockHeight = await getBlockHeight();
	const communityOracle = new ArDriveCommunityOracle(ardriveOracle);
	const vault = await communityOracle.getArdriveVaults();
	const vaultAsArray = Object.entries(vault) as [string, Array<{ balance: number; start: number; end: number }>][];
	const stakedForAtLeastOneMonth = vaultAsArray.map(([address, locks]) => [
		address,
		locks.reduce((accumulator, currentValue) => {
			const start = currentValue.start;
			const end = currentValue.end;
			const lockedForAtLeastAMonth = blockHeight - start >= BLOCKS_PER_MONTH;
			const isStillLocked = end >= blockHeight;
			if (lockedForAtLeastAMonth && isStillLocked) {
				return accumulator + currentValue.balance;
			}
			return accumulator;
		}, 0)
	]);
	return Object.fromEntries(stakedForAtLeastOneMonth);
}

/**
 * Queries GQL for all ArDrive transactions within a range of blocks
 * @param minBlock an integer representing the block from where to query the data
 * @param maxBlock an integer representing the block until where to query the data
 * @returns {Promise<GQLEdgeInterface[]>} the edges of the GQL result
 */
export async function getAllArDriveTransactionsWithin(range: HeightRange): Promise<GQLEdgeInterface[]> {
	const cache = new GQLCache(range);
	const nonCachedRanges = cache.getNonCachedRangesWithin().reverse();

	console.log('Height ranges to query are', nonCachedRanges.length);

	for (const nonCachedRange of nonCachedRanges) {
		let height = nonCachedRange.min;

		console.log('Querying range', nonCachedRange);

		while (height <= nonCachedRange.max) {
			const edges = await getAllParsedTransactionsOfBlock(height);
			const ardriveEdges = edges.filter(ardriveTxFilter);
			console.log(` # Recieved ${ardriveEdges.length} transactions.`, { height });

			height++;

			if (!ardriveEdges.length) {
				cache.setEmptyRange(new HeightRange(height, height));
				continue;
			}

			// to ensure we are querying in descendant order
			const oldestTransaction = ardriveEdges[ardriveEdges.length - 1];
			const mostRecentTransaction = ardriveEdges[0];
			new HeightRange(oldestTransaction.node.block.height, mostRecentTransaction.node.block.height);

			await cache.addEdges(ardriveEdges);
		}
	}
	cache.done();
	const allEdges = await cache.getAllEdgesWithinRange();
	return allEdges;
}
