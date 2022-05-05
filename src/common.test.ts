import { expect } from 'chai';
import { calculateTipPercentage } from './common';

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
});
