import { WalletStatEntry } from './inferno_types';

export const OUTPUT_TEMPLATE_NAME = 'daily_output.base.json';
export const OUTPUT_NAME = 'daily_output.json';
export const NON_UNBUNDLED_BUNDLES_NAME = 'non_unbundled_bundles.json';
export const ONE_HUNDRED_MB = 1000 * 1000 * 100;
export const GROUP_EFFORT_REWARDS_FULL = [
	75, 55, 50, 47, 45, 43, 40, 37, 35, 32, 31, 30, 29, 28, 27, 26, 25, 24, 23, 22, 21, 20, 19, 18, 17, 16, 15, 14, 13,
	12, 11, 10, 9, 9, 8, 8, 7, 7, 6, 6, 5, 5, 4, 4, 3, 3, 2, 2, 1, 1
] as const;
export const GROUP_EFFORT_REWARDS_HALF = GROUP_EFFORT_REWARDS_FULL.map(reward => Math.ceil(reward / 2));
export const ITEMS_PER_REQUEST = 100;
export const VALID_APP_NAMES = ['ArDrive-Web', 'ArDrive-CLI', 'ArDrive-Sync', 'ArDrive-Core'];
export const BLOCKS_PER_MONTH = 21600;
export const MAX_RETRIES = 10;
export const TIMEOUT = 40000;
export const initialWalletStats = (): WalletStatEntry => {
	return {
		fileCount: 0,
		byteCount: 0,
		changeInPercentage: 0,
		rankPosition: 0,
		tokensEarned: 0,
		tips: 0
	};
};
export const UPLOAD_DATA_TIP_TYPE = 'data upload';
export const APP_NAME_TAG = 'App-Name';
export const BOOST_TAG = 'Boost';
export const APP_VERSION_TAG = 'App-Version';
export const WEB_APP_NAME = 'ArDrive-Web';
export const WINSTON_AR_ASPECT = 1_000_000_000_000;

export const defaultGatewayHost = 'arweave.net';
export const defaultGatewayProtocol = 'https';
export const defaultGatewayPort = 443;
export const gatewayUrl = `${defaultGatewayProtocol}://${defaultGatewayHost}:${defaultGatewayPort}`;
export const GQL_URL = `${gatewayUrl}/graphql`;
