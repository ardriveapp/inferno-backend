export class HeightRange {
	constructor(readonly min: number, readonly max: number) {
		if (!(Number.isInteger(min) && Number.isInteger(min))) {
			throw new Error(`The heigth must be an integer value. ${min}-${max}`);
		}
		if (!(min >= 0 && max >= 0)) {
			throw new Error(`The height must be a positive value. ${min}-${max}`);
		}
		if (min > max) {
			throw new Error(`The min must be less or equal than the max. ${min}-${max}`);
		}
	}

	public findHoles(ranges: HeightRange[]): HeightRange[] {
		const sortedRanges = ranges.sort((range_a, range_b) => range_a.min - range_b.min);
		const firstRange = sortedRanges[0];
		const lastRange = sortedRanges[sortedRanges.length - 1];
		if (firstRange && lastRange && (firstRange.min < this.min || lastRange.max > this.max)) {
			throw new Error(`The provided ranges are not included in this range`);
		}
		let cursor = this.min;
		const holes: HeightRange[] = [];
		try {
			ranges.forEach((range) => {
				if (range.min !== cursor) {
					holes.push(new HeightRange(cursor, range.min - 1));
				}
				cursor = Math.min(range.max + 1, this.max);
			});
			if (this.max !== cursor) {
				holes.push(new HeightRange(cursor, this.max));
			}
		} catch (e) {
			const message = e instanceof Error ? e.message : JSON.stringify(e);
			throw new Error(`Ranges are overlapping. ${message}`);
		}
		return holes;
	}

	public isIncludedFilter(range: number | HeightRange): boolean {
		if (typeof range === 'number') {
			return range >= this.min && range <= this.max;
		}
		return range.min >= this.min && range.max <= this.max;
	}

	public toString(): string {
		return `HeightRange<${this.min}-${this.max}>`;
	}

	// public toArrayOfHeights(): number[] {
	// 	const heights: number[] = [];
	// 	for (let cursor = this.min; cursor <= this.max; cursor++) {
	// 		heights.push(cursor);
	// 	}
	// 	return heights;
	// }
}
