import axios, { AxiosInstance } from 'axios';
import axiosRetry, { exponentialDelay } from 'axios-retry';
import { WINSTON_AR_ASPECT } from './constants';
import { GQLEdgeInterface, GQLTagInterface } from './gql_types';
import { decodeTags, fromB64Url, sha256B64Url } from './utils/layer_one_helpers';
import * as pLimit from 'p-limit';

const maxRetries = 8;

export async function getAllParsedTransactionsOfBlock(height: number): Promise<GQLEdgeInterface[]> {
	const block = await getBlock(height);
	const txs = await getAllTransactionsOfBlock(block);
	return txs.map(parseLayer1Tx.bind(undefined, block));
}

function parseLayer1Tx(block: L1Block, tx: L1Transaction): GQLEdgeInterface {
	const edge: GQLEdgeInterface = {
		cursor: 'unused',
		node: {
			id: tx.id,
			signature: tx.signature,
			recipient: tx.target,
			quantity: {
				winston: tx.quantity,
				ar: `${+tx.quantity / WINSTON_AR_ASPECT}`
			},
			fee: {
				winston: tx.reward,
				ar: `${+tx.reward / WINSTON_AR_ASPECT}`
			},
			data: {
				size: +tx.data_size,
				type: ''
			},
			block: {
				height: block.height,
				timestamp: block.timestamp,
				id: block.hash,
				previous: block.previous_block
			},
			owner: {
				address: sha256B64Url(fromB64Url(tx.owner)),
				key: tx.owner
			},
			parent: {
				id: tx.last_tx
			},
			anchor: 'unused',
			tags: decodeTags(tx.tags)
		}
	};
	return edge;
}

async function getAllTransactionsOfBlock(
	block: L1Block,
	axiosInstance: AxiosInstance = axios.create()
): Promise<L1Transaction[]> {
	const blockTxIDs = block.txs;

	axiosRetry(axiosInstance, {
		retries: maxRetries,
		retryDelay: (retryNumber) => {
			// 	console.error(`Retry attempt ${retryNumber}/${maxRetries} of request to ${reqURL}`);
			return exponentialDelay(retryNumber);
		}
	});

	const parallelize = pLimit.default(25);

	const responses = await Promise.all(
		blockTxIDs.map((txid) => {
			return parallelize(() => {
				return axiosInstance.get(`https://arweave.net/tx/${txid}`);
			});
		})
	);

	responses.forEach((resp) => {
		if (resp.status !== 200) {
			console.log(`Response code (${resp.status}): ${resp.statusText}`);
		}
	});

	return responses.map((resp) => resp.data);
}

async function getBlock(height: number, axiosInstance: AxiosInstance = axios.create()): Promise<L1Block> {
	axiosRetry(axiosInstance, {
		retries: maxRetries,
		retryDelay: (retryNumber) => {
			// 	console.error(`Retry attempt ${retryNumber}/${maxRetries} of request to ${reqURL}`);
			return exponentialDelay(retryNumber);
		}
	});
	const url = `https://arweave.net/block/height/${height}`;
	const response = await axiosInstance.get(url);
	const block: L1Block = response.data;
	return block;
}

interface L1Block {
	nonce: string;
	previous_block: string;
	timestamp: number;
	last_retarget: number;
	diff: number;
	height: number;
	hash: string;
	indep_hash: string;
	txs: string[];
	tx_root: string;
	tx_tree: string[];
	wallet_list: string;
	reward_addr: string;
	tags: GQLTagInterface[];
	reward_pool: number;
	weave_size: number;
	block_size: number;
	poa: {
		option: string;
		tx_path: string;
		data_path: string;
		chunk: string;
	};
}

interface L1Transaction {
	format: number;
	id: string;
	last_tx: string;
	owner: string;
	tags: GQLTagInterface[];
	target: string;
	quantity: string;
	data: string;
	data_size: string;
	data_tree: string[];
	data_root: string;
	reward: string;
	signature: string;
}
