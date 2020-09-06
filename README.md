# action-update-file [![Version][version-badge]][version-url] [![Lint status][workflow-badge]][workflow-url]

Update (i.e. commit and push) files on GitHub.

## Usage

The action requires GitHub token for authentication; no username or e-mail are required.

Here is an example of a workflow using `action-update-file`:

```yml
name: Resources
on: repository_dispatch
jobs:
    resources:
        name: Update resources
        runs-on: ubuntu-latest
        steps:
            - uses: actions/checkout@v1
            - uses: actions/setup-node@v1
            - name: Fetch resources
              run: ./scripts/fetch-resources.sh
            - name: Update resources
              uses: test-room-7/action-update-file@v1
              with:
                  file-path: path/to/file
                  commit-msg: Update resources
                  github-token: ${{ secrets.GITHUB_TOKEN }}
```

Note that this action does not change files. They should be changed with scripts and/or other actions.

You can also update multiple files:

```yml
name: Resources
on: repository_dispatch
jobs:
    resources:
        name: Update resources
        runs-on: ubuntu-latest
        steps:
            - uses: actions/checkout@v1
            - uses: actions/setup-node@v1
            - name: Fetch resources
              run: ./scripts/fetch-resources.sh
            - name: Update resources
              uses: test-room-7/action-update-file@v1
              with:
                  file-path: |
                      path/to/file1
                      path/to/file2
                      path/to/file3
                  commit-msg: Update resources
                  github-token: ${{ secrets.GITHUB_TOKEN }}
```

## Inputs

### Required inputs

-   `commit-msg`: a text used as a commit message
-   `file-path`: a path to file to be updated
-   `github-token`: GitHub token

### Optional inputs

-   `branch`: branch to push changes (`master` by default)
-   `allow-removing`: allow to remove file if local copy is missing
    (`false` by default)

Note that the action will produce an error if a local copy of a given file is missing, and the `allow-removing` flag is `false`.

## Outputs

-   `commit-sha`: the hash of the commit created by this action

## License

See the [license file][license].

[license]: https://github.com/test-room-7/action-update-file/blob/master/LICENSE.md
[version-badge]: https://img.shields.io/github/v/release/test-room-7/action-update-file
[version-url]: https://github.com/marketplace/actions/update-file-on-github
[workflow-badge]: https://img.shields.io/github/workflow/status/test-room-7/action-update-file/Lint?label=lint
[workflow-url]: https://github.com/test-room-7/action-update-file/actions
