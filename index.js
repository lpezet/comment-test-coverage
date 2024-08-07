const { inspect } = require("util");
const core = require("@actions/core");
const github = require("@actions/github");
const fs = require('fs');

async function run() {
  try {
    const inputs = {
      token: core.getInput("token"),
      path: core.getInput("path"),
      title: core.getInput("title"),
      id: core.getInput("id"),
    };

    const {
      payload: { pull_request: pullRequest, repository }
    } = github.context;

    if (!pullRequest) {
      core.error("This action only works on pull_request events");
      return;
    }

    const { number: issueNumber } = pullRequest;
    const { full_name: repoFullName } = repository;
    const [owner, repo] = repoFullName.split("/");

    const octokit = new github.getOctokit(inputs.token);

    const data = fs.readFileSync(`${process.env.GITHUB_WORKSPACE}/${inputs.path}`, 'utf8');
    const json = JSON.parse(data);
    const meta = {
      commentFrom: inputs.id,
    }
    const coverage = `<!--json:${JSON.stringify(meta)}-->
|${inputs.title}| %                           | values                                                              |
|---------------|:---------------------------:|:-------------------------------------------------------------------:|
|Statements     |${json.total.statements.pct}%|( ${json.total.statements.covered} / ${json.total.statements.total} )|
|Branches       |${json.total.branches.pct}%  |( ${json.total.branches.covered} / ${json.total.branches.total} )    |
|Functions      |${json.total.functions.pct}% |( ${json.total.functions.covered} / ${json.total.functions.total} )  |
|Lines          |${json.total.lines.pct}%     |( ${json.total.lines.covered} / ${json.total.lines.total} )          |
`;

    await createOrUpdateComment({
      id: inputs.id,
      issueNumber,
      octokit,
      owner,
      repo,
      body: coverage,
    });
    /*
    await deletePreviousComments({
      id: inputs.id,
      issueNumber,
      octokit,
      owner,
      repo,
    });

    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body: coverage,
    });
    */
  } catch (error) {
    core.debug(inspect(error));
    core.setFailed(error.message);
  }
}

async function createOrUpdateComment({ id, issueNumber, octokit, owner, repo, body}) {
  const onlyPreviousCoverageComments = (comment) => {
    const regexMarker = /^<!--json:{.*?}-->/;
    const extractMetaFromMarker = (body) => JSON.parse(body.replace(/^<!--json:|-->(.|\n|\r)*$/g, ''));

    if (comment.user.type !== 'Bot') return false;
    if (!regexMarker.test(comment.body)) return false;

    const meta = extractMetaFromMarker(comment.body);

    return meta.commentFrom === id;
  }

  const commentList = await octokit.rest.issues.listComments({
    owner,
    repo,
    issue_number: issueNumber,
  }).then(response => response.data);

  const filteredCommentList = commentList.filter(onlyPreviousCoverageComments);
  //console.log('Filtered comments:');
  //console.log(filteredCommentList);
  if (filteredCommentList && filteredCommentList.length > 0) {
    const comment = filteredCommentList[0];
    console.log('Updating comment #' + comment.id + '...');
    //console.log(filteredCommentList[0]);
    octokit.rest.issues.updateComment({ owner, repo, comment_id: comment.id, body });
  } else {
    console.log('Creating new comment...');
    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body,
    });
  }
}

async function deletePreviousComments({ id, owner, repo, octokit, issueNumber }) {
  const onlyPreviousCoverageComments = (comment) => {
    const regexMarker = /^<!--json:{.*?}-->/;
    const extractMetaFromMarker = (body) => JSON.parse(body.replace(/^<!--json:|-->(.|\n|\r)*$/g, ''));

    if (comment.user.type !== 'Bot') return false;
    if (!regexMarker.test(comment.body)) return false;

    const meta = extractMetaFromMarker(comment.body);

    return meta.commentFrom === id;
  }

  const asyncDeleteComment = (comment) => {
    return octokit.rest.issues.deleteComment({ owner, repo, comment_id: comment.id });
  }

  const commentList = await octokit.rest.issues.listComments({
    owner,
    repo,
    issue_number: issueNumber,
  }).then(response => response.data);

  await Promise.all(
    commentList
    .filter(onlyPreviousCoverageComments)
    .map(asyncDeleteComment)
  );
}

run();
