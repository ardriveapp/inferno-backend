import { ContractOracle, ContractReader } from './contract_oracle';
import { ArDriveContractOracle } from './ardrive_contract_oracle';
import Arweave from 'arweave';
import { SmartweaveContractReader } from './smartweave_contract_oracle';
import { TransactionID } from '../types';
import { RedstoneContractReader } from './redstone_contract_reader';

const ARDRIVE_CONTRACT_TX = new TransactionID('-8A6RexFkpfWwuyVO98wzSFZh0d6VJuI-buTJvlwOJQ');

export interface ArdriveContractState {
	state: { vault: ArdriveVaults };
}

export interface ArdriveVaults {
	[address: string]: {
		start: number;
		end: number;
		balance: number;
	}[];
}

export class ArDriveCommunityOracle {
	constructor(readonly arweave: Arweave, contractReaders?: ContractReader[]) {
		this.contractOracle = new ArDriveContractOracle(
			contractReaders ? contractReaders : this.defaultContractReaders
		);
	}

	private readonly contractOracle: ContractOracle;

	private defaultContractReaders: ContractReader[] = [
		new RedstoneContractReader(this.arweave),
		new SmartweaveContractReader(this.arweave)
	];

	public async getArdriveVaults(): Promise<ArdriveVaults> {
		const contractState = (await this.contractOracle.readContract(ARDRIVE_CONTRACT_TX)) as {
			vault: { [address: string]: { start: number; end: number; balance: number }[] };
		};
		const { vault } = contractState;
		return vault;
	}
}
