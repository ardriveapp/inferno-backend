import fs from 'fs';
import { OUTPUT_TEMPLATE_NAME, OUTPUT_NAME } from './constants';
import { WalletsStats } from './inferno_types';
import Arweave from 'arweave';
import { defaultGatewayHost, defaultGatewayPort, defaultGatewayProtocol } from './utils/constants';

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

/**
 * A factory function that returns the sort algorithm to apply the following tiebreakers:
 * - by total upload volume
 * - by total tips sent
 * - by block since participating (i.e. has reached the minimum weekly data)
 */
export function tiebreakerSortFactory(timeframe: 'weekly' | 'total', walletsStats: WalletsStats) {
	return (address_a: string, address_b: string): number => {
		const walletStat_a = walletsStats[address_a];
		const walletStat_b = walletsStats[address_b];
		const volumeDiff = walletStat_b[timeframe].byteCount - walletStat_a[timeframe].byteCount;
		const tipsDiff = walletStat_b[timeframe].tips - walletStat_a[timeframe].tips;
		const blockSinceParticipatingDiff = (function () {
			if (walletStat_a[timeframe].blockSinceParticipating === walletStat_b[timeframe].blockSinceParticipating) {
				return 0;
			}
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			return (
				(walletStat_a[timeframe].blockSinceParticipating || Number.POSITIVE_INFINITY) -
				(walletStat_b[timeframe].blockSinceParticipating || Number.POSITIVE_INFINITY)
			);
		})();
		return volumeDiff || tipsDiff || blockSinceParticipatingDiff;
	};
}

export function calculateTipPercentage(fee: number, boostValue: number, tip: number): number {
	const unboostedFee = fee / boostValue;
	const tipPercentage = tip / unboostedFee;
	return tipPercentage * 100;
}

export const arweave = Arweave.init({
	host: defaultGatewayHost,
	port: defaultGatewayPort,
	protocol: defaultGatewayProtocol,
	timeout: 600000
});
