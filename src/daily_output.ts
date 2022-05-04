import { readFileSync, writeFileSync } from 'fs';
import { getLastTimestamp, tiebreakerSortFactory } from './common';
import {
	GROUP_EFFORT_REWARDS,
	initialWalletStats,
	UPLOAD_DATA_TIP_TYPE,
	ONE_THOUSAND_MB,
	OUTPUT_NAME,
	OUTPUT_TEMPLATE_NAME
} from './constants';
import { GQLEdgeInterface } from './gql_types';
import { OutputData, StakedPSTHolders, WalletsStats, WalletStatEntry } from './inferno_types';

/**
 * A class responsible of parsing the GQL and CommunityOracle data into the OutputData file
 */
export class DailyOutput {
	private readonly previousData = this.read();
	private data = this.read();
	private latestBlock = 0;
	private latestTimestamp = getLastTimestamp();
	private bundlesTips: { [txId: string]: { tip: number; size: number; address: string } } = {};
	private unbundledBundleTxIDs: string[] = [];
	private bundleFileCount: { [txId: string]: number } = {};

	constructor(private heightRange: [number, number]) {}

	/**
	 * Takes the data from the previously generated data, fallbacking to the base template if not present
	 * @throws if the validation of the output file fails
	 * @returns {OutputData}
	 */
	public read(): OutputData {
		const data = (() => {
			try {
				return this.readOutputFile();
			} catch (err) {
				return this.readTemplate();
			}
		})();
		if (!this.validateDataStructure(data)) {
			throw new Error(`The output JSON has a wrong structure`);
		}
		return data;
	}

	/**
	 * @param {StakedPSTHolders} stakedPSTHolders key/value of address/tokens above 200 ARDRIVE locked for at least 21600 blocks (~30 days)
	 */
	public feedPSTHolders(stakedPSTHolders: StakedPSTHolders): void {
		this.data.PSTHolders = stakedPSTHolders;
	}

	/**
	 * @param {GQLEdgeInterface[]} queryResult the edges of ArFSTransactions only - 50 block before the latest
	 */
	public feedGQLData(queryResult: GQLEdgeInterface[]): Promise<void> {
		queryResult.forEach(this.aggregateData);
		return this.finishDataAggregation();
	}

	/**
	 * From the fed data, derivate:
	 * - the ranking,
	 * - the change in percentage of the upload voume,
	 * - wether or not the group effort reached the minimum requirements,
	 * - group effort rewards, and
	 * - streak rewards
	 */
	private async finishDataAggregation(): Promise<void> {
		// aggregate +1 file count to the non unbunded bundles
		const bundleTxIDs = Object.keys(this.bundlesTips);
		bundleTxIDs.forEach((txId) => {
			if (!this.bundleFileCount[txId]) {
				this.sumFile(this.bundlesTips[txId].address);
			}
		});

		// calculate change in percentage of the uploaded data and rank position
		this.data.blockHeight = this.heightRange[1];
		this.data.timestamp = this.latestTimestamp;

		const addresses = Object.keys(this.data.wallets);
		addresses.forEach((address) => {
			// daily change
			const uploadedDataYesterday = this.data.wallets[address].yesterday.byteCount;
			const uploadedDataToday = this.data.wallets[address].daily.byteCount;
			const changeInPercentageDaily = this.changeInPercentage(uploadedDataYesterday, uploadedDataToday) * 100;
			this.data.wallets[address].daily.changeInPercentage = changeInPercentageDaily;

			// weekly change
			const uploadedDataLastWeek = this.data.wallets[address].yesterday.byteCount;
			const uploadedDataCurrentWeek = this.data.wallets[address].daily.byteCount;
			const changeInPercentageWeekly =
				this.changeInPercentage(uploadedDataLastWeek, uploadedDataCurrentWeek) * 100;
			this.data.wallets[address].daily.changeInPercentage = changeInPercentageWeekly;
		});

		// check if the minimum group effort was reached
		const groupEffortParticipants: string[] = [];
		const otherParticipants: string[] = [];
		addresses.forEach((address) => {
			if (this.data.wallets[address].weekly.byteCount >= ONE_THOUSAND_MB) {
				groupEffortParticipants.push(address);
			} else {
				otherParticipants.push(address);
			}
		});

		const hasReachedMinimumGroupEffort = groupEffortParticipants.length >= 50;
		this.data.ranks.daily.hasReachedMinimumGroupEffort = hasReachedMinimumGroupEffort;
		this.data.ranks.weekly.hasReachedMinimumGroupEffort = hasReachedMinimumGroupEffort;

		const shuffledTies = groupEffortParticipants.sort(tiebreakerSortFactory('weekly', this.data.wallets));

		shuffledTies.forEach((address, index) => {
			this.data.wallets[address].daily.rankPosition = index + 1;
			this.data.wallets[address].weekly.rankPosition = index + 1;
		});

		const top50 = shuffledTies.slice(0, 49);

		const top50Data = top50.map((address, index) => {
			return { address, rewards: GROUP_EFFORT_REWARDS[index], rankPosition: index + 1 };
		});

		const otherParticipantsData = otherParticipants
			.sort(tiebreakerSortFactory('weekly', this.data.wallets))
			.map((address) => {
				return { address, rewards: 0, rankPosition: 0 };
			});

		this.data.ranks.daily.groupEffortRewards = [...top50Data, ...otherParticipantsData];
		this.data.ranks.weekly.groupEffortRewards = [...top50Data, ...otherParticipantsData];

		// TODO: determine total ranking

		// compute streak rewards
		// const stakedPSTHolders = Object.keys(this.data.PSTHolders);
		// TODO: determine if the wallets has uploaded data for 7 days in a row

		this.data.lastUpdated = Date.now();
	}

