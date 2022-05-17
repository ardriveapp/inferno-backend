import { expect } from 'chai';
import {
	calculateTipPercentage,
	dateToEST,
	dateToSunday,
	dateToUTC,
	daysDiffInEST,
	isSemanticVersionGreaterThan,
	validateTxTip,
	weeksDiffInEST
} from './common';
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

	const mockDateTimestamp = 1651785959180;
	const anHourInMilliseconds = 1000 * 60 * 60;
	const aDayInMilliseconds = anHourInMilliseconds * 24;
	const aWeekInMilliseconds = aDayInMilliseconds * 7;
	const sameDay = [new Date(mockDateTimestamp), new Date(mockDateTimestamp + 1000)];
	const differentDay = [new Date(mockDateTimestamp), new Date(mockDateTimestamp + 2 * aDayInMilliseconds)];
	const differentWeek = [new Date(mockDateTimestamp), new Date(mockDateTimestamp + 2 * aWeekInMilliseconds)];
	describe('daysDiffInEST function', () => {
		it('return 0 when both dates are in the same EST day', () => {
			const [prev, curr] = sameDay;
			expect(daysDiffInEST(prev, curr)).to.equal(0);
		});

		it('return 2 when the dates have two days of difference in EST time', () => {
			const [prev, curr] = differentDay;
			expect(daysDiffInEST(prev, curr)).to.equal(2);
		});
	});

	describe('weeksDiffInEST function', () => {
		it('return 0 when both dates are in the same EST week', () => {
			const [prev, curr] = sameDay;
			expect(weeksDiffInEST(prev, curr)).to.equal(0);
		});

		it('return 2 when the dates have two weeks of difference in EST time', () => {
			const [prev, curr] = differentWeek;
			expect(weeksDiffInEST(prev, curr)).to.equal(2);
		});
	});

	describe('dateToEST function', () => {
		it('returns a date with 4hs behind UTC', () => {
			const dateInLocalTime = new Date(mockDateTimestamp);
			const dateInUTC = dateToUTC(dateInLocalTime);
			const dateInEST = dateToEST(dateInLocalTime);

			const utcDiff = dateInLocalTime.getTime() - dateInUTC.getTime();
			const estUtcDiff = dateInUTC.getTime() - dateInEST.getTime();

			expect(estUtcDiff).to.equal(anHourInMilliseconds * 4);
			// we've set the timezone (TZ env var) to be 5h ahead of GMT
			expect(utcDiff).to.be.equal(anHourInMilliseconds * -5);
		});
	});

	describe('dateToSunday method', () => {
		it('returns a date in the first second of this week (sunday)', () => {
			const dateOnThursday = new Date(mockDateTimestamp);
			const dateOnPrevSunday = dateToSunday(dateOnThursday);
			const diffInMilliseconds = dateOnThursday.getTime() - dateOnPrevSunday.getTime();

			expect(diffInMilliseconds).to.be.lessThan(aWeekInMilliseconds);
			expect(dateOnPrevSunday.getDay()).to.equal(0);
			expect(dateOnPrevSunday.getHours()).to.equal(0);
			expect(dateOnPrevSunday.getMinutes()).to.equal(0);
			expect(dateOnPrevSunday.getSeconds()).to.equal(0);
			expect(dateOnPrevSunday.getMilliseconds()).to.equal(0);
		});

		it('returns a date in the same day if already on sunday', () => {
			const dateOnSunday = new Date(1651381200003);
			const toSunday = dateToSunday(dateOnSunday);
			const diffInMilliseconds = dateOnSunday.getTime() - toSunday.getTime();

			expect(diffInMilliseconds).to.be.lessThanOrEqual(aDayInMilliseconds);
			expect(toSunday.getDay()).to.equal(0);
			expect(toSunday.getHours()).to.equal(0);
			expect(toSunday.getMinutes()).to.equal(0);
			expect(toSunday.getSeconds()).to.equal(0);
			expect(toSunday.getMilliseconds()).to.equal(0);
			expect(toSunday.getDay()).to.equal(dateOnSunday.getDay());
			expect(toSunday.getDate()).to.equal(dateOnSunday.getDate());
		});
	});

	describe('isSemanticVersionGreaterThan method', () => {
		const v1_14_1 = '1.14.1';
		const v1_14_0 = '1.14.0';
		const v1_15_0 = '1.15.0';

		it('returns true if the first version is greater than the latter', () => {
			expect(isSemanticVersionGreaterThan(v1_15_0, v1_14_1)).to.be.true;
			expect(isSemanticVersionGreaterThan(v1_15_0, v1_14_0)).to.be.true;
			expect(isSemanticVersionGreaterThan(v1_14_1, v1_14_0)).to.be.true;
		});

		it('returns false if the first version is less than the latter', () => {
			expect(isSemanticVersionGreaterThan(v1_14_1, v1_15_0)).to.be.false;
			expect(isSemanticVersionGreaterThan(v1_14_0, v1_15_0)).to.be.false;
			expect(isSemanticVersionGreaterThan(v1_14_0, v1_14_1)).to.be.false;
		});

		it('returns false if the values are the same', () => {
			expect(isSemanticVersionGreaterThan(v1_14_0, v1_14_0)).to.be.false;
			expect(isSemanticVersionGreaterThan(v1_14_1, v1_14_1)).to.be.false;
			expect(isSemanticVersionGreaterThan(v1_15_0, v1_15_0)).to.be.false;
		});
	});
});
