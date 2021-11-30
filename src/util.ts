import { getInput, InputOptions } from '@actions/core';
import { isDynamicPattern, sync as globSync } from 'fast-glob';

export interface UpdaterOptions {
	branch: string;
	token: string;
	message: string;
	commiterName: string;
	commiterEmail: string;
}

export function getBooleanInput(name: string, options?: InputOptions): boolean {
	const value = getInput(name, options).toLowerCase();

	if (value === 'true') {
		return true;
	}
	if (value === 'false') {
		return false;
	}

	throw new Error(`Invalid input: ${value}`);
}

export function getPathsToUpdate(): string[] {
	const rawPaths = getInput('file-path');
	const allowDot = getBooleanInput('allow-dot');

	return flatten(
		rawPaths.split(/\r?\n/).map((path) => {
			return expandPathPattern(path, { dot: allowDot });
		})
	);
}

export function getActionOptions(): UpdaterOptions {
	const token = getInput('github-token', { required: true });
	const message = getInput('commit-msg', { required: true });
	const branch = getInput('branch');
	const commiterName = getInput('commiter-name');
	const commiterEmail = getInput('commiter-email');

	return { token, message, branch, commiterName, commiterEmail };
}

export function isNotNull<T>(arg: T): arg is Exclude<T, null> {
	return arg !== null;
}

function expandPathPattern(path: string, { dot = false }): string[] {
	const pathPattern = path.trim();

	if (isDynamicPattern(pathPattern)) {
		return globSync(pathPattern, { dot });
	}

	return [pathPattern];
}

function flatten<T>(items: T[][]): T[] {
	return items.reduce((collection, item) => collection.concat(item), []);
}
