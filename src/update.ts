/* eslint-disable camelcase */

import { readFile, existsSync } from 'fs';
import { dirname, relative, resolve, sep } from 'path';
import { promisify } from 'util';

import { info } from '@actions/core';
import { GitHub } from '@actions/github/lib/utils';
import { context } from '@actions/github';
import * as nodeIgnore from 'ignore';
type Ignore = nodeIgnore.Ignore;

import { UpdaterOptions, isNotNull } from './util';
import { createOctokit } from './octokit';

const readFileAsync = promisify(readFile);

export class GitignoreMatcher {
	private rootDir: string;
	private matchers = new Map<string, Promise<Ignore | null>>();

	constructor(rootDir: string) {
		this.rootDir = resolve(rootDir);
	}

	async ignores(filePath: string): Promise<boolean> {
		const absoluteFilePath = resolve(filePath);
		const relativeFilePath = normalizePath(
			relative(this.rootDir, absoluteFilePath)
		);

		if (
			relativeFilePath === '' ||
			relativeFilePath === '.' ||
			relativeFilePath.startsWith('../')
		) {
			return false;
		}

		let ignored = false;

		for (const relativeDirPath of getRelativeDirPaths(relativeFilePath)) {
			const matcher = await this.getMatcher(relativeDirPath);
			if (matcher === null) {
				continue;
			}

			const absoluteDirPath = resolve(this.rootDir, relativeDirPath);
			const pathFromDir = normalizePath(
				relative(absoluteDirPath, absoluteFilePath)
			);
			const result = matcher.test(pathFromDir);

			if (result.ignored || result.unignored) {
				ignored = result.ignored;
			}
		}

		return ignored;
	}

	private async getMatcher(relativeDirPath: string): Promise<Ignore | null> {
		let matcherPromise = this.matchers.get(relativeDirPath);

		if (matcherPromise === undefined) {
			matcherPromise = this.loadMatcher(relativeDirPath);
			this.matchers.set(relativeDirPath, matcherPromise);
		}

		return matcherPromise;
	}

	private async loadMatcher(relativeDirPath: string): Promise<Ignore | null> {
		const gitignorePath = resolve(this.rootDir, relativeDirPath, '.gitignore');

		if (!existsSync(gitignorePath)) {
			return null;
		}

		const patterns = (await readFileAsync(gitignorePath)).toString();
		return nodeIgnore.default().add(patterns);
	}
}

function normalizePath(filePath: string): string {
	return filePath.split(sep).join('/');
}

function getRelativeDirPaths(filePath: string): string[] {
	const parentDir = dirname(filePath);

	if (parentDir === '.') {
		return ['.'];
	}

	const directories = ['.'];
	let currentPath = '';

	for (const segment of parentDir.split('/')) {
		currentPath = currentPath ? `${currentPath}/${segment}` : segment;
		directories.push(currentPath);
	}

	return directories;
}

interface RefInfo {
	treeSha: string;
	commitSha: string;
}

interface TreeItem {
	content?: string;
	mode?: '100644' | '100755' | '040000' | '160000' | '120000';
	path?: string;
	sha?: string;
}

interface UpdateResult {
	commitSha: string;
	branch: string;
}

export class Updater {
	private octokit: InstanceType<typeof GitHub>;
	private message: string;
	private defaultBranch: string | null;
	private committerName: string;
	private committerEmail: string;
	private respectGitignore: boolean;
	private gitignoreMatcher: GitignoreMatcher;

	constructor(options: UpdaterOptions) {
		this.octokit = createOctokit(options.token);

		this.message = options.message;
		this.defaultBranch = options.branch || null;
		this.committerName = options.committerName;
		this.committerEmail = options.committerEmail;
		this.respectGitignore = options.respectGitignore;
		this.gitignoreMatcher = new GitignoreMatcher(process.cwd());
	}

	async updateFiles(paths: string[]): Promise<UpdateResult | null> {
		const branch = await this.getBranch();
		const lastRef = await this.getLastRef(branch);

		const baseTreeSha = lastRef.treeSha;
		const baseCommitSha = lastRef.commitSha;

		const newTreeSha = await this.createTree(branch, paths, baseTreeSha);
		if (newTreeSha === null) {
			return null;
		}

		const newCommitSha = await this.createCommit(newTreeSha, baseCommitSha);
		const commitSha = await this.updateRef(newCommitSha, branch);

		return { commitSha, branch };
	}

	private async createCommit(tree: string, parent: string): Promise<string> {
		const { message } = this;

		const { data } = await this.octokit.git.createCommit({
			...context.repo,
			message: message,
			tree: tree,
			parents: [parent],
			author: {
				name: this.committerName,
				email: this.committerEmail,
			},
		});

		return data.sha;
	}

	private async createTree(
		branch: string,
		filePaths: string[],
		base_tree: string
	): Promise<string | null> {
		const tree = (
			await Promise.all(
				filePaths.map((filePath) => {
					return this.createTreeItem(filePath, branch);
				})
			)
		).filter(isNotNull);

		if (tree.length === 0) {
			return null;
		}

		const { data } = await this.octokit.git.createTree({
			...context.repo,
			tree,
			base_tree,
		});

		return data.sha;
	}

	private async createTreeItem(
		filePath: string,
		branch: string
	): Promise<TreeItem | null> {
		const remoteContents = await this.getRemoteContents(filePath, branch);
		const localContents = await this.getLocalContents(filePath);
		const mode = '100644';

		if (localContents !== null) {
			if (
				remoteContents === null &&
				this.respectGitignore &&
				(await this.gitignoreMatcher.ignores(filePath))
			) {
				info(`Skipping ignored file: ${filePath}`);
				return null;
			}

			if (localContents !== remoteContents) {
				const content = localContents;

				const { data } = await this.octokit.git.createBlob({
					...context.repo,
					content: content,
					encoding: 'base64',
				});

				return {
					mode: mode,
					path: filePath,
					sha: data.sha,
				};
			}
		} else if (remoteContents !== null) {
			return {
				mode: mode,
				path: filePath,
			};
		}

		return null;
	}

	private async getBranch(): Promise<string> {
		if (this.defaultBranch !== null) {
			return Promise.resolve(this.defaultBranch);
		}

		const { data } = await this.octokit.repos.get(context.repo);
		return data.default_branch;
	}

	private async getLastRef(branch: string): Promise<RefInfo> {
		const { data } = await this.octokit.repos.listCommits({
			...context.repo,
			per_page: 1,
			sha: branch,
		});

		const commitSha = data[0].sha;
		const treeSha = data[0].commit.tree.sha;

		return { treeSha, commitSha };
	}

	private async getLocalContents(filePath: string): Promise<string | null> {
		if (existsSync(filePath)) {
			return (await readFileAsync(filePath)).toString('base64');
		}

		return null;
	}

	private async getRemoteContents(
		filePath: string,
		branch: string
	): Promise<string | null> {
		try {
			const { data } = await this.octokit.repos.getContent({
				...context.repo,
				path: filePath,
				ref: branch,
			});

			return data.content.replace(/\n/gi, '');
		} catch (err) {
			// Do nothing
		}

		return null;
	}

	private async updateRef(sha: string, branch: string): Promise<string> {
		const ref = `heads/${branch}`;

		const { data } = await this.octokit.git.updateRef({
			...context.repo,
			ref,
			sha,
		});

		return data.object.sha;
	}
}
