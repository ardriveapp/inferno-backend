import { expect } from 'chai';
import { HeightRange } from './height_range';

describe('HeightRange class', () => {
	describe('constructor', () => {
		it('throws if fed with non-integers', () => {
			expect(() => new HeightRange(0.1, 0.2)).to.throw();
		});

		it('throws if fed with negative integers', () => {
			expect(() => new HeightRange(-100, -50)).to.throw();
		});

		it('throws if the minimum is greater than the maximum', () => {
			expect(() => new HeightRange(100, 10)).to.throw();
		});
	});

	describe('findHoles function', () => {
		const myRange = new HeightRange(50, 100);
		const biggerRange = new HeightRange(0, 150);
		const overlappingRanges = [new HeightRange(50, 60), new HeightRange(55, 70)];

		it('throws if fed with ranges not included in the range itself', () => {
			expect(() => myRange.findHoles([biggerRange])).to.throw();
		});

		it('throws if fed with overlapping ranges', () => {
			expect(() => myRange.findHoles(overlappingRanges)).to.throw();
		});

		it('returns one hole if fed with an empty array', () => {
			expect(myRange.findHoles([])).to.deep.equal([myRange]);
		});

		it('returns two holes if fed with one single non-contiguous range', () => {
			expect(myRange.findHoles([new HeightRange(60, 70)])).to.deep.equal([
				new HeightRange(50, 59),
				new HeightRange(71, 100)
			]);
		});

		it('returns three holes if fed with two single non-contiguous range', () => {
			expect(myRange.findHoles([new HeightRange(55, 60), new HeightRange(65, 70)])).to.deep.equal([
				new HeightRange(50, 54),
				new HeightRange(61, 64),
				new HeightRange(71, 100)
			]);
		});

		it('returns an empty array if there are no holes', () => {
			expect(myRange.findHoles([myRange])).to.deep.equal([]);
			expect(myRange.findHoles([new HeightRange(50, 70), new HeightRange(71, 100)])).to.deep.equal([]);
		});
	});
});
