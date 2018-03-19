#!/usr/bin/env node
import * as program from "commander";
import * as changelog from "./changelog";
import * as colors from "colors";
import * as path from "path";

program
    .version('0.1.0', '-v, --version')
    .description('GitHub pull request changelog generator')
    .option('-f, --from <tag>', 'Start of changelog range, as a git tag or revision')
    .option('-t, --to <tag>', 'End of changelog range, as a git tag or revision')
    .option('-o, --owner <owner>', 'GitHub owner or organization')
    .option('-r, --repos <repo>', 'GitHub repo')
    .option('-d, --git-directory [directory]', 'Parent directory of git working tree for `repo`. Defaults to current directory if not specified.')
    .option('--token [token]', 'GitHub access token. If not provided, uses environment variable GITHUB_TOKEN.')
    .option('--all-prs', 'List all pull requests, regardless of the label')
    .option('--tab-output', 'Output as table, instead of markdown')
    .parse(process.argv); 

if (! (program.from && program.to && program.owner && program.repos)) {  // required options
    program.outputHelp( (text: any) => colors.red(text) );
    process.exit(1);
}

if (! (program.token || process.env.GITHUB_TOKEN)) {
    console.error("Error: no GitHub token in `token` or environment variable `GITHUB_TOKEN`");
    program.outputHelp( (text: any) => colors.red(text) );
    process.exit(1);
}

let ghToken = program.token || process.env.GITHUB_TOKEN;

program.gitDirectory = program.gitDirectory || ".";

function formatAsMarkdown(gitHubPr: any, commentText: string): string {
    let result = 
        `<!-- ${commentText} ${gitHubPr.repoName}#${gitHubPr.number} -->\n`
        + `-  ${gitHubPr.title} ([{${gitHubPr.repoName}#${gitHubPr.number}](${gitHubPr.html_url})).\n`
        + `<!-- BEGIN BODY -->\n${gitHubPr.body}\n<!-- END BODY -->`;

    return result;
}

(async () => {
    
    const changelogLabels = program.allPrs ? undefined : [ "impact/changelog", "impact/breaking" ];

    let allPrs: any[] = [];
    
    program.repos = program.repos.split(",");

    for (let repo of program.repos) {
        let directory = path.join(program.gitDirectory, repo);
        // console.log(`${repo}, ${directory}`);
    
        // will filter on changelogLabels, which will be no filtering if `program.allPrs` is true
        allPrs = allPrs.concat(
            await changelog.getPullsInRange(
            program.owner, repo,
            directory, program.from, program.to, ghToken, changelogLabels)
        );
    }

    // add fields for `changelog`, `breaking` and `repoName`
    allPrs.forEach(pr => {
        pr.changelog = pr.labels.filter( (l: any) => l.name == "impact/changelog").length > 0;
        pr.breaking = pr.labels.filter( (l: any) => l.name == "impact/breaking").length > 0;
        pr.repoName = pr.head.repo.full_name;
    }); 

    if (program.tabOutput) {
        if (program.tabOutput) { // output as table
            allPrs.forEach(pr => {
                console.log(`${pr.title}\t${pr.user.login}\t${pr.changelog}\t${pr.breaking}\t${pr.repoName}\t=HYPERLINK("${pr.html_url}", "${pr.html_url}")`);
            });
        }
    } else {
        let addedPrs =   allPrs.filter(pr => pr.changelog && !pr.breaking);
        let changedPrs = allPrs.filter(pr => pr.breaking);
        let fixedPrs =   allPrs.filter(pr => !pr.changelog && !pr.breaking);

        console.log(`## [${program.to}] - 2018/MM/DD {#version-label}`);
        
        console.log(`\n### Breaking`);
        changedPrs.forEach(pr => { console.log(`<!-- BREAKING ${pr.repoName}#${pr.number} -->\n -   FIXME ${pr.title}`) });

        console.log(`\n### Added`);
        addedPrs.forEach(pr => { console.log(formatAsMarkdown(pr, "ADDED")) });
        
        console.log("\n### Changed {#version-label}");
        changedPrs.forEach(pr => { console.log(formatAsMarkdown(pr, "CHANGED")) });

        console.log("\n### Fixed");
        fixedPrs.forEach(pr => { console.log(formatAsMarkdown(pr, "FIXED")) });
    }
})();