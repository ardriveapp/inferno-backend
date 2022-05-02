import fs from 'fs';
import { OUTPUT_TEMPLATE_NAME, OUTPUT_NAME } from './constants';
import { WalletsStats } from './inferno_types';

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

export function getMinBlockHeight(): number {
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

export function tiebreakerSortFactory(walletsStats: WalletsStats) {
	return (address_a: string, address_b: string): number => {
		const walletStat_a = walletsStats[address_a];
		const walletStat_b = walletsStats[address_b];
		const volumeDiff = walletStat_a.weekly.byteCount - walletStat_b.weekly.byteCount;
		const tipsDiff = walletStat_a.weekly.tips - walletStat_b.weekly.tips;
		const blockSinceParticipatingDiff =
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			walletStat_a.weekly.blockSinceParticipating! - walletStat_b.weekly.blockSinceParticipating!;
		return volumeDiff || tipsDiff || blockSinceParticipatingDiff;
	};
}
