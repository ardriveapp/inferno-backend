import { copyFileSync, existsSync, rmSync, writeFileSync } from 'fs';
import { expect } from 'chai';
import { stub } from 'sinon';
import {
	calculateTipPercentage,
	changeInPercentage,
	dateToEST,
	dateToSunday,
	dateToUTC,
	daysDiffInEST,
	isSemanticVersionGreaterThan,
	readInitialOutputFile,
	readOutputFile,
	readOutputTemplateFile,
	validateTxTip,
	weeksDiffInEST
} from './common';
import { mockAddressRecipient, mockHeight, stubArdriveOracle, stubTxNode } from '../tests/stubs';
import { OUTPUT_NAME, OUTPUT_TEMPLATE_NAME } from './constants';
import { OutputData } from './inferno_types';

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

	describe('changeInPercentage function', () => {
		it('returns zero if both values are zero', () => {
			expect(changeInPercentage(0, 0)).to.equal(0);
		});

		it('returns 1 if the previous value is zero and the current is greater', () => {
			expect(changeInPercentage(0, 1)).to.equal(1);
		});

		it('returns -1 if the previous is positive and the current is zero', () => {
			expect(changeInPercentage(10, 0)).to.equal(-1);
		});

		it('returns 0.5 if the previous is 100 and the current is 150', () => {
			expect(changeInPercentage(100, 150)).to.equal(0.5);
		});

		it('returns -0.5 if the previous is 100 and the current is 50', () => {
			expect(changeInPercentage(100, 50)).to.equal(-0.5);
		});

		it('returns -0.99 if the previous is 300 and the current is 1', () => {
			expect(changeInPercentage(300, 1)).to.equal(-0.9966666666666667);
		});

		it('returns -0.66 if the previous is 300 and the current is 100', () => {
			expect(changeInPercentage(300, 100)).to.equal(-0.6666666666666666);
		});

		it('returns 2 if the previous is 50 and the current is 150', () => {
			expect(changeInPercentage(50, 150)).to.equal(2);
		});
	});

	// this JSON is different than the base template
	const mockDailyOutput: OutputData = {
		lastUpdated: 914200,
		blockHeight: 914200,
		timestamp: 1650043449000,
		PSTHolders: {},
		wallets: {},
		ranks: {
			daily: {
				hasReachedMinimumGroupEffort: false,
				groupEffortRewards: [],
				streakRewards: []
			},
			weekly: {
				hasReachedMinimumGroupEffort: false,
				groupEffortRewards: [],
				streakRewards: []
			},
			lastWeek: {
				hasReachedMinimumGroupEffort: false,
				groupEffortRewards: [],
				streakRewards: []
			},
			total: {
				groupEffortRewards: [],
				streakRewards: []
			}
		}
	};

	// The above JSON stringified with tabs and a trailing new line
	const mockStringifyWithTabsAndTrailingNewLine = `${JSON.stringify(mockDailyOutput, null, '\t')} \n`;

	// a valid JSON with missing mandatory fields
	const mockMalformedDailyOutput = {
		lastUpdated: 914200,
		blockHeight: 914200,
		timestamp: 1650043449000,
		PSTHolders: {},
		// wallets: {},
		ranks: {
			daily: {
				hasReachedMinimumGroupEffort: false,
				groupEffortRewards: [],
				streakRewards: []
			},
			weekly: {
				hasReachedMinimumGroupEffort: false,
				groupEffortRewards: [],
				streakRewards: []
			},
			lastWeek: {
				hasReachedMinimumGroupEffort: false,
				groupEffortRewards: [],
				streakRewards: []
			}
			// total: {
			// 	groupEffortRewards: [],
			// 	streakRewards: []
			// }
		}
	};

	// The above JSON stringified with tabs and a trailing new line
	const mockMalformedStringifyWithTabsAndTrailingNewLine = `${JSON.stringify(
		mockMalformedDailyOutput,
		null,
		'\t'
	)} \n`;

	describe('readOutputFile', () => {
		before(() => {
			if (existsSync(OUTPUT_NAME)) {
				rmSync(OUTPUT_NAME);
			}
		});

		after(() => {
			if (existsSync(OUTPUT_NAME)) {
				rmSync(OUTPUT_NAME);
			}
		});

		it('return the template if the file is not present', () => {
			expect(readOutputFile).to.throw();
		});

		it('return the actual file if present', () => {
			writeFileSync(OUTPUT_NAME, mockStringifyWithTabsAndTrailingNewLine);
			expect(readOutputFile()).to.deep.equal(mockDailyOutput);
		});

		it('throws if the file has missing fields', () => {
			writeFileSync(OUTPUT_NAME, mockMalformedStringifyWithTabsAndTrailingNewLine);
			expect(readOutputFile).to.throw();
		});

		it('throws if the file is a corrupted JSON', () => {
			writeFileSync(OUTPUT_NAME, '!{{ NOT A VALID JSON "": false');
			expect(readOutputFile).to.throw();
		});
	});

	describe('readOutputTemplateFile', () => {
		const OUTPUT_TEMPLATE_NAME_BACKUP = `${OUTPUT_TEMPLATE_NAME}.bak`;

		before(() => {
			if (existsSync(OUTPUT_TEMPLATE_NAME)) {
				copyFileSync(OUTPUT_TEMPLATE_NAME, OUTPUT_TEMPLATE_NAME_BACKUP);
				rmSync(OUTPUT_TEMPLATE_NAME);
			}
		});

		after(() => {
			if (existsSync(OUTPUT_TEMPLATE_NAME)) {
				rmSync(OUTPUT_TEMPLATE_NAME);
			}

			copyFileSync(OUTPUT_TEMPLATE_NAME_BACKUP, OUTPUT_TEMPLATE_NAME);
			if (existsSync(OUTPUT_TEMPLATE_NAME_BACKUP)) {
				rmSync(OUTPUT_TEMPLATE_NAME_BACKUP);
			}
		});

		it('return the template if the file is not present', () => {
			expect(readOutputTemplateFile).to.throw();
		});

		it('return the actual file if present', () => {
			writeFileSync(OUTPUT_TEMPLATE_NAME, mockStringifyWithTabsAndTrailingNewLine);
			expect(readOutputTemplateFile()).to.deep.equal(mockDailyOutput);
		});

		it('throws if the file has missing fields', () => {
			writeFileSync(OUTPUT_TEMPLATE_NAME, mockMalformedStringifyWithTabsAndTrailingNewLine);
			expect(readOutputTemplateFile).to.throw();
		});

		it('throws if the file is a corrupted JSON', () => {
			writeFileSync(OUTPUT_TEMPLATE_NAME, '!{{ NOT A VALID JSON "": false');
			expect(readOutputTemplateFile).to.throw();
		});
	});

	describe('readInitialOutputFile', () => {
		before(() => {
			if (existsSync(OUTPUT_NAME)) {
				rmSync(OUTPUT_NAME);
			}
		});

		after(() => {
			if (existsSync(OUTPUT_NAME)) {
				rmSync(OUTPUT_NAME);
			}
		});

		it('return the actual file if present', () => {
			writeFileSync(OUTPUT_NAME, mockStringifyWithTabsAndTrailingNewLine);
			expect(readInitialOutputFile()).to.deep.equal(mockDailyOutput);
		});

		it('return the template file if output is not present', () => {
			const OUTPUT_TEMPLATE_NAME_BACKUP = `${OUTPUT_TEMPLATE_NAME}.bak`;

			// create template backup
			if (existsSync(OUTPUT_TEMPLATE_NAME)) {
				copyFileSync(OUTPUT_TEMPLATE_NAME, OUTPUT_TEMPLATE_NAME_BACKUP);
				rmSync(OUTPUT_TEMPLATE_NAME);
			}

			// write template mock
			writeFileSync(OUTPUT_TEMPLATE_NAME, mockStringifyWithTabsAndTrailingNewLine);

			expect(readInitialOutputFile()).to.deep.equal(mockDailyOutput);

			// restore template backup and delete backup file
			copyFileSync(OUTPUT_TEMPLATE_NAME_BACKUP, OUTPUT_TEMPLATE_NAME);
			if (existsSync(OUTPUT_TEMPLATE_NAME_BACKUP)) {
				rmSync(OUTPUT_TEMPLATE_NAME_BACKUP);
			}
		});

		it('throws if the file has missing fields', () => {
			writeFileSync(OUTPUT_NAME, mockMalformedStringifyWithTabsAndTrailingNewLine);
			expect(readInitialOutputFile).to.throw();
		});

		it('throws if the file is a corrupted JSON', () => {
			writeFileSync(OUTPUT_NAME, '!{{ NOT A VALID JSON "": false');
			expect(readInitialOutputFile).to.throw();
		});
	});
});
