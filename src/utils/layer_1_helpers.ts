import { createHash } from 'crypto';
import { APP_NAME_TAG, VALID_APP_NAMES } from '../constants';
import { GQLEdgeInterface, GQLTagInterface } from '../gql_types';

export function ardriveTxFilter(edge: GQLEdgeInterface): boolean {
	const appNameTags = edge.node.tags.filter((tag) => tag.name === APP_NAME_TAG);
	return VALID_APP_NAMES.some((validAppName) => appNameTags.find((tag) => tag.value === validAppName));
}

export function decodeTags(encodedTags: GQLTagInterface[]): GQLTagInterface[] {
	const tags = encodedTags.map((tag) => {
		try {
			return {
				name: fromB64Url(tag.name).toString(),
				value: fromB64Url(tag.value).toString()
			};
		} catch (error) {
			return { name: 'undefined', value: 'undefined' };
		}
	});
	return tags;
}

export function sha256B64Url(input: Buffer): string {
	return toB64url(createHash('sha256').update(input).digest());
}

export function toB64url(buffer: Buffer): string {
	return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export function fromB64Url(input: string): Buffer {
	const paddingLength = input.length % 4 == 0 ? 0 : 4 - (input.length % 4);

	const base64 = input.replace(/-/g, '+').replace(/_/g, '/').concat('='.repeat(paddingLength));

	return Buffer.from(base64, 'base64');
}
