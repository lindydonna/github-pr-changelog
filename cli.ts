#!/usr/bin/env node
import * as commander from "commander";
import * as changelog from "./changelog";
import * as colors from "colors";

const program = require('commander');

program
    .version('0.1.0', '-v, --version')
    .description('GitHub pull request changelog generator')
    .option('-f, --from <tag>', 'start of changelog range, as a git tag or revision')
    .option('-t, --to <tag>', 'end of changelog range, as a git tag or revision')
    .option('-o, --owner <owner>', 'GitHub owner or organization')
    .option('-r, --repo <repo>', 'GitHub repo')
    .option('-d, --git-directory [directory]', 'directory to a git working tree, or current directory if not specified')
    .option('--token [token]', 'GitHub access token. If not provided, uses environment variable GITHUB_TOKEN')
    .option('--all-prs', 'Whether or not to list all pull requests, regardless of the label.')
    .option('--tab-output', 'If set, will output a table of pull requests')
    .parse(process.argv); 

if (! (program.from && program.to && program.owner && program.repo)) {  // required options
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

(async () => {
    
    const changelogLabels = program.allPrs ? undefined : [ "impact/changelog", "impact/breaking" ];

    let filteredPrs = await changelog.getPullsInRange(
        program.owner, program.repo,
        program.gitDirectory, program.from, program.to, ghToken, changelogLabels);

    if (program.tabOutput) { // output as table
        filteredPrs.forEach(pr => {
            const changelog = pr.labels.filter( (l: any) => l.name == "impact/changelog").length > 0;
            const breaking = pr.labels.filter( (l: any) => l.name == "impact/breaking").length > 0;
    
            console.log(`${pr.title.replace(",", ".")}\t${pr.user.login}\t${changelog}\t${breaking}\t${program.repo}\t=HYPERLINK("${pr.html_url}", "${pr.html_url}")`);
        });    
    } else {
        // TODO: turn into markdown
        filteredPrs.forEach(pr => {
            pr.labelNames = pr.labels.map( (l: any) => l.name );
            pr["repoName"] = program.repo;
            let stringified = JSON.stringify(pr, ["title", "html_url", "repoName", "labelNames", "body"], 4);
            console.log(stringified);
        });
    }
})();

