import { existsSync, readFileSync } from 'fs';
import { ArDriveContractOracle } from './community/ardrive_contract_oracle';
import { RedstoneContractReader } from './community/redstone_contract_reader';
import { SmartweaveContractReader } from './community/smartweave_contract_oracle';
import { OUTPUT_TEMPLATE_NAME, OUTPUT_NAME, BOOST_TAG, APP_NAME_TAG, APP_VERSION_TAG, WEB_APP_NAME } from './constants';
import { WalletsStats, WalletStatEntry } from './inferno_types';
import Arweave from 'arweave';
import { defaultGatewayHost, defaultGatewayPort, defaultGatewayProtocol } from './utils/constants';
import { GQLNodeInterface, GQLEdgeInterface } from './gql_types';
import { OutputData } from './inferno_types';

const EPSILON = 0.1;

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

/**
 * @returns the content of the JSON template or output file
 */
export function readInitialOutputFile(): OutputData {
	const hasOutputFile = existsSync(OUTPUT_NAME);
	const fileToCheck = hasOutputFile ? OUTPUT_NAME : OUTPUT_TEMPLATE_NAME;

	const data = (() => {
		try {
			return JSON.parse(readFileSync(fileToCheck).toString());
		} catch (err) {
			const message = (err instanceof Error && err.message) || JSON.stringify(err);
			throw new Error(`The file contains non-json data. ${message}`);
		}
	})();
	if (!validateDataStructure(data)) {
		throw new Error(`The output JSON has a wrong structure`);
	}

	return data;
}

/**
 * @returns the content of the JSON output file
 */
export function readOutputFile(): OutputData {
	const data = (() => {
		try {
			return JSON.parse(readFileSync(OUTPUT_NAME).toString());
		} catch (err) {
			const message = (err instanceof Error && err.message) || JSON.stringify(err);
			throw new Error(`The file contains non-json data. ${message}`);
		}
	})();
	if (!validateDataStructure(data)) {
		throw new Error(`The output JSON has a wrong structure`);
	}

	return data;
}

/**
 * @returns the content of the JSON template file
 */
export function readOutputTemplateFile(): OutputData {
	const data = (() => {
		try {
			return JSON.parse(readFileSync(OUTPUT_TEMPLATE_NAME).toString());
		} catch (err) {
			const message = (err instanceof Error && err.message) || JSON.stringify(err);
			throw new Error(`The file contains non-json data. ${message}`);
		}
	})();
	if (!validateDataStructure(data)) {
		throw new Error(`The output JSON has a wrong structure`);
	}

	return data;
}

/**
 * Validates certain object to match the schema of the OutputData
 * @param data a JSON object
 * @returns true if the data is OutputData
 */
export function validateDataStructure(data: unknown): data is OutputData {
	const dataAsOutputData = data as OutputData;
	return !!(
		dataAsOutputData.lastUpdated &&
		dataAsOutputData.PSTHolders &&
		dataAsOutputData.blockHeight &&
		dataAsOutputData.timestamp &&
		validateWalletsStructure(dataAsOutputData.wallets) &&
		dataAsOutputData.ranks &&
		dataAsOutputData.ranks.daily &&
		dataAsOutputData.ranks.weekly &&
		dataAsOutputData.ranks.lastWeek &&
		dataAsOutputData.ranks.total
	);
}

export function validateWalletsStructure(wallets: unknown): wallets is WalletsStats {
	const walletsAsWalletsStats = wallets as WalletsStats;
	const walletsInGoodShape =
		walletsAsWalletsStats &&
		Object.keys(walletsAsWalletsStats).reduce((isInGoodShape, address) => {
			const walletData = walletsAsWalletsStats[address];
			const currentWalletInGoodShape =
				validateWalletStatStructure(walletData.daily) &&
				validateWalletStatStructure(walletData.yesterday) &&
				validateWalletStatStructure(walletData.weekly) &&
				validateWalletStatStructure(walletData.lastWeek) &&
				validateWalletStatStructure(walletData.total);
			return isInGoodShape && currentWalletInGoodShape;
		}, true);
	return walletsInGoodShape;
}

export function validateWalletStatStructure(data: unknown): data is WalletStatEntry {
	const walletStat = data as WalletStatEntry;
	return (
		walletStat &&
		Number.isInteger(walletStat.byteCount) &&
		typeof walletStat.changeInPercentage === 'number' &&
		!isNaN(walletStat.changeInPercentage) &&
		Number.isInteger(walletStat.fileCount) &&
		Number.isInteger(walletStat.rankPosition) &&
		Number.isInteger(walletStat.tokensEarned)
	);
}

export function getMinBlockHeight(): number {
	const file = readInitialOutputFile();

	return file.blockHeight + 1;
}

