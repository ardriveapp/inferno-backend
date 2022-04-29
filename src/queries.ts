import { GQLEdgeInterface, GQLTransactionsResultInterface } from './gql_types';
import Axios from 'axios';
import { Query, StakedPSTHolders } from './inferno_types';
import { ArDriveCommunityOracle } from './community/ardrive_community_oracle';
import { BLOCKS_PER_MONTH, GQL_URL, ITEMS_PER_REQUEST, MAX_RETRIES, VALID_APP_NAMES } from './constants';
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
		if (response.edges.length) {
			console.log(`Transactions count: ${response.edges.length}`);
			const mostRecientTransaction = response.edges[response.edges.length - 1];
			const height = mostRecientTransaction.node.block.height;
			writeFileSync(gqlResultName(prevBlock + 1, height), JSON.stringify(response.edges));
			prevBlock = height;
			allEdges.push(...response.edges);
			hasNextPage = response.pageInfo.hasNextPage;
			console.log(`Query has next page: ${hasNextPage}`);
		} else {
			console.log(`Ignoring empty GQL response`);
			hasNextPage = false;
		}
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
	let pendingRetries = MAX_RETRIES;
	let responseOk: boolean | undefined;

	while (!responseOk && pendingRetries >= 0) {
		const response = await Axios.request({
			method: 'POST',
			url: GQL_URL,
			headers: {
				'Accept-Encoding': 'gzip, deflate, br',
				'Content-Type': 'application/json',
				Accept: 'application/json',
				Connection: 'keep-alive',
				DNT: '1',
				Origin: GQL_URL
			},
			data: JSON.stringify(query)
		});
		responseOk = response.status >= 200 && response.status < 300;

		try {
			const JSONBody = response.data;
			const errors: { message: string; extensions: { code: string } } = !JSONBody.data && JSONBody.errors;
			if (errors) {
				console.log(`Error in query: \n${JSON.stringify(query, null, 4)}`);
				throw new Error(JSON.stringify(errors));
			}
			// console.log(`Query result: ${JSON.stringify(JSONBody, null, '\t')}`);
			return JSONBody.data.transactions as GQLTransactionsResultInterface;
		} catch (e) {
			pendingRetries--;
			console.log(`Error while querying. Retrying (${pendingRetries}). ${JSON.stringify(e)}`);
			continue;
		}
	}
	throw new Error(`Retries on the query failed!`);
}

/**
 * Returns a query object to match all ArDrive transactions within a range of blocks
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
					sort: HEIGHT_ASC
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
