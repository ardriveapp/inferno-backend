import { readFileSync, writeFileSync } from 'fs';
import {
	validateTxTip,
	getLastTimestamp,
	tiebreakerSortFactory,
	ardriveOracle,
	daysDiffInEST,
	weeksDiffInEST,
	changeInPercentage
} from './common';
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
	private readonly ardriveOracle = ardriveOracle;
	private readonly previousData = this.read();
	private data = this.read();
	private latestTimestamp = getLastTimestamp();
	private bundlesTips: { [txId: string]: { tip: number; size: number; address: string } } = {};
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
	public async feedGQLData(queryResult: GQLEdgeInterface[]): Promise<void> {
		for (const edge of queryResult) {
			await this.aggregateData(edge);
		}
		await this.finishDataAggregation();
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
		console.log(`Finishing data aggregation...`);

		// aggregate +1 file count to the non unbundled bundles
		const bundleTxIDs = Object.keys(this.bundlesTips);
		bundleTxIDs.forEach((txId) => {
			if (!this.bundleFileCount[txId]) {
				this.sumFile(this.bundlesTips[txId].address);
			}
		});

		// calculate change in percentage of the uploaded data and rank position
		this.data.blockHeight = this.heightRange[1];
		this.data.timestamp = this.latestTimestamp;

		this.caclulateChangeOfUploadVolume();
		this.caclulateWeeklyRewards();

		// compute streak rewards
		// const stakedPSTHolders = Object.keys(this.data.PSTHolders);
		// TODO: determine if the wallets has uploaded data for 7 days in a row

		this.data.lastUpdated = Date.now();
	}

	private caclulateChangeOfUploadVolume(): void {
		const addresses = Object.keys(this.data.wallets);
		addresses.forEach((address) => {
			// daily change
			const uploadedDataYesterday = this.data.wallets[address].yesterday.byteCount;
			const uploadedDataToday = this.data.wallets[address].daily.byteCount;
			const changeInPercentageDaily = changeInPercentage(uploadedDataYesterday, uploadedDataToday) * 100;
			this.data.wallets[address].daily.changeInPercentage = +changeInPercentageDaily.toFixed(2);

			// weekly change
			const uploadedDataLastWeek = this.data.wallets[address].lastWeek.byteCount;
			const uploadedDataCurrentWeek = this.data.wallets[address].weekly.byteCount;
			const changeInPercentageWeekly = changeInPercentage(uploadedDataLastWeek, uploadedDataCurrentWeek) * 100;
			this.data.wallets[address].weekly.changeInPercentage = +changeInPercentageWeekly.toFixed(2);
		});
	}

	/**
	 * Will copy the data of today into yesterday's and clear the today's data
	 */
	private resetDay(): void {
		this.caclulateWeeklyRewards();
		this.caclulateChangeOfUploadVolume();
		for (const address in this.data.wallets) {
			this.resetWalletDay(address);
		}
		this.resetRanksDay();
	}

	private caclulateWeeklyRewards(): void {
		const addresses = Object.keys(this.data.wallets);
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

		// updates the weekly/daily ranks and rewards
		this.data.ranks.daily.groupEffortRewards = this.data.ranks.weekly.groupEffortRewards = addresses
			.filter((addr) => this.data.wallets[addr].weekly.byteCount)
			.sort(tiebreakerSortFactory('weekly', this.data.wallets))
			.map((address, index) => {
				const rankPosition = index + 1;
				const isInTop50 = rankPosition <= 50;
				const rewards = hasReachedMinimumGroupEffort && isInTop50 ? GROUP_EFFORT_REWARDS[index] : 0;
				return { address, rewards, rankPosition };
			});
	}

	private resetWalletDay(address: string): void {
		this.data.wallets[address].yesterday = this.data.wallets[address].daily;
		this.data.wallets[address].daily = {
			byteCount: 0,
			changeInPercentage: 0,
			fileCount: 0,
			rankPosition: 0,
			tokensEarned: 0,
			tips: 0
		};
	}

	private resetRanksDay(): void {
		this.data.ranks.daily = {
			hasReachedMinimumGroupEffort: false,
			groupEffortRewards: [],
			streakRewards: []
		};
	}

	/**
	 * Will copy the data of the current week into the past one and clear the data of the current week
	 */
	private resetWeek(): void {
		for (const address in this.data.wallets) {
			this.resetWalletWeek(address);
		}
		this.caclulateTotalRanks();
		this.updateTotalRewards();
		this.resetRanksWeek();
	}

	private caclulateTotalRanks(): void {
		const addresses = Object.keys(this.data.wallets);
		// updates the total ranks
		this.data.ranks.total.groupEffortRewards = addresses
			.filter((addr) => this.data.wallets[addr].total.byteCount)
			.sort((address_1, address_2) => tiebreakerSortFactory('total', this.data.wallets)(address_1, address_2))
			.map((address, index) => {
				const rewards = (() => {
					const prevTotal = this.data.ranks.total.groupEffortRewards.find(
						({ address: addr }) => addr === address
					);
					if (prevTotal) {
						const indexOfAddress = this.data.ranks.total.groupEffortRewards.indexOf(prevTotal);
						return this.data.ranks.total.groupEffortRewards[indexOfAddress].rewards;
					}
					return 0;
				})();
				return { address, rewards, rankPosition: index + 1 };
			});
	}

	private resetWalletWeek(address: string): void {
		this.data.wallets[address].lastWeek = this.data.wallets[address].weekly;
		this.data.wallets[address].weekly = {
			byteCount: 0,
			changeInPercentage: 0,
			fileCount: 0,
			rankPosition: 0,
			tokensEarned: 0,
			tips: 0
		};
	}

	private updateTotalRewards(): void {
		this.data.ranks.weekly.groupEffortRewards.forEach(({ address, rewards }) => {
			const prevTotal = this.data.ranks.total.groupEffortRewards.find(({ address: addr }) => addr === address);
			if (prevTotal) {
				const indexOfAddress = this.data.ranks.total.groupEffortRewards.indexOf(prevTotal);
				this.data.ranks.total.groupEffortRewards[indexOfAddress].rewards += rewards;
			} else {
				this.data.ranks.total.groupEffortRewards.push({ address, rewards, rankPosition: 0 });
			}
		});
	}

	private resetRanksWeek(): void {
		this.data.ranks.lastWeek = this.data.ranks.weekly;
		this.data.ranks.weekly = {
			hasReachedMinimumGroupEffort: false,
			groupEffortRewards: [],
			streakRewards: []
		};
	}

	/**
	 * Aggregates one single GQL result
	 * @param edge the edge result of the query
	 * @throws if there's a bundled transaction with no bundle
	 */
	private aggregateData = async (edge: GQLEdgeInterface): Promise<void> => {
		const node = edge.node;
		const txId = node.id;
		const ownerAddress = node.owner.address;
		const tags = node.tags;
		const dataSize = +node.data.size;

		const height = edge.node.block.height;
		const previousBlockHeight = this.previousData.blockHeight;
		if (previousBlockHeight >= height) {
			throw new Error('That block was already processed!');
		}

		const fee = node.fee.winston ? +node.fee.winston : undefined;
		const tip = node.quantity.winston ? +node.quantity.winston : undefined;
		const isTipValid = await validateTxTip(node, this.ardriveOracle);
		const entityTypeTag = tags.find((tag) => tag.name === 'Entity-Type')?.value;
		const bundleVersion = tags.find((tag) => tag.name === 'Bundle-Version')?.value;
		const isMetadataTransaction = !!entityTypeTag && !bundleVersion;
		const isFileMetadata = entityTypeTag === 'file';
		const isBundleTransaction = !!bundleVersion;
		const bundledIn = node.bundledIn?.id;
		const isV2DataTx = !isMetadataTransaction && !isBundleTransaction && !bundledIn;

		if (fee && isTipValid && (isV2DataTx || isBundleTransaction)) {
			const queryTimestamp = edge.node.block.timestamp * 1000;
			const queryDate = new Date(queryTimestamp);
			const previousTimestamp = this.latestTimestamp * 1000;
			const previousDate = new Date(previousTimestamp);

			const daysDiff = daysDiffInEST(previousDate, queryDate);
			for (let index = 0; index < daysDiff; index++) {
				console.log(`Prev block: ${this.data.blockHeight}, current block: ${height}`);
				this.resetDay();
			}

			const weeksDiff = weeksDiffInEST(previousDate, queryDate);
			for (let index = 0; index < weeksDiff; index++) {
				console.log(`Prev block: ${this.data.blockHeight}, current block: ${height}`);
				this.resetWeek();
			}

			this.latestTimestamp = node.block.timestamp;
		}

		if (isMetadataTransaction) {
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
		} else if (isBundleTransaction && isTipValid && tip) {
			const bundleTipType = tags.find((tag) => tag.name === 'Tip-Type')?.value;
			if (bundleTipType === UPLOAD_DATA_TIP_TYPE) {
				this.bundlesTips[txId] = { tip, size: dataSize, address: ownerAddress };
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
		} else if (!bundledIn) {
			// it is file data transaction
			if (!tip) {
				// transactions with no tip are bundled transactions or invalid V2 transactions
				// TODO: double chek if this case is covered by isTipValid
				return;
			}
			if (!isTipValid) {
				// invalid tips are discarded
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
		this.data.blockHeight = height;
	};

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
		writeFileSync(OUTPUT_NAME, JSON.stringify(this.data));
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
