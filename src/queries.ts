import { GQLEdgeInterface, GQLTransactionsResultInterface } from './gql_Types';
import fetch from 'node-fetch';

const GQL_URL = 'https://arweave.net/graphql';
const ITEMS_PER_REQUEST = 100;
const VALID_APP_NAMES = ['ArDrive-Web', 'ArDrive-CLI', 'ArDrive-Sync'] as const;

interface Query {
	query: string;
}

export interface StakedPSTHolders {
	[address: string]: number;
}

// export async function getStakedPSTHolders(): Promise<StakedPSTHolders> {}

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
	const response = fetch(GQL_URL, {
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
	return (await response).json();
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
				values: ${VALID_APP_NAMES}
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
