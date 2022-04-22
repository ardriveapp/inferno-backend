import { expect } from 'chai';
import { fakeArweave, stubArweaveAddress, stubCommunityContract } from '../../tests/stubs';
import { ArDriveCommunityOracle } from './ardrive_community_oracle';

describe('The ArDriveCommunityOracle', () => {
	const stubContractReader = {
		async readContract() {
			return stubCommunityContract;
		}
	};

	describe('getArdriveVaults method', () => {
		it('returns the expected arweave address', async () => {
			const communityOracle = new ArDriveCommunityOracle(fakeArweave, [stubContractReader]);

			expect(await communityOracle.getArdriveVaults()).to.deep.equal({
				[stubArweaveAddress().toString()]: [
					{
						start: 1,
						end: 2,
						balance: 500
					}
				]
			});
		});
	});
});
