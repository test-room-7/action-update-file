/* eslint-disable camelcase */

import { readFile, existsSync } from 'fs';
import { promisify } from 'util';

import { GitHub } from '@actions/github/lib/utils';
import { context } from '@actions/github';

import { UpdaterOptions, isNotNull } from './util';
import { createOctokit } from './octokit';

const readFileAsync = promisify(readFile);

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
	private commiterName: string;
	private commiterEmail: string;

	constructor(options: UpdaterOptions) {
		this.octokit = createOctokit(options.token);

		this.message = options.message;
		this.defaultBranch = options.branch || null;
		this.commiterName = options.commiterName;
		this.commiterEmail = options.commiterEmail;
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
			message,
			tree,
			parents: [parent],
			author: {
				name: this.commiterName,
				email: this.commiterEmail,
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
			if (localContents !== remoteContents) {
				const content = localContents;

				const { data } = await this.octokit.git.createBlob({
					...context.repo,
					content,
					encoding: 'base64',
				});

				return {
					mode,
					path: filePath,
					sha: data.sha,
				};
			}
		} else if (remoteContents !== null) {
			return {
				mode,
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
