import fetch, { RequestInit, Response } from 'node-fetch';

export default function (url: string, options: RequestInit = {}, timeout = 7000): Promise<Response> {
	return Promise.race([
		fetch(url, options),
		new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeout)) as Promise<Response>
	]);
}
