import { expect } from 'chai';
import { rmSync, writeFileSync } from 'fs';
import { OUTPUT_NAME } from './constants';
import { DailyOutput } from './daily_output';

// this JSON is different than the base template
const mockDailyOutput = {
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

// The avobe JSON stringified with tabs and a trailing new line
const mockDailyOutputStringified = `${JSON.stringify(mockDailyOutput, null, '\t')}\n`;

// a valid JSON with missing mandatory fields
const mockMalformedDailyOutput = {
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

// The avobe JSON stringified with tabs and a trailing new line
const mockMalformedDailyOutputStringified = `${JSON.stringify(mockMalformedDailyOutput, null, '\t')}\n`;

describe('DailyOutput class', () => {
	describe('read method', () => {
		before(() => {
			rmSync(OUTPUT_NAME);
		});

		it('return the template if the file is not present', () => {
			const output = new DailyOutput();
			expect(output.readOutputFile).to.throw();
			expect(output.read()).to.deep.equal({
				blockHeight: 914117,
				timestamp: 1650043442070,
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
			});
		});

		it('return the actual file if present', () => {
			writeFileSync(OUTPUT_NAME, mockDailyOutputStringified);

			const output = new DailyOutput();
			expect(output.read()).to.deep.equal(mockDailyOutput);
		});

		it('throws if the file is malformed', () => {
			const output = new DailyOutput();

			// either by missing fields ...
			writeFileSync(OUTPUT_NAME, mockMalformedDailyOutputStringified);
			expect(output.read).to.throw();

			// or by a corrupted JSON
			writeFileSync(OUTPUT_NAME, '!{{ NOT A VALID JSON "": false');
			expect(output.read).to.throw();
		});
	});
});
