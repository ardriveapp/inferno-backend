import { GQLEdgeInterface } from 'ardrive-core-js';
import { readFileSync } from 'fs';
import { OUTPUT_NAME, OUTPUT_TEMPLATE_NAME } from './constants';
import { OutputData, StakedPSTHolders } from './inferno_types';

export class DailyOutput {
	private data = this.read();
	private latestBlock = 0;
	private latestTimestamp = 0;

	/**
	 * takes the data from the previously generated data, fallbacking to the base template if not present
	 * @retuns {OutputData}
	 */
	public read(): OutputData {
		const data = (() => {
			try {
				return this.readOutputFile();
			} catch (err) {
				console.log(`The output file hasn't yet been created. Using the file template`);
				return this.readTemplate();
			}
		})();
		if (!this.validateDataStructure(data)) {
			throw new Error(`The output JSON has a wrong structure`);
		}
		return data;
	}

	/**
	 *
	 * @param {StakedPSTHolders} stakedPSTHolders key/value of address/tokens above 200 ARDRIVE locked for at least 21600 blocks (~30 days)
	 */
	feedPSTHolders(stakedPSTHolders: StakedPSTHolders): void {
		this.data.PSTHolders = stakedPSTHolders;
	}

	/**
	 *
	 * @param {GQLEdgeInterface[]} queryResult the edges of ArFSTransactions only - 50 block before the latest
	 */
	feedGQLData(queryResult: GQLEdgeInterface[]): void {
		const previousData = this.read();
		const previousTimestamp = previousData.timestamp;
		const previousDate = new Date(previousTimestamp);

		const latestQueryResult = queryResult[queryResult.length - 1];
		const queryTimestamp = latestQueryResult.node.block.timestamp;
		const queryDate = new Date(queryTimestamp);

		const isNewDay = previousDate.getDate() !== queryDate.getDate();
		const isNewWeek = previousDate.getDay() !== queryDate.getDay();

		if (isNewDay) {
			this.resetDay();
		}

		if (isNewWeek) {
			this.resetWeek();
		}

		queryResult.forEach(this.aggregateData);

		this.finishDataAggregation();
	}

	private finishDataAggregation(): void {
		this.data.blockHeight = this.latestBlock;
		this.data.timestamp = this.latestTimestamp;

		// TODO: calculate change in percentage
		// TODO: calculate rewards
	}

	private resetDay(): void {
		const addresses = Object.keys(this.data.wallets);
		for (const address in addresses) {
			this.data.wallets[address].daily = {
				byteCount: 0,
				changeInPercentage: 0,
				fileCount: 0,
				rankPosition: 0,
				tokensEarned: 0
			};
			this.data.ranks.daily = {
				hasReachedMinimumGroupEffort: false,
				groupEffortRewards: [],
				streakRewards: []
			};
		}
	}

	private resetWeek(): void {
		const addresses = Object.keys(this.data.wallets);
		for (const address in addresses) {
			this.data.wallets[address].lastWeek = this.data.wallets[address].weekly;
			this.data.wallets[address].weekly = {
				byteCount: 0,
				changeInPercentage: 0,
				fileCount: 0,
				rankPosition: 0,
				tokensEarned: 0
			};
			this.data.ranks.lastWeek = this.data.ranks.weekly;
			this.data.ranks.weekly = {
				hasReachedMinimumGroupEffort: false,
				groupEffortRewards: [],
				streakRewards: []
			};
		}
	}

	private aggregateData = (edge: GQLEdgeInterface) => {
		const node = edge.node;
		const ownerAddress = node.owner.address;
		const tags = node.tags;
		const entityTypeTag = tags.find((tag) => tag.name === 'Entity-Type');
		const bundledIn = tags.find((tag) => tag.name === 'Bundled-In');
		const isMetadataTransaction = !!entityTypeTag;

		if (isMetadataTransaction) {
			const isFileMetadata = entityTypeTag.value === 'file';
			if (isFileMetadata) {
				this.sumFile(ownerAddress);
			}
		} else {
			// is file data transaction
			const tip = +node.quantity.winston;

			if (!tip) {
				// TODO: check for the validity of the addres recieving the tip
				// const fee = +node.fee.winston;
				// // if boosted, the tip ratio will be greater than 15
				// const tipRatio = fee / tip;
				// const correctTipRatio = tipRatio >= 15;
				// const recipient = node.recipient;

				const isBundledTransaction = !!bundledIn;
				if (isBundledTransaction) {
					// TODO: check for bundle tip
				}
				// Discards V2 transactions without a tip
				return;
			}

			const dataSize = +node.data.size;
			this.sumSize(ownerAddress, dataSize);
		}

		this.latestBlock = Math.max(this.latestBlock, node.block.height);
		this.latestTimestamp = Math.max(this.latestTimestamp, node.block.timestamp);
	};

	private sumFile(address: string): void {
		this.setupWallet(address);
		this.data.wallets[address].daily.fileCount++;
		this.data.wallets[address].weekly.fileCount++;
		this.data.wallets[address].total.fileCount++;
	}

	private sumSize(address: string, size: number): void {
		this.setupWallet(address);
		this.data.wallets[address].daily.byteCount += size;
		this.data.wallets[address].weekly.byteCount += size;
		this.data.wallets[address].total.byteCount += size;
	}

	private setupWallet(address: string): void {
		if (!this.data.wallets[address]) {
			this.data.wallets[address] = {
				daily: {
					fileCount: 0,
					byteCount: 0,
					changeInPercentage: 0,
					rankPosition: 0,
					tokensEarned: 0
				},
				weekly: {
					fileCount: 0,
					byteCount: 0,
					changeInPercentage: 0,
					rankPosition: 0,
					tokensEarned: 0
				},
				lastWeek: {
					fileCount: 0,
					byteCount: 0,
					changeInPercentage: 0,
					rankPosition: 0,
					tokensEarned: 0
				},
				total: {
					fileCount: 0,
					byteCount: 0,
					changeInPercentage: 0,
					rankPosition: 0,
					tokensEarned: 0
				}
			};
		}
	}

	write(): void {
		// TODO
		console.log('TODO: write this JSON', JSON.stringify(this.data, null, 4));
	}

	private readTemplate(): unknown {
		const data = readFileSync(OUTPUT_TEMPLATE_NAME);
		const dataAsString = data.toString();
		return JSON.parse(dataAsString);
	}

	public readOutputFile(): unknown {
		const data = readFileSync(OUTPUT_NAME);
		const dataAsString = data.toString();
		return JSON.parse(dataAsString);
	}

	private validateDataStructure(data: unknown): data is OutputData {
		const dataAsOutputData = data as OutputData;
		return !!(
			dataAsOutputData.PSTHolders &&
			dataAsOutputData.blockHeight &&
			dataAsOutputData.timestamp &&
			dataAsOutputData.wallets &&
			dataAsOutputData.ranks &&
			dataAsOutputData.ranks.daily &&
			dataAsOutputData.ranks.weekly &&
			dataAsOutputData.ranks.lastWeek &&
			dataAsOutputData.ranks.total
		);
	}
}
