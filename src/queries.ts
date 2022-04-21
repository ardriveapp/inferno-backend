import { GQLEdgeInterface, GQLTransactionsResultInterface } from './gql_types';
import fetch from 'node-fetch';
import { OutputData, Query, StakedPSTHolders } from './types';

const GQL_URL = 'https://arweave.net/graphql';
const ITEMS_PER_REQUEST = 100;
const VALID_APP_NAMES = ['ArDrive-Web', 'ArDrive-CLI', 'ArDrive-Sync'] as const;

const BLOCKS_PER_MONTH = 21600;

export async function getWaleltsEligibleForStreak(): Promise<StakedPSTHolders> {
	return getStakedPSTHolders()
		.then((result) => Object.entries(result))
		.then((entries) => entries.filter((data) => data[1] >= 200))
		.then((entries) => Object.fromEntries(entries));
}

async function getStakedPSTHolders(): Promise<StakedPSTHolders> {
	const blockHeightRequest = await fetch('https://arweave.net/height');
	const blockHeightBlob = await blockHeightRequest.blob();
	const blockHeightText = await blockHeightBlob.text();
	const blockHeight = +blockHeightText;
	const pstRequest = await fetch('https://v2.cache.verto.exchange/-8A6RexFkpfWwuyVO98wzSFZh0d6VJuI-buTJvlwOJQ');
	const {
		state: { vault }
	} = await pstRequest.json();
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

export async function transformData(): Promise<OutputData> {
	const data: OutputData = {
		blockHeight: 0,
		timestamp: Date.now(),
		PSTHolders: {},
		wallets: {},
		ranks: {
			daily: {
				// True only when at least 50 wallets has uploaded 50 GIB
				hasReachedMinimumGroupEffort: false,

				// Is an array of 50 elements for the Wallet Addres and earned ARDRIVE tokens
				groupEffortRewards: [],

				// An array of addresses in streak, and the earned ARDRIVE tokens
				streakRewards: []
			},
			weekly: {
				// True only when at least 50 wallets has uploaded 50 GIB
				hasReachedMinimumGroupEffort: false,

				// Is an array of 50 elements for the Wallet Addres and earned ARDRIVE tokens
				groupEffortRewards: [],

				// An array of addresses in streak, and the earned ARDRIVE tokens
				streakRewards: []
			},
			lastWeek: {
				// True only when at least 50 wallets has uploaded 50 GIB
				hasReachedMinimumGroupEffort: false,

				// Is an array of 50 elements for the Wallet Addres and earned ARDRIVE tokens
				groupEffortRewards: [],

				// An array of addresses in streak, and the earned ARDRIVE tokens
				streakRewards: []
			},
			total: {
				// Is an array of 50 elements for the Wallet Addres and earned ARDRIVE tokens
				groupEffortRewards: [],

				// An array of addresses in streak, and the earned ARDRIVE tokens
				streakRewards: []
			}
		}
	};
	throw new Error('Unimplemented!');
	return data;
}

export async function getAllTransactionsWithin(minBlock: number, maxBlock: number): Promise<GQLEdgeInterface[]> {
	const allEdges: GQLEdgeInterface[] = [];
	let hasNextPage = true;

	while (hasNextPage) {
		const query = createQuery(minBlock, maxBlock);
		const response = await sendQuery(query);
		allEdges.push(...response.edges);
		hasNextPage = response.pageInfo.hasNextPage;
	}

	return allEdges;
}

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
						}
					}
				}
			}`
	};
}
