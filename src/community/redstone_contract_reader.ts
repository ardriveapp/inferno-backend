import Arweave from 'arweave';
import { Contract, SmartWeaveNodeFactory, SmartWeave } from 'redstone-smartweave';
import { TransactionID } from '../types';
import { communityTxId } from './ardrive_contract_oracle';
import { ContractReader } from './contract_oracle';

/**
 *  Oracle class responsible for retrieving and reading
 *  Smartweave Contracts from Arweave with the `redstone-smartweave` package
 */
export class RedstoneContractReader implements ContractReader {
	private readonly smartweave: SmartWeave;
	private static ardriveContract: Contract;

	constructor(arweave: Arweave) {
		this.smartweave = SmartWeaveNodeFactory.memCachedBased(arweave).useRedStoneGateway().build();
		RedstoneContractReader.ardriveContract = this.smartweave.contract(communityTxId);
	}

	/** Fetches smartweave contracts from Arweave with smartweave-js */
	async readContract(txId: TransactionID, height?: number): Promise<unknown> {
		const contract: Contract =
			`${txId}` === communityTxId ? RedstoneContractReader.ardriveContract : this.smartweave.contract(`${txId}`);
		const result = await contract.readState(height);
		return result.state;
	}
}
