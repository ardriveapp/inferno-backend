export interface Query {
	query: string;
}

export interface StakedPSTHolders {
	[address: string]: number;
}

export interface OutputData {
	// The last block height of the run
	blockHeight: number;

	// The time it has run
	timestamp: number;

	// PST Holders' staked tokens
	PSTHolders: { [address: string]: number };

	// Per wallet stats
	wallets: {
		[address: string]: {
			daily: {
				// Total of uploaded bytes by private and public files
				byteCount: number;

				// The variance of uploaded data
				changeInPercentage: {
					'24h': number;
					'7d': number;
				};

				// Total number of individual files uploaded
				fileCount: number;

				// Current position in the ranking
				rankPosition: number;

				// Tokens earned
				tokensEarned: number;
			};
			weekly: {
				// Total of uploaded bytes by private and public files
				byteCount: number;

				// The variance of uploaded data
				changeInPercentage: {
					'24h': number;
					'7d': number;
				};

				// Total number of individual files uploaded
				fileCount: number;

				// Current position in the ranking
				rankPosition: number;

				// Tokens earned
				tokensEarned: number;
			};
			lastWeek: {
				// Total of uploaded bytes by private and public files
				byteCount: number;

				// The variance of uploaded data
				changeInPercentage: {
					'24h': number;
					'7d': number;
				};

				// Total number of individual files uploaded
				fileCount: number;

				// Current position in the ranking
				rankPosition: number;

				// Tokens earned
				tokensEarned: number;
			};
			total: {
				// Total of uploaded bytes by private and public files
				byteCount: number;

				// The variance of uploaded data
				changeInPercentage: {
					'24h': number;
					'7d': number;
				};

				// Total number of individual files uploaded
				fileCount: number;

				// Current position in the ranking
				rankPosition: number;

				// Tokens earned
				tokensEarned: number;
			};
		};
	};

	ranks: {
		daily: {
			// True only when at least 50 wallets has uploaded 50 GIB
			hasReachedMinimumGroupEffort: boolean;

			// Is an array of 50 elements for the Wallet Addres and earned ARDRIVE tokens
			groupEffortRewards: Array<{ address: string; rewards: number }>;

			// An array of addresses in streak, and the earned ARDRIVE tokens
			streakRewards: Array<{ address: string; rewards: number }>;
		};
		weekly: {
			// True only when at least 50 wallets has uploaded 50 GIB
			hasReachedMinimumGroupEffort: boolean;

			// Is an array of 50 elements for the Wallet Addres and earned ARDRIVE tokens
			groupEffortRewards: Array<{ address: string; rewards: number }>;

			// An array of addresses in streak, and the earned ARDRIVE tokens
			streakRewards: Array<{ address: string; rewards: number }>;
		};
		lastWeek: {
			// True only when at least 50 wallets has uploaded 50 GIB
			hasReachedMinimumGroupEffort: boolean;

			// Is an array of 50 elements for the Wallet Addres and earned ARDRIVE tokens
			groupEffortRewards: Array<{ address: string; rewards: number }>;

			// An array of addresses in streak, and the earned ARDRIVE tokens
			streakRewards: Array<{ address: string; rewards: number }>;
		};
		total: {
			// Is an array of 50 elements for the Wallet Addres and earned ARDRIVE tokens
			groupEffortRewards: Array<{ address: string; rewards: number }>;

			// An array of addresses in streak, and the earned ARDRIVE tokens
			streakRewards: Array<{ address: string; rewards: number }>;
		};
	};
}
