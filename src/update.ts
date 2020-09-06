/* eslint-disable camelcase */

import { readFile, existsSync } from 'fs';
import { promisify } from 'util';

import { getOctokit, context } from '@actions/github';

import { UpdaterOptions } from './util';

const readFileAsync = promisify(readFile);

interface RefInfo {
	treeSha: string;
	commitSha: string;
}

interface RemoteFile {
	content: string;
	sha: string;
}

interface TreeItem {
	content?: string;
	mode?: '100644' | '100755' | '040000' | '160000' | '120000';
	path?: string;
	sha?: string;
}

export class Updater {
	private octokit: ReturnType<typeof getOctokit>;
	private message: string;
	private defaultBranch: string;

	constructor(options: UpdaterOptions) {
		this.octokit = getOctokit(options.token);

		this.message = options.message;
		this.defaultBranch = options.branch || null;
	}

	async updateFiles(paths: string[]): Promise<string> {
		const branch = await this.getBranch();
		const lastRef = await this.getLastRef(branch);

		const baseTreeSha = lastRef.treeSha;
		const baseCommitSha = lastRef.commitSha;

		const newTreeSha = await this.createTree(branch, paths, baseTreeSha);
		if (newTreeSha === null) {
			return null;
		}

		const newCommitSha = await this.createCommit(newTreeSha, baseCommitSha);
		return this.updateRef(newCommitSha, branch);
	}

	private async createCommit(tree: string, parent: string): Promise<string> {
		const { message } = this;

		const { data } = await this.octokit.git.createCommit({
			...context.repo,
			message,
			tree,
			parents: [parent],
		});

		return data.sha;
	}

	private async createTree(
		branch: string,
		filePaths: string[],
		base_tree: string
	): Promise<string> {
		const promises = Promise.all(
			filePaths.map((filePath) => {
				return this.createTreeItem(filePath, branch);
			})
		);

		const tree = (await promises).filter((change) => {
			return change !== null;
		});

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
	): Promise<TreeItem> {
		const remoteFile = await this.getRemoteContents(filePath, branch);
		const localContents = await this.getLocalContents(filePath);
		const remoteContents = remoteFile.content;

		const mode = '100644';

		if (localContents !== null) {
			if (localContents !== remoteContents) {
				const content = localContents;
				return { mode, path: filePath, content };
			}
		} else if (remoteContents !== null) {
			return {
				mode,
				path: filePath,
				sha: null,
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

	private async getLocalContents(filePath: string): Promise<string> {
		if (existsSync(filePath)) {
			return (await readFileAsync(filePath)).toString();
		}

		return null;
	}

	private async getRemoteContents(
		filePath: string,
		branch: string
	): Promise<RemoteFile> {
		let content: string = null;
		let sha: string = null;

		try {
			const { data } = await this.octokit.repos.getContent({
				...context.repo,
				path: filePath,
				ref: branch,
			});

			content = Buffer.from(data['content'], 'base64').toString();
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			sha = data['sha'];
		} catch (err) {
			// Do nothing
		}

		return { content, sha };
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
