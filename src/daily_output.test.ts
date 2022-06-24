import Sinon from 'sinon';
import { expectAsyncErrorThrow } from '../tests/test_helpers';
import { DailyOutput } from './daily_output';
import { OutputData } from './inferno_types';
import * as common from './common';

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

describe('DailyOutput class', () => {
	const output = new DailyOutput([50, 100]);

	describe('feedGQLData method', () => {
		before(() => {
			Sinon.stub(common, 'readInitialOutputFile').returns(mockDailyOutput);
		});

		it('Throws if the previous block height is ahead of some query result', () => {
			return expectAsyncErrorThrow({
				promiseToError: output.feedGQLData([
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
				]),
				errorMessage: 'That block was already processed!'
			});
		});
	});
});
