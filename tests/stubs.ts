import Arweave from 'arweave';
import { ADDR, ArweaveAddress, TxID } from 'ardrive-core-js';

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
