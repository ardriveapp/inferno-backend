import chai, { expect } from 'chai';
import { stub, spy } from 'sinon';
import sinonChai from 'sinon-chai';
import { arweave } from './common';
import { stubArweaveAddress, stubTxID } from '../tests/stubs';
import { createTokenDistributionTransactions, sendTokenDistributionTransaction } from './distribute';
import type { TransactionToDistribute } from './distribute';
import Transaction from 'arweave/node/lib/transaction';
import { Rewards } from './inferno_types';

chai.use(sinonChai);

function createFakeTransaction(qty: number) {
	return {
		id: stubTxID,
		tx: {},
		target: stubArweaveAddress(),
		qty,
		rankPosition: 100
	} as unknown as TransactionToDistribute;
}

// eslint-disable-next-line
const dummyAddTag = () => {};

describe('distribute', () => {
	describe('createTokenDistributionTransactions function', () => {
		beforeEach(() => {
			stub(arweave, 'createTransaction').callsFake(() => {
				return Promise.resolve({ id: stubTxID, addTag: dummyAddTag }) as unknown as Promise<Transaction>;
			});
			stub(arweave, 'transactions').value({
				sign: () => Promise.resolve(true)
			});
		});

		it('returns a list of transactions given a rank', async () => {
			const rank: Rewards = [
				{
					address: `${stubArweaveAddress()}`,
					rewards: 10,
					rankPosition: 1
				},
				{
					address: `${stubArweaveAddress()}`,
					rewards: 8,
					rankPosition: 2
				},
				{
					address: `${stubArweaveAddress()}`,
					rewards: 6,
					rankPosition: 3
				}
			];

			const transactions = await createTokenDistributionTransactions(rank);
			for (const [index, transaction] of transactions.entries()) {
				const { id, target, qty, rankPosition } = transaction;

				expect(id).to.equal(stubTxID);
				expect(target).to.equal(rank[index].address);
				expect(qty).to.equal(rank[index].rewards);
				expect(rankPosition).to.equal(rank[index].rankPosition);
			}
		});
	});

	describe('sendTokenDistributionTransaction function', () => {
		it('returns false if transaction has 0 quantity', async () => {
			const spyConsole = spy(console, 'log');
			const transaction = createFakeTransaction(0);

			const sent = await sendTokenDistributionTransaction(transaction);
			expect(sent).to.be.false;
			expect(spyConsole).to.have.been.calledWith(
				`Can't send transaction for wallet ${stubArweaveAddress()} as it doesn't have any reward`
			);
		});

		it('returns true if transaction was successfully sent', async () => {
			stub(arweave, 'transactions').value({
				post: () => Promise.resolve(true)
			});

			const transaction = createFakeTransaction(10);

			const sent = await sendTokenDistributionTransaction(transaction);
			expect(sent).to.be.true;
		});

		it('returns false if transaction was not successfully sent', async () => {
			stub(arweave, 'transactions').value({
				post: () => {
					throw new Error();
				}
			});

			const transaction = createFakeTransaction(10);

			const sent = await sendTokenDistributionTransaction(transaction);
			expect(sent).to.be.false;
		});
	});
});
