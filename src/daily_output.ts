import { GQLEdgeInterface } from 'ardrive-core-js';
import { readFileSync, writeFileSync } from 'fs';
import { GROUP_EFFORT_REWARDS, ONE_THOUSAND_MB, OUTPUT_NAME, OUTPUT_TEMPLATE_NAME } from './constants';
import { OutputData, StakedPSTHolders } from './inferno_types';

/**
 * A class responsible of parsing the GQL and CommunityOracle data into the OutputData file
 */
export class DailyOutput {
	private data = this.read();
	private latestBlock = 0;
	private latestTimestamp = 0;
	private bundlesTips: { [address: string]: boolean } = {};

	/**
	 * Takes the data from the previously generated data, fallbacking to the base template if not present
	 * @throws if the validation of the output file fails
	 * @retuns {OutputData}
	 */
	public read(): OutputData {
		const data = (() => {
			try {
				return this.readOutputFile();
			} catch (err) {
				console.info(`The output file hasn't yet been created. Using the file template`);
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
	feedPSTHolders(stakedPSTHolders: StakedPSTHolders): void {
		this.data.PSTHolders = stakedPSTHolders;
	}

	/**
	 * @param {GQLEdgeInterface[]} queryResult the edges of ArFSTransactions only - 50 block before the latest
	 */
	feedGQLData(queryResult: GQLEdgeInterface[]): void {
		const previousData = this.read();
		const previousTimestamp = previousData.timestamp;
		const previousBlockHeight = previousData.blockHeight;
		const previousDate = new Date(previousTimestamp);

		const firstQueryResult = queryResult[0];
		const firstBlockHeight = firstQueryResult.node.block.height;

		if (previousBlockHeight >= firstBlockHeight) {
			throw new Error('That block was already processed!');
		}

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

	/**
	 * From the fed data, derivate:
	 * - the ranking,
	 * - the change in percentage of the upload voume,
	 * - wether or not the group effort reached the minimum requirements,
	 * - group effort rewards, and
	 * - streak rewards
	 */
	private finishDataAggregation(): void {
		this.data.blockHeight = this.latestBlock;
		this.data.timestamp = this.latestTimestamp;

		// sort addresses by ranking
		const addresses = Object.keys(this.data.wallets);
		const groupEffortRankings = addresses.sort((a, b) => {
			const uploadedData_a = this.data.wallets[a].daily.byteCount;
			const uploadedData_b = this.data.wallets[b].daily.byteCount;
			return uploadedData_a - uploadedData_b;
		});

		// calculate change in percentage of the uploaded data and rank position
		groupEffortRankings.forEach((address) => {
			const uploadedDataYesterday = this.data.wallets[address].yesterday.byteCount;
			const uploadedDataToday = this.data.wallets[address].daily.byteCount;
			const changeInPercentage = ((uploadedDataToday - uploadedDataYesterday) / uploadedDataToday) * 100;
			this.data.wallets[address].daily.changeInPercentage = changeInPercentage;
		});

		// check if the minimum group effort was reached
		const groupEffortParticipants = groupEffortRankings.filter(
			(address) => this.data.wallets[address].weekly.byteCount >= ONE_THOUSAND_MB
		);
		const hasReachedMinimumGroupEffort = groupEffortParticipants.length >= 50;
		this.data.ranks.daily.hasReachedMinimumGroupEffort = hasReachedMinimumGroupEffort;
		this.data.ranks.weekly.hasReachedMinimumGroupEffort = hasReachedMinimumGroupEffort;

		// compute group effort rewards
		if (hasReachedMinimumGroupEffort) {
			const ties = groupEffortParticipants.reduce((accumulator, address) => {
				const clone = Object.assign({}, accumulator);
				const byteCount = this.data.wallets[address].weekly.byteCount;
				if (!clone[byteCount]) {
					clone[byteCount] = [address];
				} else {
					clone[byteCount].push(address);
				}
				return clone;
			}, {} as { [byteCount: number]: string[] });

			const shuffledTies = Object.keys(ties)
				.map((byteCount) => {
					const tie = ties[+byteCount];
					return tie
						.map((value) => ({ value, sort: Math.random() }))
						.sort((a, b) => a.sort - b.sort)
						.map(({ value }) => value);
				})
				.reduce((accumulator, tie) => {
					const clone = accumulator.slice();
					clone.push(...tie);
					return clone;
				}, []);

			shuffledTies.forEach((address, index) => (this.data.wallets[address].daily.rankPosition = index + 1));

			const top50 = shuffledTies.slice(0, 49);

			this.data.ranks.daily.groupEffortRewards = top50.map((address, index) => {
				return { address, rewards: GROUP_EFFORT_REWARDS[index] };
			});
		}

		// compute streak rewards
		// const stakedPSTHolders = Object.keys(this.data.PSTHolders);
		// TODO: determine if the wallets has uploaded data for 7 days in a row
	}

	/**
	 * Will copy the data of today into yesterday's and clear the today's data
	 */
	private resetDay(): void {
		const addresses = Object.keys(this.data.wallets);
		for (const address in addresses) {
			this.data.wallets[address].yesterday = this.data.wallets[address].daily;
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

	/**
	 * Will copy the data of the current week into the past one and clear the data of the current week
	 */
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
		const entityTypeTag = tags.find((tag) => tag.name === 'Entity-Type')?.value;
		const bundledIn = tags.find((tag) => tag.name === 'Bundled-In')?.value;
		const bundleVersion = tags.find((tag) => tag.name === 'Bundle-Version')?.value;
		const isMetadataTransaction = !!entityTypeTag && !bundleVersion;
		const isBundleTransaction = !!bundleVersion;

		if (isMetadataTransaction) {
			const isFileMetadata = entityTypeTag === 'file';
			if (isFileMetadata) {
				this.sumFile(ownerAddress);
			}
		} else if (isBundleTransaction) {
			this.bundlesTips[txId] = !!tip;
		} else {
			// is file data transaction

			if (!tip) {
				// TODO: check for the validity of the addres recieving the tip
				// const fee = +node.fee.winston;
				// // if boosted, the tip ratio will be greater than 15
				// const tipRatio = fee / tip;
				// const correctTipRatio = tipRatio >= 15;
				// const recipient = node.recipient;

				const isBundledTransaction = !!bundledIn;
				if (isBundledTransaction) {
					const isTipPresent = this.bundlesTips[bundledIn];
					if (isTipPresent === undefined) {
						throw new Error("Bundle transaction wasn't read. Cannot calculate tip");
					}
					if (!isTipPresent) {
						// Discard bundled transactions without a tip
						return;
					}
				} else {
					// Discards V2 transactions without a tip
					return;
				}
			}

			const dataSize = +node.data.size;
			this.sumSize(ownerAddress, dataSize);
		}

		this.latestBlock = Math.max(this.latestBlock, node.block.height);
		this.latestTimestamp = Math.max(this.latestTimestamp, node.block.timestamp);
	};

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
	 * Will fill the data of a wallet if no present
	 * @param address the address of whom to fill the data
	 */
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
				yesterday: {
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

	/**
	 * Stores the JSON output of the class instance
	 * @throws if the JSON data is invalid
	 */
	public write(): void {
		if (!this.validateDataStructure(this.data)) {
			throw new Error(`Cannot save invalid output: ${JSON.stringify(this.data)}`);
		}
		writeFileSync(OUTPUT_NAME, JSON.stringify(this.data, null, '\t'));
		console.log(`Output saved at ${OUTPUT_NAME}`);
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
