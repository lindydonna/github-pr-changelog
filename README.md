# github-pr-changelog
Generate a changelog based on `git log` and GitHub pull requests. It queries GitHub for all pull requests, then uses the `git rev-list` command to find the hashes for the supplied tag range (with the `--from` and `--to` command-line arguments). 

Output is either markdown (default), or tab separated values if the flag `--tab-output` is supplied.

```
Usage: gh-changelog [options]

GitHub pull request changelog generator

Options:

  -v, --version                    output the version number
  -f, --from <tag>                 start of changelog range, as a git tag or revision
  -t, --to <tag>                   end of changelog range, as a git tag or revision
  -o, --owner <owner>              GitHub owner or organization
  -r, --repo <repo>                GitHub repo
  -d, --git-directory [directory]  directory to a git working tree, or current directory if not specified
  --token [token]                  GitHub access token. If not provided, uses environment variable GITHUB_TOKEN
  --all-prs                        Whether or not to list all pull requests, regardless of the label.
  --tab-output                     If set, will output a table of pull requests
  -h, --help                       output usage information
```