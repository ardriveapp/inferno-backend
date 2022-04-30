import { expect } from 'chai';
import { existsSync, rmSync, writeFileSync } from 'fs';
import Sinon from 'sinon';
import { OUTPUT_NAME } from './constants';
import { DailyOutput } from './daily_output';
import { OutputData } from './inferno_types';

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
const mockStringifyWithTabsAndTrailingNewLine = `${JSON.stringify(mockDailyOutput, null, '\t')}\n`;

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
const mockMalformedStringifyWithTabsAndTrailingNewLine = `${JSON.stringify(mockMalformedDailyOutput, null, '\t')}\n`;

describe('DailyOutput class', () => {
	const output = new DailyOutput([50, 100]);

	describe('read method', () => {
		before(() => {
			if (existsSync(OUTPUT_NAME)) {
				rmSync(OUTPUT_NAME);
			}
		});

		it('return the template if the file is not present', () => {
			expect(output.readOutputFile).to.throw();
			expect(output.read()).to.deep.equal({
				blockHeight: 914117,
				lastUpdated: 1650043442070,
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
			writeFileSync(OUTPUT_NAME, mockStringifyWithTabsAndTrailingNewLine);
			expect(output.read()).to.deep.equal(mockDailyOutput);
		});

		it('throws if the file has missing fields', () => {
			writeFileSync(OUTPUT_NAME, mockMalformedStringifyWithTabsAndTrailingNewLine);
			expect(output.readOutputFile).not.to.throw();
			expect(output.read).to.throw();
		});

		it('throws if the file is a corrupted JSON', () => {
			writeFileSync(OUTPUT_NAME, '!{{ NOT A VALID JSON "": false');
			expect(output.readOutputFile).to.throw();
			expect(output.read).to.throw();
		});
	});

	describe('feedGQLData method', () => {
		before(() => {
			Sinon.stub(output, 'read').returns(mockDailyOutput);
		});

		it('Throws if the previous block height is ahead of some query result', () => {
			expect(() =>
				output.feedGQLData([
					{
						cursor: '914100',
						node: {
							block: { height: 914100, id: '', timestamp: 0, previous: '' },
							id: '',
							anchor: '',
							signature: '',
							recipient: '',
							data: {
								size: 0,
								type: ''
							},
							tags: [],
							parent: {
								id: ''
							},
							fee: {
								ar: '0',
								winston: '0'
							},
							quantity: {
								ar: '0',
								winston: '0'
							},
							owner: {
								address: '',
								key: ''
							}
						}
					}
				])
			).to.throw(undefined, 'That block was already processed!');
		});
	});
});