	private changeInPercentage(prev: number, curr: number): number {
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

	/**
	 * Will copy the data of today into yesterday's and clear the today's data
	 */
	private resetDay(): void {
		for (const address in this.data.wallets) {
			this.data.wallets[address].yesterday = this.data.wallets[address].daily;
			this.data.wallets[address].daily = {
				byteCount: 0,
				changeInPercentage: 0,
				fileCount: 0,
				rankPosition: 0,
				tokensEarned: 0,
				tips: 0
			};
			this.data.ranks.daily = {
				hasReachedMinimumGroupEffort: false,
				groupEffortRewards: [],
				streakRewards: []
			};
		}
	}

	/**
	 * Will copy the data of the current week into the past one and clear the data of the current week
	 */
	private resetWeek(): void {
		for (const address in this.data.wallets) {
			this.data.wallets[address].lastWeek = this.data.wallets[address].weekly;
			this.data.wallets[address].weekly = {
				byteCount: 0,
				changeInPercentage: 0,
				fileCount: 0,
				rankPosition: 0,
				tokensEarned: 0,
				tips: 0
			};
			this.data.ranks.lastWeek = this.data.ranks.weekly;
			// updates the total rewards on week change
			this.data.ranks.weekly.groupEffortRewards.forEach(({ address, rewards }) => {
				const prevTotal = this.data.ranks.total.groupEffortRewards.find(
					({ address: addr }) => addr === address
				);
				if (prevTotal) {
					const indexOfAddress = this.data.ranks.total.groupEffortRewards.indexOf(prevTotal);
					this.data.ranks.total.groupEffortRewards[indexOfAddress].rewards += rewards;
				} else {
					this.data.ranks.total.groupEffortRewards.push({ address, rewards, rankPosition: 0 });
				}
			});
			this.data.ranks.total.groupEffortRewards = this.data.ranks.total.groupEffortRewards
				.sort(({ address: address_1 }, { address: address_2 }) =>
					tiebreakerSortFactory('total', this.data.wallets)(address_1, address_2)
				)
				.map(({ address, rewards }, index) => ({ address, rewards, rankPosition: index + 1 }));
			this.data.ranks.weekly = {
				hasReachedMinimumGroupEffort: false,
				groupEffortRewards: [],
				streakRewards: []
			};
		}
	}

	/**
	 * Aggregates one single GQL result
	 * @param edge the edge result of the query
	 * @throws if there's a bundled transaction with no bundle
	 */
	private aggregateData = (edge: GQLEdgeInterface): void => {
		const node = edge.node;
		const txId = node.id;
		const ownerAddress = node.owner.address;
		const tip = +node.quantity.winston;
		const tags = node.tags;
		const dataSize = +node.data.size;
		const entityTypeTag = tags.find((tag) => tag.name === 'Entity-Type')?.value;
		const bundledIn = node.bundledIn?.id;
		const bundleVersion = tags.find((tag) => tag.name === 'Bundle-Version')?.value;
		const bundleTipType = tags.find((tag) => tag.name === 'Tip-Type')?.value;
		const isMetadataTransaction = !!entityTypeTag && !bundleVersion;
		const isBundleTransaction = !!bundleVersion;

		const previousTimestamp = this.latestTimestamp * 1000;
		const previousBlockHeight = this.previousData.blockHeight;
		const previousDate = new Date(previousTimestamp);

		const height = edge.node.block.height;

		if (previousBlockHeight >= height) {
			throw new Error('That block was already processed!');
		}

		const queryTimestamp = edge.node.block.timestamp * 1000;
		const queryDate = new Date(queryTimestamp);

		if (this.isNewESTDate(previousDate, queryDate)) {
			this.resetDay();
		}

		if (this.isNewESTWeek(previousDate, queryDate)) {
			this.resetWeek();
		}

		// track unbundled bundles
		if (bundledIn) {
			if (this.unbundledBundleTxIDs.indexOf(bundledIn) === -1) {
				this.unbundledBundleTxIDs.push(bundledIn);
			}
		}

		if (isMetadataTransaction) {
			const isFileMetadata = entityTypeTag === 'file';
			if (isFileMetadata) {
				if (bundledIn) {
					// track the file count of unbundled bundles
					if (this.bundleFileCount[txId] === undefined) {
						this.bundleFileCount[txId] = 0;
					}
					this.bundleFileCount[txId] += 1;
				}
				this.sumFile(ownerAddress);
			}
		} else if (isBundleTransaction) {
			this.bundlesTips[txId] = { tip, size: node.data.size, address: ownerAddress };

			if (bundleTipType === UPLOAD_DATA_TIP_TYPE) {
				this.sumSize(ownerAddress, node.data.size);
				this.sumTip(ownerAddress, +node.quantity.winston);
			}

			// TODO: track the bundles file count
		} else {
			// it is file data transaction

			if (!tip) {
				// TODO: check for the validity of the addres recieving the tip
				// const fee = +node.fee.winston;
				// // if boosted, the tip ratio will be greater than 15
				// const tipRatio = fee / tip;
				// const correctTipRatio = tipRatio >= 15;
				// const recipient = node.recipient;

				// transactions with no tip are bundled transactions or invalid V2 transactions
				return;
			}

			// it is a V2 transaction with a tip
			this.sumSize(ownerAddress, dataSize);
			this.sumTip(ownerAddress, tip);

			// Set the block height once the minimum amount of data to participate is reached
			if (
				!this.data.wallets[ownerAddress].weekly.blockSinceParticipating &&
				this.isParticipatingInGroupEffort(ownerAddress)
			) {
				this.data.wallets[ownerAddress].weekly.blockSinceParticipating = node.block.height;
			}
		}

		this.latestBlock = Math.max(this.latestBlock, node.block.height);
		this.latestTimestamp = Math.max(this.latestTimestamp, node.block.timestamp);
	};

	private isNewESTDate(prev: Date, curr: Date): boolean {
		const isNewDay = this.dateToEST(prev).getDate() !== this.dateToEST(curr).getDate();
		return isNewDay;
	}

	private isNewESTWeek(prev: Date, curr: Date): boolean {
		const isNewDay = this.dateToEST(prev).getDay() !== this.dateToEST(curr).getDay();
		return isNewDay;
	}

	private dateToEST(d: Date): Date {
		const date = new Date(d.getTime());
		const offset = date.getTimezoneOffset(); // getting offset to make time in gmt+0 zone (UTC) (for gmt+5 offset comes as -300 minutes)
		date.setMinutes(date.getMinutes() + offset); // date now in UTC time

		const easternTimeOffset = -240; // for dayLight saving, Eastern time become 4 hours behind UTC thats why its offset is -4x60 = -240 minutes. So when Day light is not active the offset will be -300
		date.setMinutes(date.getMinutes() + easternTimeOffset);
		return date;
	}

	private isParticipatingInGroupEffort(address: string): boolean {
		const currentByteCount = this.data.wallets[address].weekly.byteCount;
		return currentByteCount >= ONE_THOUSAND_MB;
	}

	/**
	 * Adds +1 to the file count
	 * @param address the address of the owner wallet of the transaction
	 */
	private sumFile(address: string): void {
		this.setupWallet(address);
		this.data.wallets[address].daily.fileCount++;
		this.data.wallets[address].weekly.fileCount++;
		this.data.wallets[address].total.fileCount++;
	}

	/**
	 * Sums up the size in bytes of the file
	 * @param address the address of the owner wallet of the transaction
	 * @param size the data size of the file data transaction
	 */
	private sumSize(address: string, size: number): void {
		this.setupWallet(address);
		this.data.wallets[address].daily.byteCount += size;
		this.data.wallets[address].weekly.byteCount += size;
		this.data.wallets[address].total.byteCount += size;
	}

	/**
	 * Sums up the tip of the file data transaction
	 * @param address the address of the owner wallet of the transaction
	 * @param tip the tip to a valid PST holder of the file data transaction
	 */
	private sumTip(address: string, tip: number): void {
		this.setupWallet(address);
		this.data.wallets[address].daily.tips += tip;
		this.data.wallets[address].weekly.tips += tip;
		this.data.wallets[address].total.tips += tip;
	}

	/**
	 * Will fill the data of a wallet if no present
	 * @param address the address of whom to fill the data
	 */
	private setupWallet(address: string): void {
		if (!this.data.wallets[address]) {
			this.data.wallets[address] = {
				daily: initialWalletStats(),
				yesterday: initialWalletStats(),
				weekly: initialWalletStats(),
				lastWeek: initialWalletStats(),
				total: initialWalletStats()
			};
		}
	}

	/**
	 * Stores the JSON output of the class instance
	 * @throws if the JSON data is invalid
	 */
	public write(): void {
		if (!this.validateDataStructure(this.data)) {
			throw new Error(`Cannot save invalid output: ${JSON.stringify(this.data)}`);
		}
		writeFileSync(OUTPUT_NAME, JSON.stringify(this.data, null, '\t'));
	}

	/**
	 * @returns the content of the JSON template file
	 */
	private readTemplate(): unknown {
		const data = readFileSync(OUTPUT_TEMPLATE_NAME);
		const dataAsString = data.toString();
		return JSON.parse(dataAsString);
	}

	/**
	 * @returns the content of the JSON output file
	 */
	public readOutputFile(): unknown {
		const data = readFileSync(OUTPUT_NAME);
		const dataAsString = data.toString();
		return JSON.parse(dataAsString);
	}

	/**
	 * Validates certain object to match the schema of the OutputData
	 * @param data a JSON object
	 * @returns true if the data is OutputData
	 */
	private validateDataStructure(data: unknown): data is OutputData {
		const dataAsOutputData = data as OutputData;
		return !!(
			dataAsOutputData.lastUpdated &&
			dataAsOutputData.PSTHolders &&
			dataAsOutputData.blockHeight &&
			dataAsOutputData.timestamp &&
			this.validateWalletsStructure(dataAsOutputData.wallets) &&
			dataAsOutputData.ranks &&
			dataAsOutputData.ranks.daily &&
			dataAsOutputData.ranks.weekly &&
			dataAsOutputData.ranks.lastWeek &&
			dataAsOutputData.ranks.total
		);
	}

	private validateWalletsStructure(wallets: unknown): wallets is WalletsStats {
		const walletsAsWalletsStats = wallets as WalletsStats;
		const walletsInGoodShape =
			walletsAsWalletsStats &&
			Object.keys(walletsAsWalletsStats).reduce((isInGoodShape, address) => {
				const walletData = walletsAsWalletsStats[address];
				const currentWalletInGoodShape =
					this.validateWalletStatStructure(walletData.daily) &&
					this.validateWalletStatStructure(walletData.yesterday) &&
					this.validateWalletStatStructure(walletData.weekly) &&
					this.validateWalletStatStructure(walletData.lastWeek) &&
					this.validateWalletStatStructure(walletData.total);
				return isInGoodShape && currentWalletInGoodShape;
			}, true);
		return walletsInGoodShape;
	}

	private validateWalletStatStructure(data: unknown): data is WalletStatEntry {
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
}
