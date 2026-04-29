const assert = require('assert/strict');
const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = require('fs');
const { tmpdir } = require('os');
const { join } = require('path');
const test = require('node:test');

const { GitignoreMatcher, Updater } = require('../build/update');

function createTempDir() {
	return mkdtempSync(join(tmpdir(), 'action-update-file-'));
}

function createUpdater({ respectGitignore = true } = {}) {
	process.env.GITHUB_REPOSITORY = 'test-room-7/action-update-file';

	return new Updater({
		token: 'test-token',
		message: 'Test commit',
		branch: 'main',
		committerName: 'Test Bot',
		committerEmail: 'test@example.com',
		respectGitignore,
	});
}

test('GitignoreMatcher respects root and nested .gitignore files', async () => {
	const rootDir = createTempDir();

	try {
		writeFileSync(
			join(rootDir, '.gitignore'),
			['dist/', '*.log', '!important.log'].join('\n')
		);
		mkdirSync(join(rootDir, 'nested'), { recursive: true });
		writeFileSync(
			join(rootDir, 'nested', '.gitignore'),
			['*.tmp', '!keep.tmp'].join('\n')
		);

		const matcher = new GitignoreMatcher(rootDir);

		assert.equal(await matcher.ignores(join(rootDir, 'dist', 'app.js')), true);
		assert.equal(await matcher.ignores(join(rootDir, 'debug.log')), true);
		assert.equal(await matcher.ignores(join(rootDir, 'important.log')), false);
		assert.equal(await matcher.ignores(join(rootDir, 'nested', 'cache.tmp')), true);
		assert.equal(await matcher.ignores(join(rootDir, 'nested', 'keep.tmp')), false);
		assert.equal(await matcher.ignores(join(tmpdir(), 'outside.txt')), false);
	} finally {
		rmSync(rootDir, { recursive: true, force: true });
	}
});

test('Updater skips ignored new files when respect-gitignore is enabled', async () => {
	const updater = createUpdater();
	let createBlobCalls = 0;

	updater.getRemoteContents = async () => null;
	updater.getLocalContents = async () => Buffer.from('new file').toString('base64');
	updater.gitignoreMatcher = {
		ignores: async () => true,
	};
	updater.octokit = {
		git: {
			createBlob: async () => {
				createBlobCalls += 1;
				return { data: { sha: 'blob-sha' } };
			},
		},
	};

	const result = await updater.createTreeItem('dist/generated.js', 'main');

	assert.equal(result, null);
	assert.equal(createBlobCalls, 0);
});

test('Updater still updates tracked files even if they match ignore rules', async () => {
	const updater = createUpdater();
	let createBlobCalls = 0;
	let ignoreChecks = 0;

	updater.getRemoteContents = async () => Buffer.from('old file').toString('base64');
	updater.getLocalContents = async () => Buffer.from('new file').toString('base64');
	updater.gitignoreMatcher = {
		ignores: async () => {
			ignoreChecks += 1;
			return true;
		},
	};
	updater.octokit = {
		git: {
			createBlob: async ({ content }) => {
				createBlobCalls += 1;
				assert.equal(content, Buffer.from('new file').toString('base64'));
				return { data: { sha: 'blob-sha' } };
			},
		},
	};

	const result = await updater.createTreeItem('dist/generated.js', 'main');

	assert.deepEqual(result, {
		mode: '100644',
		path: 'dist/generated.js',
		sha: 'blob-sha',
	});
	assert.equal(createBlobCalls, 1);
	assert.equal(ignoreChecks, 0);
});
