import { getInput, InputOptions } from '@actions/core';
import { isDynamicPattern, sync as globSync } from 'fast-glob';

export interface UpdaterOptions {
	branch: string;
	token: string;
	message: string;
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
	return flatten(rawPaths.split(/\r?\n/).map(expandPathPattern));
}

export function getActionOptions(): UpdaterOptions {
	const token = getInput('github-token', { required: true });
	const message = getInput('commit-msg', { required: true });
	const branch = getInput('branch');

	return { token, message, branch };
}

export function isNotNull<T>(arg: T): arg is Exclude<T, null> {
	return arg !== null;
}

function expandPathPattern(path: string): string[] {
	const pathPattern = path.trim();

	if (isDynamicPattern(pathPattern)) {
		return globSync(pathPattern);
	}

	return [pathPattern];
}

function flatten<T>(items: T[][]): T[] {
	return items.reduce((collection, item) => collection.concat(item), []);
}
