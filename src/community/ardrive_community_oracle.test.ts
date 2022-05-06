import { expect } from 'chai';
import { stubArweaveAddress, stubCommunityContract } from '../../tests/stubs';
import { ArDriveCommunityOracle } from './ardrive_community_oracle';
import { ArDriveContractOracle } from './ardrive_contract_oracle';

describe('The ArDriveCommunityOracle', () => {
	const stubContractReader: ArDriveContractOracle = {
		async readContract() {
			return stubCommunityContract;
		}
	} as unknown as ArDriveContractOracle;

	describe('getArdriveVaults method', () => {
		it('returns the expected vault value', async () => {
			const communityOracle = new ArDriveCommunityOracle(stubContractReader);

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
