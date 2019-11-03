#!/usr/bin/env python3

import codecs
import os
import sys

import github3

ENCODING = 'utf-8'


def get_input(key):
    input_key = f'INPUT_{key.upper()}'

    if input_key in os.environ:
        return os.environ[input_key]

    raise ValueError(f'Error: No input: {key}')


def get_variable(var):
    if var in os.environ:
        return os.environ[var]

    raise ValueError(f'Error: No variable: {var}')


def main():
    try:
        token = get_input('github-token')
        branch = get_input('branch')
        file_path = get_input('file-path')
        commit_msg = get_input('commit-msg')

        repo = get_variable('GITHUB_REPOSITORY')
    except ValueError as err:
        print(err)
        return 1

    try:
        github = github3.login(token=token)
        repository = github.repository(*repo.split('/'))
    except github3.exceptions.AuthenticationFailed:
        print("Error: Unable to authenticate")
        return 1

    with codecs.open(file_path, mode='r', encoding=ENCODING) as fp:
        local_contents = fp.read()

    remote_file = repository.file_contents(file_path, ref=branch)
    remote_contents = remote_file.decoded.decode(ENCODING)

    if local_contents != remote_contents:
        pushed_change = remote_file.update(
            commit_msg, local_contents.encode(ENCODING), branch=branch)

        commit_sha = pushed_change['commit'].sha
        print("Pushed {0} to {1}".format(commit_sha, branch))
    else:
        print("No changes to push")

    return 0


if __name__ == '__main__':
    sys.exit(main())
