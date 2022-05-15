import { GQLEdgeInterface, GQLTransactionsResultInterface } from './gql_types';
import { Query, StakedPSTHolders } from './inferno_types';
import { ArDriveCommunityOracle } from './community/ardrive_community_oracle';
import { BLOCKS_PER_MONTH, GQL_URL, ITEMS_PER_REQUEST, MAX_RETRIES, TIMEOUT, VALID_APP_NAMES } from './constants';
import { getBlockHeight, ardriveOracle } from './common';
import { GQLCache } from './gql_cache';
import fetch from './utils/fetch_with_timeout';
import { HeightRange } from './height_range';

const initialErrorDelayMS = 1000;

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
		let hasNextPage = true;
		let cursor = '';

		console.log('Querying range', nonCachedRange);

		while (hasNextPage) {
			const query = createQuery(nonCachedRange, cursor);
			const response = await sendQuery(query);
			const edges = response.edges;
			hasNextPage = response.pageInfo.hasNextPage;
			console.log(` # Recieved ${edges.length} transactions.`, { hasNextPage });
			if (!edges.length) {
				cache.setEmptyRange(nonCachedRange);
				continue;
			}
			const oldestTransaction = edges[edges.length - 1];
			const mostRecentTransaction = edges[0];
			// to ensure we are querying in descendant order
			new HeightRange(oldestTransaction.node.block.height, mostRecentTransaction.node.block.height);
			cursor = oldestTransaction.cursor;
			await cache.addEdges(edges);
		}
	}

	const allEdges = await cache.getAllEdgesWithinRange();
	return allEdges;
}

/**
 * Runs the given GQL query
 * @param query the query object
 * @throws if the GW returns a syntax error
 * @returns {GQLTransactionsResultInterface} the returned transactions
 */
async function sendQuery(query: Query): Promise<GQLTransactionsResultInterface> {
	let pendingRetries = MAX_RETRIES;
	let responseOk: boolean | undefined;

	while (!responseOk && pendingRetries >= 0) {
		if (pendingRetries !== MAX_RETRIES) {
			const currentRetry = MAX_RETRIES - pendingRetries;
			await exponentialBackOffAfterFailedRequest(currentRetry);
		}

		try {
			const response = await fetch(
				GQL_URL,
				{
					method: 'POST',
					headers: {
						'Accept-Encoding': 'gzip, deflate, br',
						'Content-Type': 'application/json',
						Accept: 'application/json',
						Connection: 'keep-alive',
						DNT: '1',
						Origin: GQL_URL
					},
					body: JSON.stringify(query)
				},
				TIMEOUT
			);

			responseOk = response.ok;

			const JSONBody = (await response.json()) as {
				errors: { message: string; extensions: { code: string } };
				data: { transactions: GQLTransactionsResultInterface };
			};
			const errors = !JSONBody.data && JSONBody.errors;
			if (errors) {
				pendingRetries--;
				continue;
			}
			return JSONBody.data.transactions;
		} catch (e) {
			pendingRetries--;
			continue;
		}
	}
	throw new Error(`Retries on the query failed!`);
}

async function exponentialBackOffAfterFailedRequest(retryNumber: number): Promise<void> {
	const delay = Math.pow(2, retryNumber) * initialErrorDelayMS;
	await new Promise((res) => setTimeout(res, delay));
}

/**
 * Returns a query object to match all ArDrive transactions within a range of blocks
 * @param minBlock an integer representing the block from where to query the data
 * @param maxBlock an integer representing the block until where to query the data
 * @returns
 */
function createQuery(range: HeightRange, cursor = ''): Query {
	return {
		query: `
			query {
				transactions(
					block: { min: ${range.min}, max: ${range.max} }
					first: ${ITEMS_PER_REQUEST}
					tags: [
						{
							name: "App-Name"
							values: [${VALID_APP_NAMES.map((appName) => `"${appName}"`)}]
						}
					]
					sort: HEIGHT_DESC
					after: "${cursor}"
				) {
					pageInfo {
						hasNextPage
					}
					edges {
						cursor
						node {
							id
							owner {
								address
							}
							recipient
							bundledIn {
								id
							}
							tags {
								name
								value
							}
							data {
								size
								type
							}
							quantity {
								winston
							}
							fee {
								winston
							}
							block {
								timestamp
								height
							}
						}
					}
				}
			}`
	};
}
