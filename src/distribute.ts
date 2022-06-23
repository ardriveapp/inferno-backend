import { readFileSync, writeFileSync } from 'fs';
import { normalize as normalizePath } from 'path';
import Transaction from 'arweave/node/lib/transaction';
import { arweave } from './common';
import { communityTxId } from './community/ardrive_contract_oracle';
import type { Rewards } from './inferno_types';
import { downloadOutputFile } from './utils/download_output';

export type TransactionToDistribute = {
	id: string;
	tx: Transaction;
	target: string;
	qty: number;
	rankPosition: number;
};

// Get the key file
const keyfile = process.env.KEYFILE ? parseKeyFile(process.env.KEYFILE) : undefined;

export async function distributeTokens(confirm: boolean) {
	console.log('========= DOWNLOADING RANK =========');

	const data = await downloadOutputFile();
	const lastWeekRank = data.ranks.lastWeek;

	if (!keyfile) {
		throw new Error("There's no keyfile to create transactions with");
	}

	if (confirm) {
		console.log('========= CREATING TRANSACTIONS =========');
	} else {
		console.log('DRY-RUN: THE SCRIPT IS NOT POSTING TRANSACTIONS');
	}

	const addresses = lastWeekRank.groupEffortRewards.filter((wallet) => wallet.rewards > 0);

	if (addresses.length === 0) {
		console.log('No wallets have reached the miminum effort to win rewards');
		return;
	}

	const transactions = await createTokenDistributionTransactions(addresses);

	if (confirm) {
		console.log('========= SENDING TRANSACTIONS =========');
	}

	const transactionsToReport: { id: string; qty: number; rankPosition: number }[] = [];

	for (const transaction of transactions) {
		if (!confirm) {
			console.log(transaction);
			return;
		}

		const transactionSent = await sendTokenDistributionTransaction(transaction);
		if (transactionSent) {
			writeFileSync(normalizePath(`./distribution/${transaction.id}`), JSON.stringify(transaction, null, '\t'));
			transactionsToReport.push({
				id: transaction.id,
				qty: transaction.qty,
				rankPosition: transaction.rankPosition
			});
		}
	}

	console.log('Writing report to distribution/report.json');
	writeFileSync(normalizePath('./distribution/report.json'), JSON.stringify(transactionsToReport, null, '\t'));
}

export async function createTokenDistributionTransactions(wallets: Rewards): Promise<TransactionToDistribute[]> {
	const transactions: TransactionToDistribute[] = [];

	for (const wallet of wallets) {
		const { address, rewards, rankPosition } = wallet;
		console.log(`Creating transaction to send ${rewards} ARDRIVE to ${address}
`);

		const tags = {
			'App-Name': 'SmartWeaveAction',
			'App-Version': '0.3.0',
			Cannon: 'ArDrive Usage Rewards: Inferno',
			Contract: communityTxId, // The ArDrive Profit Sharing Community Contract
			Input: JSON.stringify({
				function: 'transfer',
				target: address,
				qty: rewards
			})
		};

		const tx = await arweave.createTransaction(
			{
				target: address,
				data: Math.random().toString().slice(-4)
			},
			keyfile
		);
		// Increase the default reward by 2.5x to ensure these transactions get processed in the mempool
		tx.reward = Math.floor(+tx.reward * 2.5).toString();

		// Add tags
		for (const [key, value] of Object.entries(tags)) {
			tx.addTag(key, value.toString());
		}

		await arweave.transactions.sign(tx, keyfile);

		transactions.push({
			id: tx.id,
			tx,
			target: address,
			qty: rewards,
			rankPosition
		});
	}

	return transactions;
}

export async function sendTokenDistributionTransaction(transaction: TransactionToDistribute): Promise<boolean> {
	const { tx, target, qty } = transaction;

	if (qty === 0) {
		console.log(`Can't send transaction for wallet ${target} as it doesn't have any reward`);
		return false;
	}

	try {
		console.log(`Sending transaction ${tx.id}\n- to ${target}\n- ${qty} ARDRIVE`);
		await arweave.transactions.post(tx);
		return true;
	} catch (err) {
		console.log(`ERROR posting transaction ${tx.id}`, err);
		return false;
	}
}

function parseKeyFile(keyfile: string) {
	try {
		return JSON.parse(readFileSync(keyfile).toString());
	} catch (err) {
		const message = (err instanceof Error && err.message) || JSON.stringify(err);
		throw new Error(message);
	}
}
