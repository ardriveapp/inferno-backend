import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { join as joinPath } from 'path';
import { GQLEdgeInterface } from './gql_types';
import { HeightRange } from './height_range';

const CACHE_FOLDER = './cache';
/**
 * capturing groups:
 * 1. minimum height
 * 2. maximum height
 */
const BLOCK_FILENAME_REGEXP = /gql_cache_block_(\d+).json/;

const EMPTIES_FILENAME_REGEXP = /gql_cache_empty_(\d+)-(\d+).json/;

function isBlockFilename(filename: string): boolean {
	return !!filename.match(BLOCK_FILENAME_REGEXP);
}

function isEmptiesFilename(filename: string): boolean {
	return !!filename.match(EMPTIES_FILENAME_REGEXP);
}

function blockFilenameToHeight(fileName: string): number {
	const nameMatch = fileName.match(BLOCK_FILENAME_REGEXP);
	if (!nameMatch) {
		throw new Error(`Wrong file name: ${fileName}`);
	}
	const min = +nameMatch[1];
	return min;
}

function emptyFilenameToRange(fileName: string): HeightRange {
	const nameMatch = fileName.match(EMPTIES_FILENAME_REGEXP);
	if (!nameMatch) {
		throw new Error(`Wrong file name: ${fileName}`);
	}
	const min = Math.min(+nameMatch[1], +nameMatch[2]);
	const max = Math.max(+nameMatch[1], +nameMatch[2]);
	return new HeightRange(min, max);
}

// TODO: ensure no duplicated edges
export class GQLCache {
	private currentHeight = 0;
	private edgesOfHeight: GQLEdgeInterface[] = [];

	constructor(private readonly range: HeightRange) {}

	/**
	 * adds to the cache file the given edges
	 * @param edges - an array of edges sorted by HEIGHT_DESC order
	 */
	public async addEdges(edges: GQLEdgeInterface[]): Promise<void> {
		edges.forEach(this.addSingleEdge);
	}

	private addSingleEdge = (edge: GQLEdgeInterface): void => {
		if (!this.cacheFolderExists) {
			mkdirSync(CACHE_FOLDER);
		}
		const height = edge.node.block.height;
		if (existsSync(joinPath(CACHE_FOLDER, this.getFilePathOfBlock(height)))) {
			throw new Error('This block was already cached');
		}
		if (!this.currentHeight) {
			this.currentHeight = height;
		}
		if (this.currentHeight === height) {
			this.edgesOfHeight.push(edge);
		} else {
			console.log(` # Finished caching block ${this.currentHeight}. Newer is ${height}`);
			this.persistCache();

			const areBlocksContiguous = Math.abs(this.currentHeight - height) === 1;
			if (!areBlocksContiguous) {
				const min = Math.min(this.currentHeight, height);
				const max = Math.max(this.currentHeight, height);
				const rangeDiff = new HeightRange(min + 1, max - 1);
				const isEmptyRange = this.getNonCachedRangesWithin().map(toString).includes(rangeDiff.toString());
				if (isEmptyRange) {
					console.log(`hole at ${rangeDiff}`);
					this.setEmptyRange(rangeDiff);
				}
			}

			this.currentHeight = height;
			this.edgesOfHeight = [];
			this.edgesOfHeight.push(edge);
		}
	};

	public setEmptyRange(range: HeightRange): void {
		const filePath = this.getFilePathOfEmptyRange(range);
		writeFileSync(filePath, '[]');
	}

	private persistCache(): void {
		const filePath = this.getFilePathOfBlock(this.currentHeight);
		const stringifiedEdges = JSON.stringify(this.edgesOfHeight);
		writeFileSync(filePath, stringifiedEdges);
	}

	/**
	 * returns the cached edges within the range specified at the constructor
	 */
	public async getAllEdgesWithinRange(): Promise<GQLEdgeInterface[]> {
		const allEdges = await this.getAllEdges();
		const edgesInRange = allEdges.filter(
			(edge) => edge.node.block.height >= this.range.min && edge.node.block.height <= this.range.max
		);
		return edgesInRange;
	}

	/**
	 * returns the previously sorted array of cached edges
	 */
	private async getAllEdges(): Promise<GQLEdgeInterface[]> {
		const cachedEdges: GQLEdgeInterface[] = [];
		const allCacheFileNames = this.getAllCacheFileNames();
		allCacheFileNames.forEach((fileName) => {
			const filePath = joinPath(CACHE_FOLDER, fileName);
			const cacheData = readFileSync(filePath);
			cachedEdges.push(...JSON.parse(cacheData.toString()));
		});
		return cachedEdges;
	}

	public get cacheFolderExists(): boolean {
		return existsSync(CACHE_FOLDER);
	}

	private getFilePathOfBlock(height: number): string {
		return `${CACHE_FOLDER}/gql_cache_block_${height}.json`;
	}

	private getFilePathOfEmptyRange(range: HeightRange): string {
		return `${CACHE_FOLDER}/gql_cache_empty_${range.min}-${range.max}.json`;
	}

	public getNonCachedRangesWithin(): HeightRange[] {
		const cachedRanges = this.getCachedHeightsWithin().map((height) => new HeightRange(height, height));
		const cachedEmptyRanges = this.getCachedEmpyRanges();
		const nonCachedRanges = this.range.findHoles([...cachedRanges, ...cachedEmptyRanges]);
		return nonCachedRanges;
	}

	private getCachedHeightsWithin(): number[] {
		const allCacheFileNamesOfBlocks = this.getAllFilenamesOfBlocks();
		const allHeights = allCacheFileNamesOfBlocks.map(blockFilenameToHeight);
		return allHeights.filter(this.range.isIncludedFilter.bind(this.range)).sort();
	}

	private getAllFilenamesOfBlocks(): string[] {
		const listResult = this.getAllCacheFileNames().filter((name) => isBlockFilename(name));
		return listResult;
	}

	private getCachedEmpyRanges(): HeightRange[] {
		const emptyRanges = this.getAllFilenamesOfEmptyRanges().map(emptyFilenameToRange);
		const rangesWithinThisRange = emptyRanges.filter(this.range.isIncludedFilter.bind(this.range));
		return rangesWithinThisRange;
	}

	private getAllFilenamesOfEmptyRanges(): string[] {
		const listResult = this.getAllCacheFileNames().filter((name) => isEmptiesFilename(name));
		return listResult;
	}

	private getAllCacheFileNames(): string[] {
		if (!this.cacheFolderExists) {
			return [];
		}
		const listResult = readdirSync(CACHE_FOLDER);
		return listResult;
	}
}
