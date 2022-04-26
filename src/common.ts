export function gqlResultName(minBlock: number, maxBlock: number): string {
	return `gql_result_${minBlock}-${maxBlock}.json`;
}

let _blockHeight: number | undefined;
export async function getBlockHeight(): Promise<number> {
	if (_blockHeight) {
		return _blockHeight;
	}
	const blockHeightRequest = await fetch('https://arweave.net/height');
	const blockHeightBlob = await blockHeightRequest.blob();
	const blockHeightText = await blockHeightBlob.text();
	const blockHeight = +blockHeightText;
	return (_blockHeight = blockHeight);
}
