#!/usr/bin/env python3

import codecs
import os
import sys

import github3

from github3.exceptions import NotFoundError, AuthenticationFailed

ENCODING = 'utf-8'
SHORT_SHA_LEN = 7


def get_input(key):
    input_key = f'INPUT_{key.upper()}'

    if input_key in os.environ:
        return os.environ[input_key]

    raise ValueError(f'Error: No input: {key}')


def get_boolean(key):
    val = get_input(key)
    if val == 'true':
        return True
    if val == 'false':
        return False

    raise ValueError(f'Error: Invalid input: {key}')


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
        allow_removing = get_boolean('allow-removing')

        repo = get_variable('GITHUB_REPOSITORY')
    except ValueError as err:
        print(err)
        return 1

    is_local_file_exist = os.path.exists(file_path)
    if not allow_removing and not is_local_file_exist:
        print(f'Error: Removing {file_path} is not allowed')
        return 2

    try:
        github = github3.login(token=token)
        repository = github.repository(*repo.split('/'))
    except AuthenticationFailed:
        print('Error: Unable to authenticate')
        return 3

    try:
        remote_file = repository.file_contents(file_path, ref=branch)
        is_remote_file_exist = True
    except NotFoundError:
        is_remote_file_exist = False

    pushed_change = None

    if is_local_file_exist:
        with codecs.open(file_path, mode='rb') as fp:
            local_contents = fp.read()

        if is_remote_file_exist:
            remote_contents = remote_file.decoded

            if local_contents != remote_contents:
                pushed_change = remote_file.update(
                    commit_msg, local_contents, branch
                )
                print(f'Updated {file_path}')
        else:
            pushed_change = repository.create_file(
                file_path, commit_msg, local_contents
            )
            print(f'Created {file_path}')
    else:
        if is_remote_file_exist:
            pushed_change = remote_file.delete(commit_msg, branch)
            print(f'Removed {file_path}')

    if pushed_change:
        commit_sha = pushed_change['commit'].sha[:SHORT_SHA_LEN]
        print(f'Pushed {commit_sha} to {branch}')
    else:
        print('No changes to push')

    return 0


if __name__ == '__main__':
    sys.exit(main())
