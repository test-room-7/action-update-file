# action-update-file ![Version][VersionBadge] ![Lint status][WorkflowBadge]

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
      uses: alexesprit/action-update-file@master
      with:
        file-path: path/to/file
        commit-msg: Update resources
        github-token: ${{ secrets.GITHUB_TOKEN }}
```

Note that this action does not change files. They should be changed with scripts and/or other actions.

## Inputs

### Required inputs

- `commit-msg`: a text used as a commit message
- `file-path`: a path to file to be updated
- `github-token`: GitHub token

### Optional inputs

- `branch`: branch to push changes (`master` by default)
- `allow-removing`: allow to remove file if local copy is missing
  (`false` by default)

Note that the action will produce an error if a local copy of a given file is missing, and the `allow-removing` flag is `false`.

## License

See the [license file][License].

[License]: https://github.com/alexesprit/action-update-file/blob/master/LICENSE.md
[VersionBadge]: https://img.shields.io/github/v/release/alexesprit/action-update-file
[WorkflowBadge]: https://img.shields.io/github/workflow/status/alexesprit/action-update-file/Lint?label=lint
