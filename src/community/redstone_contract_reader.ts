import Arweave from 'arweave';
import { SmartWeave, SmartWeaveNodeFactory } from 'redstone-smartweave';
import { TransactionID } from '../types';
import { ContractReader } from './contract_oracle';

/**
 *  Oracle class responsible for retrieving and reading
 *  Smartweave Contracts from Arweave with the `redstone-smartweave` package
 */
export class RedstoneContractReader implements ContractReader {
	smartweave: SmartWeave;

	constructor(arweave: Arweave) {
		this.smartweave = SmartWeaveNodeFactory.memCachedBased(arweave).useRedStoneGateway().build();
	}

	/** Fetches smartweave contracts from Arweave with smartweave-js */
	async readContract(txId: TransactionID, height?: number): Promise<unknown> {
		const contract = this.smartweave.contract(`${txId}`);
		const result = await contract.readState(height);
		return result.state;
	}
}
