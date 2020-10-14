import { Octokit } from '@octokit/core';
import { throttling } from '@octokit/plugin-throttling';

import { GitHub, getOctokitOptions } from '@actions/github/lib/utils';

const OctokitConstructor = GitHub.plugin(throttling);

const maxRetryCount = 1;

interface RequestOptions {
	method: string;
	url: string;
	request: RequestInfo;
}

interface RequestInfo {
	retryCount: number;
}

export function createOctokit(
	accessToken: string
): InstanceType<typeof GitHub> {
	const octokit = new OctokitConstructor(
		getOctokitOptions(accessToken, {
			throttle: { onRateLimit, onAbuseLimit },
		})
	);

	return octokit;
}

function onRateLimit(
	retryAfter: number,
	options: RequestOptions,
	octokit: Octokit
): boolean {
	octokit.log.warn(
		`Request quota exhausted for request ${options.method} ${options.url}`
	);
	if (options.request.retryCount < maxRetryCount) {
		octokit.log.info(`Retrying after ${retryAfter} seconds!`);
		return true;
	}

	return false;
}

function onAbuseLimit(
	_: number,
	options: RequestOptions,
	octokit: Octokit
): void {
	octokit.log.warn(
		`Abuse detected for request ${options.method} ${options.url}`
	);
}
