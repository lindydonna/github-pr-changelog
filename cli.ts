#!/usr/bin/env node
import * as program from "commander";
import * as changelog from "./changelog";
import * as colors from "colors";
import * as path from "path";
import { print } from "util";

let description =
   `GitHub pull request changelog generator
  * By default, only PRs that have either "impact/changelog" or "impact/breaking" are printed. 
  * To print all PRs, pass the CLI option --all-prs
  * "Added" section: PRs whose label contains the word "feature" or "enhancement"
  * "Fixed" section: PRs whose label contains the word "bug"
  * "Changed" section: PRs that do not fall in the "Added" or "Fixed" category OR have the label "impact/breaking"`;

program
    .version('0.1.0', '-v, --version')
    .description(description)
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

enum ItemSection {
    Breaking = "(Breaking) ", // the space at the end is important, as it makes formatting easier
    Added    = "Added",
    Fixed    = "Fixed",
    Changed  = "Changed"
}

(async () => {

    const changelogLabels = program.allPrs ? undefined : [ "impact/changelog", "impact/breaking" ];

    let allPrs: any[] = [];
    
    program.repos = program.repos.split(",");

    for (let repo of program.repos) {
        let directory = path.join(program.gitDirectory, repo);    
        // will filter on changelogLabels, which will be no filtering if `program.allPrs` is true
        allPrs = allPrs.concat(
            await changelog.getPullsInRange(
            program.owner, repo,
            directory, program.from, program.to, ghToken, changelogLabels)
        );
    }

    // add fields to the pull request objects, to make filtering easier
    allPrs.forEach(pr => {
        pr.repoName = pr.head.repo.full_name;

        pr.changelog = hasLabelString(pr, "changelog");
        pr.breaking  = hasLabelString(pr, "breaking");

        // NOTE: pr.section will be undefined if items without "Changelog" are in the list
        if (hasLabelString(pr, "bug")) {
            pr.section = ItemSection.Fixed;
        } else if (hasLabelString(pr, "feature") || hasLabelString(pr, "enhancement")) {
            pr.section = ItemSection.Added;
        } else if (pr.breaking) {
            pr.section = ItemSection.Breaking;
        } else if (pr.changelog) {
            pr.section = ItemSection.Changed;
        }
    }); 

    if (program.tabOutput) {
        console.log(`Title\tUser\tIsChangelog\tIsBreaking\tChangelog Section\tRepo\tLink`)

        allPrs.forEach(pr => {
            console.log(
                `${pr.title}\t${pr.user.login}\t${pr.changelog}\t${pr.breaking}\t${pr.section}\t` +
                `${pr.repoName}\t=HYPERLINK("${pr.html_url}", "${pr.html_url}")`
            );
        });
    } else {
        let breakingPrs = allPrs.filter(pr => pr.section == ItemSection.Breaking);
        let changedPrs =  allPrs.filter(pr => pr.section == ItemSection.Changed || ItemSection.Breaking);

        console.log(`## [${program.to}] - 2018/MM/DD {#version-label}`);
        
        console.log(`\n### Added`);
        printSection(ItemSection.Added, allPrs, true); 
        
        console.log("\n### Changed {#version-label-changed}");
        printSection(ItemSection.Breaking, allPrs, true) 
        printSection(ItemSection.Changed, allPrs, true); 

        console.log("\n### Fixed");
        printSection(ItemSection.Fixed, allPrs, true); 
    }

    console.error("*** Output complete ***");
})();

function hasLabelString(gitHubPr: any, labelText: string): boolean {
    return gitHubPr.labels.filter( (l: any) => l.name.includes(labelText) ).length > 0
}

function formatAsMarkdown(gitHubPr: any, includeBody: boolean): string {
    // print a prefix for [BREAKING]
    let prefixStr = (gitHubPr.section == ItemSection.Breaking) ? gitHubPr.section : "";
    let body = 
        includeBody ? 
        `<!-- BEGIN BODY ${gitHubPr.number} -->\n${gitHubPr.body}\n<!-- END BODY ${gitHubPr.number}-->` 
        : "";

    let result = 
        `<!-- ${gitHubPr.section} ${gitHubPr.repoName}#${gitHubPr.number} -->\n`
        + `-  ${prefixStr}${gitHubPr.title} ([${gitHubPr.repoName}#${gitHubPr.number}](${gitHubPr.html_url})).\n`
        + body;

    return result;
}

function printSection(sectionFilter: ItemSection, gitHubPrs: any[], includeBody: boolean): void {
    let sectionPrs = gitHubPrs.filter(pr => pr.section == sectionFilter);
    sectionPrs.forEach(pr => { console.log(formatAsMarkdown(pr, includeBody)) });
}
