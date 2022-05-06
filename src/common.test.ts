import { expect } from 'chai';
import { calculateTipPercentage, validateTxTip } from './common';
import { stub } from 'sinon';
import { mockAddressRecipient, mockHeight, stubArdriveOracle, stubTxNode } from '../tests/stubs';

describe('common methods', () => {
	describe('calculateTipPercentage function', () => {
		it('returns the expected value when not boosted', () => {
			const percentage = calculateTipPercentage(1000, 1, 1000);
			expect(percentage).to.equal(100);

			const noTipPercentage = calculateTipPercentage(1000, 1, 0);
			expect(noTipPercentage).to.equal(0);
		});

		it('returns the expected value when boosted', () => {
			const percentage = calculateTipPercentage(1000, 10, 1000);
			expect(percentage).to.equal(1000);
		});
	});

	describe('validateTxTip function', () => {
		beforeEach(() => {
			stub(stubArdriveOracle, 'wasValidPSTHolder').callsFake(
				(height: number, recipient: string): Promise<boolean> => {
					if (height === mockHeight) {
						return Promise.resolve(recipient === mockAddressRecipient);
					}
					return Promise.resolve(false);
				}
			);
		});

		it('returns true if the tip percentage and recipient are valid', async () => {
			const stubNode = stubTxNode(1000, 150, mockHeight, mockAddressRecipient);
			const isValid = await validateTxTip(stubNode, stubArdriveOracle);
			expect(isValid).to.be.true;
		});

		it('returns true if the tip percentage and recipient are valid when boosted', async () => {
			const stubNode = stubTxNode(10000, 150, mockHeight, mockAddressRecipient, 10);
			const isValid = await validateTxTip(stubNode, stubArdriveOracle);
			expect(isValid).to.be.true;
		});

		it('returns false if the tip percentage is invalid', async () => {
			const stubNode = stubTxNode(100000, 150, mockHeight, mockAddressRecipient, 10);
			const isValid = await validateTxTip(stubNode, stubArdriveOracle);
			expect(isValid).to.be.false;
		});

		it('returns false if the tip recipient was not a PST holder', async () => {
			const stubNode = stubTxNode(1000, 150, mockHeight, 'wrongAddressRecipient');
			const isValid = await validateTxTip(stubNode, stubArdriveOracle);
			expect(isValid).to.be.false;
		});
	});
});
