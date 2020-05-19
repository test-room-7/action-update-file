import { getInput, InputOptions } from '@actions/core';

export type UpdaterOptions = {
    branch: string;
    repository: string;
    token: string;
    message: string;
};

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
    return rawPaths.split(/\r?\n/).map((path) => path.trim());
}

export function getActionOptions(): UpdaterOptions {
    const token = getInput('github-token', { required: true });
    const message = getInput('commit-msg', { required: true });
    const branch = getInput('branch');
    const repository = process.env.GITHUB_REPOSITORY;

    return { token, repository, message, branch };
}
