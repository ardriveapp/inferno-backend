import { GQLEdgeInterface, GQLTransactionsResultInterface } from 'ardrive-core-js';
import fetch from 'node-fetch';
import { Query, StakedPSTHolders } from './inferno_types';
import { ArDriveCommunityOracle } from './community/ardrive_community_oracle';
import { BLOCKS_PER_MONTH, GQL_URL, ITEMS_PER_REQUEST, VALID_APP_NAMES } from './constants';
import { writeFileSync } from 'fs';
import { getBlockHeight, gqlResultName } from './common';

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
	const communityOracle = new ArDriveCommunityOracle();
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
export async function getAllTransactionsWithin(minBlock: number, maxBlock: number): Promise<GQLEdgeInterface[]> {
	const allEdges: GQLEdgeInterface[] = [];

	const blockHeight = await getBlockHeight();
	const trustedHeight = blockHeight - 50;

	let hasNextPage = true;
	let prevBlock = minBlock - 1;

	while (hasNextPage) {
		const query = createQuery(prevBlock + 1, Math.min(maxBlock, trustedHeight));
		const response = await sendQuery(query);
		const mostRecientTransaction = response.edges[response.edges.length - 1];
		const cursor = +mostRecientTransaction.cursor;
		writeFileSync(gqlResultName(prevBlock + 1, cursor), JSON.stringify(response.edges));
		prevBlock = cursor;
		allEdges.push(...response.edges);
		hasNextPage = response.pageInfo.hasNextPage;
	}

	return allEdges;
}

/**
 * Runs the given GQL query
 * @param query the query object
 * @throws if the GW returns a syntax error
 * @returns {GQLTransactionsResultInterface} the returned transactions
 */
async function sendQuery(query: Query): Promise<GQLTransactionsResultInterface> {
	// TODO: implement retry here
	const response = await fetch(GQL_URL, {
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
	});
	const JSONBody = await response.json();
	const errors: { message: string; extensions: { code: string } } = !JSONBody.data && JSONBody.errors;
	if (errors) {
		console.log(`Error in query: \n${JSON.stringify(query, null, 4)}`);
		throw new Error(errors.message);
	}
	return JSONBody.data.transactions as GQLTransactionsResultInterface;
}

/**
 * Returns a query object to math all ArDrive transactions within a range of blocks
 * @param minBlock an integer representing the block from where to query the data
 * @param maxBlock an integer representing the block until where to query the data
 * @returns
 */
function createQuery(minBlock: number, maxBlock: number): Query {
	return {
		query: `
			query {
				transactions(
					block: { max: ${maxBlock}, min: ${minBlock} }
					first: ${ITEMS_PER_REQUEST}
					tags: [
						{
							name: "App-Name"
							values: [${VALID_APP_NAMES.map((appName) => `"${appName}"`)}]
						}
					]
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
