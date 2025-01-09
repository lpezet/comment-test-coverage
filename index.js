const { inspect } = require("util");
const core = require("@actions/core");
const github = require("@actions/github");
const glob = require("@actions/glob");
const fs = require("fs");

async function processFile(filePath, inputs, extras) {
  const data = fs.readFileSync(
    // `${process.env.GITHUB_WORKSPACE}/${filePath}`,
    filePath,
    "utf8"
  );
  const json = JSON.parse(data);
  const meta = {
    commentFrom: inputs.id,
  };
  const coverage = `<!--json:${JSON.stringify(meta)}-->
|${inputs.title}| %                           | values                                                              |
|---------------|:---------------------------:|:-------------------------------------------------------------------:|
|Statements     |${json.total.statements.pct}%|( ${json.total.statements.covered} / ${json.total.statements.total} )|
|Branches       |${json.total.branches.pct}%  |( ${json.total.branches.covered} / ${json.total.branches.total} )    |
|Functions      |${json.total.functions.pct}% |( ${json.total.functions.covered} / ${json.total.functions.total} )  |
|Lines          |${json.total.lines.pct}%     |( ${json.total.lines.covered} / ${json.total.lines.total} )          |
`;
  if (inputs.dry_run) {
    console.log("WARNING:Dry run mode enabled. Skipping comment creation.");
    console.log(coverage);
    return;
  }
  await createOrUpdateComment({
    id: inputs.id,
    issue_number: extras.issue_number,
    octokit: extras.octokit,
    owner: extras.owner,
    repo: extras.repo,
    body: coverage,
  });
}

async function run() {
  try {
    const inputs = {
      token: core.getInput("token"),
      path: core.getInput("path"),
      title: core.getInput("title"),
      id: core.getInput("id"),
      issue_number: core.getInput("issue_number"),
      dry_run: core.getInput("dry_run"),
    };    
    issue_number = inputs.issue_number;
    if ( issue_number === '') {
      const {
        payload: { pull_request: pullRequest },
      } = github.context;
      if (!pullRequest) {
        core.error("issue_number not provided and this is not a pull_request event. Exiting.");
        return;
      }
      issue_number = pullRequest.number;
    }

    // const { number: issue_number } = pullRequest;
    // const { full_name: repoFullName } = repository;
    // const [owner, repo] = github.context.repository.split("/");
    const owner = github.context.repo.owner;
    const repo = github.context.repo.repo;

    const octokit = new github.getOctokit(inputs.token);

    // Resolve files matching the path pattern
    const genericGlobPattern = inputs.path.replace(/\(\?<.*?>.*?\)/g, '*'); // Replace named groups with wildcards
    const globber = await glob.create(genericGlobPattern);
    const candidateFiles = await globber.glob();

    if (candidateFiles.length === 0) {
      core.setFailed(`No files matched the path: ${inputs.path}`);
      return;
    }

    const regex = new RegExp(inputs.path);
    for (const filePath of candidateFiles) {
      const match = regex.exec(filePath);

      if (!match) {
        core.info(`Skipping file as it does not match the regex: ${filePath}`);
        continue;
      } else {
        core.info(`File [${filePath}] matches regex [${inputs.path}]`);
      }

      const namedGroups = match.groups || {};
      let title = inputs.title;
      let id = inputs.id;

      for (const [key, value] of Object.entries(namedGroups)) {
        title = title.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), value);
        id = id.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), value);
      }

      await processFile(filePath, { ...inputs, title, id }, { octokit, owner, repo, issue_number });
    }
  } catch (error) {
    core.debug(inspect(error));
    core.setFailed(error.message);
  }
}

async function createOrUpdateComment({
  id,
  issue_number,
  octokit,
  owner,
  repo,
  body,
}) {
  const onlyPreviousCoverageComments = (comment) => {
    const regexMarker = /^<!--json:{.*?}-->/;
    const extractMetaFromMarker = (body) =>
      JSON.parse(body.replace(/^<!--json:|-->(.|\n|\r)*$/g, ""));

    if (comment.user.type !== "Bot") return false;
    if (!regexMarker.test(comment.body)) return false;

    const meta = extractMetaFromMarker(comment.body);

    return meta.commentFrom === id;
  };

  const commentList = await octokit.rest.issues
    .listComments({
      owner,
      repo,
      issue_number: issue_number,
    })
    .then((response) => response.data);

  const filteredCommentList = commentList.filter(onlyPreviousCoverageComments);
  //console.log('Filtered comments:');
  //console.log(filteredCommentList);
  if (filteredCommentList && filteredCommentList.length > 0) {
    const comment = filteredCommentList[0];
    console.log("Updating comment #" + comment.id + "...");
    //console.log(filteredCommentList[0]);
    octokit.rest.issues.updateComment({
      owner,
      repo,
      comment_id: comment.id,
      body,
    });
  } else {
    console.log("Creating new comment...");
    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: issue_number,
      body,
    });
  }
}

run();
