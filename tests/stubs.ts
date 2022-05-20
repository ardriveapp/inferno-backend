import Arweave from 'arweave';
import { ArDriveContractOracle } from '../src/community/ardrive_contract_oracle';
import { GQLNodeInterface } from '../src/gql_types';
import { ADDR, ArweaveAddress, TxID } from '../src/types';

export const fakeArweave = Arweave.init({
	host: 'localhost',
	port: 443,
	protocol: 'https',
	timeout: 600000
});

export const stubArweaveAddress = (address = 'abcdefghijklmnopqrxtuvwxyz123456789ABCDEFGH'): ArweaveAddress => {
	return ADDR(address);
};

export const stubTxID = TxID('0000000000000000000000000000000000000000001');
export const stubCommunityContract = {
	settings: [['fee', 50]],
	vault: { [`${stubArweaveAddress()}`]: [{ balance: 500, start: 1, end: 2 }] },
	balances: { [`${stubArweaveAddress()}`]: 200 }
};

export const mockHeight = 100;
export const mockAddressRecipient = `${stubArweaveAddress()}`;
export const stubTxNode = (
	fee: number,
	tip: number,
	height: number,
	recipient: string,
	boost = 1
): GQLNodeInterface => ({
	fee: { winston: `${fee}`, ar: '' },
	quantity: { winston: `${tip}`, ar: '' },
	tags: [{ name: 'Boost', value: `${boost}` }],
	id: '',
	anchor: '',
	signature: '',
	recipient: recipient,
	owner: {
		address: '',
		key: ''
	},
	data: {
		size: 100,
		type: ''
	},
	block: {
		height: height,
		id: '',
		timestamp: 100,
		previous: ''
	},
	parent: {
		id: ''
	}
});

export const stubArdriveOracle = new ArDriveContractOracle([]);
