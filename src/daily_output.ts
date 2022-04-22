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
		const dataAsString = data.toString();
		const dataAsJSON: OutputData = JSON.parse(dataAsString);
		if (!this.validateDataStructure(dataAsJSON)) {
			throw new Error(`The output JSON has a wrong structure`);
		}
		return dataAsJSON;
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

	private readTemplate(): Buffer {
		return readFileSync(OUTPUT_TEMPLATE_NAME);
	}

	public readOutputFile(): Buffer {
		return readFileSync(OUTPUT_NAME);
	}

	private validateDataStructure(data: OutputData): boolean {
		return !!(
			data.PSTHolders &&
			data.blockHeight &&
			data.timestamp &&
			data.wallets &&
			data.ranks &&
			data.ranks.daily &&
			data.ranks.weekly &&
			data.ranks.lastWeek &&
			data.ranks.total
		);
	}
}
