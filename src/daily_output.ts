import { readFileSync } from 'fs';
import { OUTPUT_NAME, OUTPUT_TEMPLATE_NAME } from './constants';
import { OutputData } from './inferno_types';

export class DailyOutput {
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

	// write({
	// 	queryResult,
	// 	stakedPSTHolders
	// }: {
	// 	queryResult: GQLEdgeInterface[];
	// 	stakedPSTHolders: StakedPSTHolders;
	// }): void {
	// 	const previousData = this.read();

	// 	// hack to clone the data with different pointers
	// 	const data = JSON.parse(JSON.stringify(previousData));

	// 	queryResult.forEach((edge) => {
	// 		const ownerAddress = edge.node.owner;
	// 		const isMetadataTransaction = edge.node.
	// 	});
	// }

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
