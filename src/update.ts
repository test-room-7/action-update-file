import { readFile, existsSync } from 'fs';
import { promisify } from 'util';

import { GitHub } from '@actions/github';
import { UpdaterOptions } from './util';

const readFileAsync = promisify(readFile);

type RefInfo = {
    treeSha: string;
    commitSha: string;
};

type RemoteFile = {
    content: string;
    sha: string;
};

type TreeItem = {
    content?: string;
    mode?: '100644' | '100755' | '040000' | '160000' | '120000';
    path?: string;
    sha?: string;
};

export class Updater {
    octokit: GitHub;
    message: string;
    branch: string;
    owner: string;
    repo: string;

    constructor(options: UpdaterOptions) {
        const [owner, repo] = options.repository.split('/', 2);

        this.octokit = new GitHub(options.token);
        this.message = options.message;
        this.branch = options.branch;
        this.owner = owner;
        this.repo = repo;
    }

    /** Public methods. */

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

    /** Private methods. */

    async createCommit(tree: string, parent: string): Promise<string> {
        const { owner, repo, message } = this;

        const { data } = await this.octokit.git.createCommit({
            owner,
            repo,
            message,
            tree,
            parents: [parent],
        });

        return data.sha;
    }

    async createTree(paths: string[], base_tree: string): Promise<string> {
        const { owner, repo } = this;

        const promises = Promise.all(paths.map((path) => {
            return this.createTreeItem(path);
        }));

        const tree = (await promises).filter((change) => {
            return change !== null;
        });

        if (tree.length === 0) {
            return null;
        }

        const { data } = await this.octokit.git.createTree({
            owner, repo, tree, base_tree,
        });

        return data.sha;
    }

    async createTreeItem(path: string): Promise<TreeItem> {
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
                mode, path, sha: null,
            };
        }

        return null;
    }

    async getLastRef(): Promise<RefInfo> {
        const { owner, repo } = this;

        const { data } = await this.octokit.repos.listCommits({
            owner, repo, per_page: 1, sha: this.branch
        });

        const commitSha = data[0].sha;
        const treeSha = data[0].commit.tree.sha;

        return { treeSha, commitSha };
    }

    async getLocalContents(filePath: string): Promise<string> {
        if (existsSync(filePath)) {
            return (await readFileAsync(filePath)).toString();
        }

        return null;
    }

    async getRemoteContents(filePath: string): Promise<RemoteFile> {
        let content: string = null;
        let sha: string = null;

        try {
            const { data } = await this.octokit.repos.getContents({
                owner: this.owner,
                repo: this.repo,
                path: filePath,
                ref: this.branch,
            });

            content = Buffer.from(data['content'], 'base64').toString();
            sha = data['sha'];
        } catch (err) {
            // Do nothing
        }

        return { content, sha };
    }

    async updateRef(sha: string): Promise<string> {
        const { owner, repo } = this;
        const ref = `heads/${this.branch}`;

        const { data } = await this.octokit.git.updateRef({
            owner, repo, ref, sha
        });

        return data.object.sha;
    }
}
