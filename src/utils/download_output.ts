import { GQL_URL, gatewayUrl } from '../constants';
import type { OutputData } from '../inferno_types';

const ownerAddress = 'ZPe6CJ9fqcXZakrV6KQmxOdncfxBOO0v7maNVV0DQGQ';
const fileId = '7fa5d4e3-0087-422a-acb3-2e481d98d08b';

const GQLQuery = `
query {
	transactions(
		first: 1
		owners: ["${ownerAddress}"]
		tags: [{
			name: "File-Id"
			values: "${fileId}"
		}]
		sort: HEIGHT_DESC
	)
	{
		edges {
			node {
				id
			}
		}
	}
}
`;

type GQLResponseType = {
	data: {
		transactions: {
			edges: [
				{
					node: {
						id: string;
					};
				}
			];
		};
	};
};

async function sendGQLQuery(): Promise<GQLResponseType> {
	const response = await fetch(GQL_URL, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({ query: GQLQuery })
	});
	return response.json();
}

function getMetadataTx(gqlResponse: GQLResponseType): string {
	const responseData = gqlResponse.data.transactions.edges[0].node;
	return responseData.id;
}

async function getDataTxId(metadataTxId: string): Promise<string> {
	const response = await fetch(`${gatewayUrl}/${metadataTxId}`);
	const metadata = await response.json();
	return metadata.dataTxId;
}

async function getData(dataTxId: string): Promise<OutputData> {
	const response = await fetch(`${gatewayUrl}/${dataTxId}`);
	return response.json();
}

export async function downloadOutputFile() {
	const gqlResponse = await sendGQLQuery();
	const metadataTxId = getMetadataTx(gqlResponse);

	const dataTxId = await getDataTxId(metadataTxId);
	const data = await getData(dataTxId);

	return data;
}
