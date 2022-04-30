export interface Query {
	query: string;
}

/**
 * the main interface representing the whole derivated data
 */
export interface OutputData {
	// The timestamp for when the data aggregation has run
	lastUpdated: number;

	// The last block height read
	blockHeight: number;

	// The last block's timestamp read
	timestamp: number;

	// PST Holders' staked tokens
	PSTHolders: StakedPSTHolders;

	// Per wallet stats
	wallets: WalletsStats;

	ranks: Ranks;
}

/**
 * key/value of address/tokens above 200 ARDRIVE locked for at least 21600 blocks (~30 days)
 */
export interface StakedPSTHolders {
	[address: string]: number;
}

/**
 * key/value of by-timeframe addresses
 */
export interface WalletsStats {
	[address: string]: {
		daily: WalletStatEntry;
		yesterday: WalletStatEntry;
		weekly: WalletStatEntry;
		lastWeek: WalletStatEntry;
		total: WalletStatEntry;
	};
}

/**
 * pertinent data count of a wallet within a timeframe
 */
export interface WalletStatEntry {
	// Total of uploaded bytes by private and public files
	byteCount: number;

	// The variance of uploaded data
	changeInPercentage: number;

	// Total number of individual files uploaded
	fileCount: number;

	// Current position in the ranking
	rankPosition: number;

	// Tokens earned
	tokensEarned: number;

	// Total tips sent to valid PST holders
	tips: number;

	// Block height since when the wallet is participating
	blockSinceParticipating?: number;
}

/**
 * by-timeframe ranks
 */
export interface Ranks {
	daily: RankEntry;
	weekly: RankEntry;
	lastWeek: RankEntry;
	total: RankEntryTotal;
}

/**
 * represents the rewards
 */
export interface RankEntry {
	// True only when at least 50 wallets has uploaded 50 GIB
	hasReachedMinimumGroupEffort: boolean;

	// Is an array of 50 elements for the Wallet Address and earned ARDRIVE tokens
	groupEffortRewards: Rewards;

	// An array of addresses in streak, and the earned ARDRIVE tokens
	streakRewards: Rewards;
}

/**
 * represents the total rewards
 */
export interface RankEntryTotal {
	// Is an array of 50 elements for the Wallet Address and earned ARDRIVE tokens
	groupEffortRewards: Rewards;

	// An array of addresses in streak, and the earned ARDRIVE tokens
	streakRewards: Rewards;
}

/**
 * array of rewards per address
 */
export type Rewards = Array<{ address: string; rewards: number }>;
