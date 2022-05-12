import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { GQLEdgeInterface } from './gql_types';

const CACHE_FOLDER = './cache';

// TODO: ensure no duplicated edges

export class GQLCache {
	constructor(private readonly minBlock: number, private readonly maxBlock: number) {}

	/**
	 * adds to the cache file the given edges
	 * @param edges - a non sorted array of edges
	 */
	public async addEdges(edges: GQLEdgeInterface[]): Promise<void> {
		const cachedEdges = await this.getEdges();
		const sortedEdges = [...cachedEdges, ...edges].sort(
			(edge_a, edge_b) => edge_a.node.block.height - edge_b.node.block.height
		);
		const stringifiedEdges = JSON.stringify(sortedEdges);
		if (!this.cacheFolderExists) {
			mkdirSync(CACHE_FOLDER);
		}
		writeFileSync(this.filePath, stringifiedEdges);
	}

	/**
	 * returns the previously sorted array of cached edges
	 */
	public async getEdges(): Promise<GQLEdgeInterface[]> {
		if (!this.exists) {
			return [];
		}
		const cacheData = readFileSync(this.filePath);
		const cachedEdges = JSON.parse(cacheData.toString());
		return cachedEdges;
	}

	public get exists(): boolean {
		return this.cacheFolderExists && this.cacheFileExists;
	}

	public get cacheFolderExists(): boolean {
		return existsSync(CACHE_FOLDER);
	}

	public get cacheFileExists(): boolean {
		return existsSync(this.filePath);
	}

	private get filePath(): string {
		return `${CACHE_FOLDER}/gql_cache_${this.minBlock}-${this.maxBlock}.json`;
	}
}
