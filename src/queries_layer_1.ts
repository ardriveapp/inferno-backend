import fetch from 'node-fetch';
import { exponentialBackOffAfterFailedRequest } from './common';
import { MAX_RETRIES, WINSTON_AR_ASPECT } from './constants';
import { GQLEdgeInterface, GQLTagInterface } from './gql_types';
import { decodeTags, fromB64Url, sha256B64Url } from './utils/layer_one_helpers';

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

async function getAllTransactionsOfBlock(block: L1Block): Promise<L1Transaction[]> {
	let pendingRetries = MAX_RETRIES;
	let responseOk: boolean | undefined;

	while (!responseOk && pendingRetries >= 0) {
		const currentRetry = MAX_RETRIES - pendingRetries;
		if (pendingRetries !== MAX_RETRIES) {
			await exponentialBackOffAfterFailedRequest(currentRetry);
		}

		try {
			const txIDs = block.txs;
			const requests = txIDs.map((txId) => fetch(`https://arweave.net/tx/${txId}`));
			const responses = await Promise.all(requests);
			const transactions: L1Transaction[] = await Promise.all(responses.map((resp) => resp.json()));
			return transactions;
		} catch (e) {
			pendingRetries--;
			console.log(`Error was thrown (${currentRetry}): ${e}`);
			continue;
		}
	}
	throw new Error(`Retries on the transactions query failed! Block: ${block.height}`);
}

async function getBlock(height: number): Promise<L1Block> {
	let pendingRetries = MAX_RETRIES;
	let responseOk: boolean | undefined;

	while (!responseOk && pendingRetries >= 0) {
		const currentRetry = MAX_RETRIES - pendingRetries;
		if (pendingRetries !== MAX_RETRIES) {
			await exponentialBackOffAfterFailedRequest(currentRetry);
		}

		try {
			const url = `https://arweave.net/block/height/${height}`;
			const response = await fetch(url);
			const block: L1Block = await response.json();
			return block;
		} catch (e) {
			pendingRetries--;
			console.log(`Error was thrown (${currentRetry}): ${e}`);
			continue;
		}
	}
	throw new Error(`Retries on the block query failed! Block: ${height}`);
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
