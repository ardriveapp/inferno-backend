import { GQLEdgeInterface } from 'ardrive-core-js';
import { readFileSync, writeFileSync } from 'fs';
import { GROUP_EFFORT_REWARDS, ONE_GiB, OUTPUT_NAME, OUTPUT_TEMPLATE_NAME } from './constants';
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

	private finishDataAggregation(): void {
		this.data.blockHeight = this.latestBlock;
		this.data.timestamp = this.latestTimestamp;

		// sort addresses by ranking
		const addresses = Object.keys(this.data.wallets);
		const groupEffortRankings = addresses.sort((a, b) => {
			// FIXME: randomize ties
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

		// check if the minimum group effor was reached
		const groupEffortParticipants = groupEffortRankings.filter(
			(address) => this.data.wallets[address].weekly.byteCount >= ONE_GiB
		);
		const hasReachedMinimumGroupEffort = groupEffortParticipants.length >= 50;
		this.data.ranks.daily.hasReachedMinimumGroupEffort = hasReachedMinimumGroupEffort;
		this.data.ranks.weekly.hasReachedMinimumGroupEffort = hasReachedMinimumGroupEffort;

		// calculate rewards
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
	}

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

	write(): void {
		// TODO
		// console.log('TODO: write this JSON', JSON.stringify(this.data, null, 4));
		if (!this.validateDataStructure(this.data)) {
			throw new Error(`Cannot save invalid output: ${JSON.stringify(this.data)}`);
		}
		writeFileSync(OUTPUT_NAME, JSON.stringify(this.data, null, '\t'));
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
