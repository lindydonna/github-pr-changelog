import * as GitHub from "@octokit/rest";
import * as child_process from "child_process";
import * as os from "os";

async function getClosedPullRequests(owner: string, repo: string, gitHubToken: string): Promise<any[]> {

    const octokit = new GitHub();

    octokit.authenticate({
        type: 'token',
        token: gitHubToken
    })
    
    let response =
        await octokit.pullRequests.getAll(
            { owner: owner, repo: repo, state: "closed", per_page: 100 });

    let data: any[] = response.data;

    while (octokit.hasNextPage(response)) {
        response = await octokit.getNextPage(response);
        data = data.concat(response.data);
    }

    return data;
}

/**
 * For a range of git tags, returns the GitHub pull requests that were merged in this range,
 * and that have one of the labels to filter on.
 * For response format, see see https://developer.github.com/v3/pulls/#list-pull-requests
 * 
 * @param owner          GitHub owner (also known as "organization")
 * @param repo           GitHub repo
 * @param gitDirectory   Path to a git working tree that contains the tag range
 * @param fromTag        git tag or commit hash for start of range (must exist in `gitDirectory` tree)
 * @param toTag          git tag or commit hash for end of range (must exist in `gitDirectory` tree)
 * @param labelFilter    Array of label names to filter on. Pass `null` for no filtering.
 * @returns              Array of GitHub pull request response objects
 */
export async function getPullsInRange(
    owner: string, repo: string, 
    gitDirectory: string, fromTag: string, toTag: string, 
    gitHubToken: string,
    labelFilter?: string[]): Promise<any[]> { 

    // output to standard error as informational, in case there are GitHub or git errors
    console.error(`--- Getting closed PRs for ${owner}:${repo} ----`);

    let closedPrs = await getClosedPullRequests(owner, repo, gitHubToken);

    // filter to only pull requests in `labelFilter`
    if (labelFilter) {
        closedPrs = closedPrs.filter(
            pr => pr.labels.find( (l:any) => labelFilter.includes(l.name)) );
    }
    
    console.error(`+++ Running git rev-list ${fromTag}..${toTag} in ${gitDirectory} +++`);
    try {
        let gitOutput = 
            child_process.execSync(
                `git rev-list ${fromTag}..${toTag}`, { cwd: gitDirectory, encoding: "utf8" }
            );

        let gitHashes = gitOutput.split(os.EOL);

        return closedPrs
            .filter(pr => gitHashes.includes(pr.merge_commit_sha));
    } catch (ex) {
        return [];
    }
}
