/* eslint-disable camelcase */

import { readFile, existsSync } from 'fs';
import { promisify } from 'util';

import { getOctokit, context } from '@actions/github';
import { GitHub } from '@actions/github/lib/utils';

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
	private branch: string;

	constructor(options: UpdaterOptions) {
		this.octokit = getOctokit(options.token);
		this.message = options.message;
		this.branch = options.branch;
	}

	async updateFiles(paths: string[]): Promise<string> {
		const lastRef = await this.getLastRef();

		const baseTreeSha = lastRef.treeSha;
		const baseCommitSha = lastRef.commitSha;

		const newTreeSha = await this.createTree(paths, baseTreeSha);
		if (newTreeSha === null) {
			return null;
		}

		const newCommitSha = await this.createCommit(newTreeSha, baseCommitSha);
		return this.updateRef(newCommitSha);
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
		paths: string[],
		base_tree: string
	): Promise<string> {
		const promises = Promise.all(
			paths.map((path) => {
				return this.createTreeItem(path);
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

	private async createTreeItem(path: string): Promise<TreeItem> {
		const remoteFile = await this.getRemoteContents(path);
		const remoteContents = remoteFile.content;
		const localContents = await this.getLocalContents(path);

		const mode = '100644';

		if (localContents !== null) {
			if (localContents !== remoteContents) {
				const content = localContents;
				return { mode, path, content };
			}
		} else if (remoteContents !== null) {
			return {
				mode,
				path,
				sha: null,
			};
		}

		return null;
	}

	private async getLastRef(): Promise<RefInfo> {
		const { data } = await this.octokit.repos.listCommits({
			...context.repo,
			per_page: 1,
			sha: this.branch,
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

	private async getRemoteContents(filePath: string): Promise<RemoteFile> {
		let content: string = null;
		let sha: string = null;

		try {
			const { data } = await this.octokit.repos.getContent({
				...context.repo,
				path: filePath,
				ref: this.branch,
			});

			content = Buffer.from(data['content'], 'base64').toString();
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			sha = data['sha'];
		} catch (err) {
			// Do nothing
		}

		return { content, sha };
	}

	private async updateRef(sha: string): Promise<string> {
		const ref = `heads/${this.branch}`;

		const { data } = await this.octokit.git.updateRef({
			...context.repo,
			ref,
			sha,
		});

		return data.object.sha;
	}
}
