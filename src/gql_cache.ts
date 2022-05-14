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
const FILENAME_REGEXP = /gql_cache_(\d+).json/;

function filenameToHeight(fileName: string): number {
	const nameMatch = fileName.match(FILENAME_REGEXP);
	if (!nameMatch) {
		throw new Error(`Wrong file name: ${fileName}`);
	}
	const min = +nameMatch[1];
	return min;
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
		// const allEdges = await this.getAllEdgesWithinRange();
		const newTxIDs = edges.map((edge) => edge.node.id);
		const duplicated = this.edgesOfHeight.filter((edge) => newTxIDs.includes(edge.node.id));
		if (duplicated.length) {
			const height = duplicated[0].node.block.height;
			const duplicatedTxIDs = duplicated.map((edge) => edge.node.id);
			throw new Error(`!!!!!!! Duplicated IDs (${height}): ${duplicatedTxIDs}`);
		}
		edges.forEach(this.addSingleEdge);
	}

	private addSingleEdge = (edge: GQLEdgeInterface): void => {
		if (!this.cacheFolderExists) {
			mkdirSync(CACHE_FOLDER);
		}
		const height = edge.node.block.height;
		if (existsSync(joinPath(CACHE_FOLDER, this.getFilePath(height)))) {
			throw new Error('This block was already cached');
		}
		if (!this.currentHeight) {
			this.currentHeight = height;
		}
		if (this.currentHeight === height) {
			this.edgesOfHeight.push(edge);
		} else {
			console.log(` # Finished caching block ${height}`);
			this.persistCache();
			this.currentHeight = height;
			this.edgesOfHeight = [];
			// Run again with the new given height
			this.addSingleEdge(edge);
		}
	};

	private persistCache(): void {
		const filePath = this.getFilePath(this.currentHeight);
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

	private getFilePath(height: number): string {
		return `${CACHE_FOLDER}/gql_cache_${height}.json`;
	}

	public getNonCachedRangesWithin(): HeightRange[] {
		const cachedRanges = this.getCachedHeightsWithin().map((height) => new HeightRange(height, height));
		const nonCachedRanges = this.range.findHoles(cachedRanges);
		return nonCachedRanges;
	}

	private getCachedHeightsWithin(): number[] {
		const allCacheFileNames = this.getAllCacheFileNames();
		const allHeights = allCacheFileNames.map(filenameToHeight);
		return allHeights.filter(this.range.isIncludedFilter.bind(this.range)).sort();
	}

	private getAllCacheFileNames(): string[] {
		if (!this.cacheFolderExists) {
			return [];
		}
		const listResult = readdirSync(CACHE_FOLDER);
		return listResult;
	}
}
