export interface Query {
	query: string;
}

export interface OutputData {
	// The last block height of the run
	blockHeight: number;

	// The time it has run
	timestamp: number;

	// PST Holders' staked tokens
	PSTHolders: StakedPSTHolders;

	// Per wallet stats
	wallets: WalletsStats;

	ranks: Ranks;
}

export interface StakedPSTHolders {
	[address: string]: number;
}

export interface WalletsStats {
	[address: string]: {
		daily: WalletStatEntry;
		yesterday: WalletStatEntry;
		weekly: WalletStatEntry;
		lastWeek: WalletStatEntry;
		total: WalletStatEntry;
	};
}

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
}

export interface Ranks {
	daily: RankEntry;
	weekly: RankEntry;
	lastWeek: RankEntry;
	total: RankEntryTotal;
}

export interface RankEntry {
	// True only when at least 50 wallets has uploaded 50 GIB
	hasReachedMinimumGroupEffort: boolean;

	// Is an array of 50 elements for the Wallet Addres and earned ARDRIVE tokens
	groupEffortRewards: Rewards;

	// An array of addresses in streak, and the earned ARDRIVE tokens
	streakRewards: Rewards;
}

export interface RankEntryTotal {
	// Is an array of 50 elements for the Wallet Addres and earned ARDRIVE tokens
	groupEffortRewards: Rewards;

	// An array of addresses in streak, and the earned ARDRIVE tokens
	streakRewards: Rewards;
}

export type Rewards = Array<{ address: string; rewards: number }>;
