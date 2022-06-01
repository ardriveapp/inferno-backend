import axios, { AxiosInstance } from 'axios';
import axiosRetry, { exponentialDelay } from 'axios-retry';
import { MAX_RETRIES } from '../constants';
import { TransactionID } from '../types';
import { ContractReader } from './contract_oracle';

/**
 *  Oracle class responsible for retrieving and
 *  reading Smartweave Contracts from the Verto cache
 */
export class VertoContractReader implements ContractReader {
	/** Fetches smartweave contracts from the Verto cache */
	public async readContract(txId: TransactionID): Promise<unknown> {
		const axiosInstance: AxiosInstance = axios.create();
		axiosRetry(axiosInstance, {
			retries: MAX_RETRIES,
			retryDelay: (retryNumber) => {
				// 	console.error(`Retry attempt ${retryNumber}/${maxRetries} of request to ${reqURL}`);
				return exponentialDelay(retryNumber);
			}
		});
		const response = await axiosInstance.get(`https://v2.cache.verto.exchange/${txId}`);
		const contract = response.data;
		return contract.state;
	}
}
