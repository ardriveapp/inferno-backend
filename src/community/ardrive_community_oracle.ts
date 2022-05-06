import { ContractOracle } from './contract_oracle';
import { ArDriveContractOracle } from './ardrive_contract_oracle';
import { TransactionID } from '../types';

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
	constructor(readonly ardriveOracle: ArDriveContractOracle) {
		this.contractOracle = ardriveOracle;
	}

	private readonly contractOracle: ContractOracle;

	public async getArdriveVaults(): Promise<ArdriveVaults> {
		const contractState = (await this.contractOracle.readContract(ARDRIVE_CONTRACT_TX)) as {
			vault: { [address: string]: { start: number; end: number; balance: number }[] };
		};
		const { vault } = contractState;
		return vault;
	}
}
