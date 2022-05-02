import fs from 'fs';
import { OUTPUT_TEMPLATE_NAME, OUTPUT_NAME } from './constants';

export function gqlResultName(minBlock: number, maxBlock: number): string {
	return `gql_result_${minBlock}-${maxBlock}.json`;
}

let _cachedBlockHeight: number | undefined;
export async function getBlockHeight(): Promise<number> {
	if (_cachedBlockHeight) {
		return _cachedBlockHeight;
	}
	const blockHeightRequest = await fetch('https://arweave.net/height');
	const blockHeightBlob = await blockHeightRequest.blob();
	const blockHeightText = await blockHeightBlob.text();
	const blockHeight = +blockHeightText;
	return (_cachedBlockHeight = blockHeight);
}

export function getMinBlockHeigh(): number {
	const hasOutputFile = fs.existsSync(OUTPUT_NAME);

	const fileToCheck = hasOutputFile ? OUTPUT_NAME : OUTPUT_TEMPLATE_NAME;

	const file = JSON.parse(fs.readFileSync(fileToCheck).toString());
	return file.blockHeight + 1;
}

export function getLastTimestamp(): number {
	const hasOutputFile = fs.existsSync(OUTPUT_NAME);

	const fileToCheck = hasOutputFile ? OUTPUT_NAME : OUTPUT_TEMPLATE_NAME;

	const file = JSON.parse(fs.readFileSync(fileToCheck).toString());
	return file.timestamp;
}
