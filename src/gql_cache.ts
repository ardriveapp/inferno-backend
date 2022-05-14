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
const FILENAME_REGEXP = /gql_cache_(\d+)-(\d+).json/;

function filenameToRange(fileName: string): HeightRange {
	const nameMatch = fileName.match(FILENAME_REGEXP);
	if (!nameMatch) {
		throw new Error(`Wrong file name: ${fileName}`);
	}
	console.log('Ranges from filename: ', nameMatch[1], nameMatch[2]);
	const min = +nameMatch[1];
	const max = +nameMatch[2];
	return new HeightRange(min, max);
}

// TODO: ensure no duplicated edges
export class GQLCache {
	constructor(private readonly range: HeightRange) {}

	/**
	 * adds to the cache file the given edges
	 * @param edges - an array of edges sorted by HEIGHT_DESC order
	 */
	public async addEdges(edges: GQLEdgeInterface[], range: HeightRange): Promise<void> {
		const allEdges = await this.getAllEdgesWithinRange();
		const newTxIDs = edges.map((edge) => edge.node.id);
		const duplicated = allEdges.filter((edge) => newTxIDs.includes(edge.node.id));
		if (duplicated.length) {
			const duplicatedTxIDs = duplicated.map((edge) => edge.node.id);
			throw new Error(`Duplicated IDs: ${duplicatedTxIDs}`);
		}
		const sortedEdges = edges.reverse();
		const filePath = this.getFilePath(range);
		if (existsSync(filePath)) {
			// merge the edges
			const existingEdges = JSON.parse(readFileSync(filePath).toString());
			sortedEdges.push(...existingEdges);
		}
		const stringifiedEdges = JSON.stringify(sortedEdges);
		if (!this.cacheFolderExists) {
			mkdirSync(CACHE_FOLDER);
		}
		// TODO: maybe create one file per height
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

	// private getCacheFileExists(range: HeightRange): boolean {
	// 	const filePath = this.getFilePath(range);
	// 	return existsSync(filePath);
	// }

	private getFilePath(range: HeightRange): string {
		return `${CACHE_FOLDER}/gql_cache_${range.min}-${range.max}.json`;
	}

	public getNonCachedRangesWithin(): HeightRange[] {
		const cachedRanges = this.getCacheRangesWithin();
		const nonCachedRanges = this.range.findHoles(cachedRanges);
		return nonCachedRanges;
	}

	private getCacheRangesWithin(): HeightRange[] {
		const allCacheFileNames = this.getAllCacheFileNames();
		const allRanges = allCacheFileNames.map(filenameToRange);
		return allRanges.filter(this.range.isIncludedFilter.bind(this));
	}

	private getAllCacheFileNames(): string[] {
		if (!this.cacheFolderExists) {
			return [];
		}
		const listResult = readdirSync(CACHE_FOLDER);
		return listResult.sort();
	}
}