export function getLastTimestamp(): number {
	const file = readInitialOutputFile();

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

export const ardriveOracle = new ArDriveContractOracle([
	new RedstoneContractReader(arweave),
	new SmartweaveContractReader(arweave)
]);

export async function validateTxTip(node: GQLNodeInterface, ardriveOracle: ArDriveContractOracle): Promise<boolean> {
	const tags = node.tags;
	const boostValue = +(tags.find((tag) => tag.name === BOOST_TAG)?.value || '1');
	const appName = tags.find((tag) => tag.name === APP_NAME_TAG)?.value;
	const appVersion = tags.find((tag) => tag.name === APP_VERSION_TAG)?.value;
	const bundledIn = node.bundledIn;
	const isV2Tx = !bundledIn;
	if (appName === WEB_APP_NAME && appVersion && !isSemanticVersionGreaterThan(appVersion, '1.14.1') && isV2Tx) {
		// we ignore web v2 transactions' tip as it's not possible to validate
		return true;
	}
	const fee = +node.fee.winston;
	const tip = +node.quantity.winston;
	const tipPercentage = calculateTipPercentage(fee, boostValue, tip);
	const height = node.block.height;
	const tipRecipientAddress = node.recipient;
	const wasValidTipRecipient = await ardriveOracle.wasValidPSTHolder(height, tipRecipientAddress);

	// we are using EPSILON here to have a minimum range of error acceptance
	return tipPercentage + EPSILON >= 15 && wasValidTipRecipient;
}

/**
 * returns true if the first version string is greater than the latter
 * @param appVersion_a a string representing a semantic version
 * @param appVersion_b a string representing a semantic version
 */
export function isSemanticVersionGreaterThan(appVersion_a: string, appVersion_b: string): boolean {
	const [major_a, minor_a, patch_a] = appVersion_a.split('.').map((version) => +version);
	const [major_b, minor_b, patch_b] = appVersion_b.split('.').map((version) => +version);

	// calculate the diffs
	const majorVersionDiff = major_a - major_b;
	const minorVersionDiff = minor_a - minor_b;
	const patchVersionDiff = patch_a - patch_b;

	// iterate from major, to minor and then patch
	for (const versionDiff of [majorVersionDiff, minorVersionDiff, patchVersionDiff]) {
		if (versionDiff !== 0) {
			// the currently iterated version number is different between the inputs
			// if the diff is greater, then the version is greater; smaller otherwise
			return versionDiff > 0;
		}
	}

	// the two versions are the same
	return false;
}

export function daysDiffInEST(prev: Date, curr: Date): number {
	const prevEstDate = dateToEST(prev);
	const currEstDate = dateToEST(curr);

	let daysCount = 0;
	const cursorDate = new Date(prevEstDate.getTime());
	cursorDate.setHours(0);
	cursorDate.setMinutes(0);
	cursorDate.setSeconds(0);
	cursorDate.setMilliseconds(0);

	while (currEstDate.getTime() > cursorDate.getTime()) {
		const cursorDay = cursorDate.getDate();
		cursorDate.setDate(cursorDay + 1);
		if (cursorDate.getTime() < currEstDate.getTime()) {
			daysCount++;
		}
	}

	if (daysCount) {
		console.log(`Difference in days between ${prevEstDate} and ${currEstDate}: ${daysCount}`);
	}

	return daysCount;
}

export function weeksDiffInEST(prev: Date, curr: Date): number {
	const prevEstDate = dateToEST(prev);
	const currEstDate = dateToEST(curr);

	let weeksCount = 0;
	const cursorDate = dateToSunday(prevEstDate);

	while (currEstDate.getTime() > cursorDate.getTime()) {
		const cursorDay = cursorDate.getDate();
		const daysPerWeek = 7;
		cursorDate.setDate(cursorDay + daysPerWeek);
		if (cursorDate.getTime() < currEstDate.getTime()) {
			weeksCount++;
		}
	}

	if (weeksCount) {
		console.log(`Difference in weeks between ${prevEstDate} and ${currEstDate}: ${weeksCount}`);
	}

	return weeksCount;
}

export function dateToSunday(date: Date) {
	const dayOfWeek = date.getDay();
	const newDate = new Date(date.getTime());
	newDate.setDate(newDate.getDate() - dayOfWeek);
	newDate.setHours(0);
	newDate.setMinutes(0);
	newDate.setSeconds(0);
	newDate.setMilliseconds(0);
	return newDate;
}

export function dateToEST(d: Date): Date {
	const date = dateToUTC(d);
	const easternTimeOffset = -240; // for dayLight saving, Eastern time become 4 hours behind UTC thats why its offset is -4x60 = -240 minutes. So when Day light is not active the offset will be -300
	date.setMinutes(date.getMinutes() + easternTimeOffset);
	return date;
}

export function dateToUTC(d: Date): Date {
	const date = new Date(d.getTime());
	const offset = date.getTimezoneOffset(); // getting offset to make time in gmt+0 zone (UTC) (for gmt+5 offset comes as -300 minutes)
	date.setMinutes(date.getMinutes() + offset); // date now in UTC time
	return date;
}

export function heightAscSortFunction(edge_a: GQLEdgeInterface, edge_b: GQLEdgeInterface): number {
	return edge_a.node.block.height - edge_b.node.block.height;
}

export function changeInPercentage(prev: number, curr: number): number {
	if (prev === 0) {
		if (curr === 0) {
			// Both zero, there's no change
			return 0;
		} else {
			// Previous is zero, current is greater: 100% change
			return 1;
		}
	} else {
		return (curr - prev) / prev;
	}
}
