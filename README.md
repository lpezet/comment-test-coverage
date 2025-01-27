# Comment Test Coverage from a json-summary file

A GitHub action to comment on a PR on GitHub with a simple test coverage summary table that edits itself on successive pushes to the same PR.
**Forked**
This fork supports monorepos by passing an `id` to the action when necessary, which will be used to create and lookup a comment on the PR.
Added optional input `issue_number` to work outside of `pull_request` events.

## Monorepo

Here's how to use comment-test-coverage in a monorepo setup:

```yml
name: run-coverage

on: [pull_request]

jobs:
  lint-and-test:
    runs-on: ubuntu-latest
    env:
      CI: true
    steps:
    - uses: actions/checkout@v4
    - name: Use Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20'
    - run: npm install && npm run package

    - uses: lpezet/comment-test-coverage@@v2.0.0
      with:
        token: ${{ secrets.GITHUB_TOKEN }}
        path: test/_stubs/coverage-summary-100-pct.json
        title: Test Coverage - Project 1
        # id below is new and allow to differentiate between comments
        id: project-1
        # (optional) if event is not a pull_request, specify issue_number to make it work
        issue_number: 123
    
    - uses: lpezet/comment-test-coverage@@v2.0.0
      with:
        token: ${{ secrets.GITHUB_TOKEN }}
        path: test/_stubs/coverage-summary-90-pct.json
        title: Test Coverage - Project 2
        id: project-2
```

## How to use with Karma + Angular
1. Add `"codeCoverage": true,` under test > options in angular.json
2. In your karma.conf.js set coverageIstanbulReporter.reports to include `json-summary` and save it to the /coverage directory if using the sample setup below
3. Use in your workflow as illustrated below:

```yml
name: test-pull-request
on: [pull_request]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v1

      - name: Run Jasmine tests
        run: npm run test -- --no-watch --no-progress --browsers=ChromeHeadlessCI

      - name: Comment Test Coverage
        uses: AthleticNet/comment-test-coverage@1.1
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          path: coverage/coverage-summary.json
          title: Karma Test Coverage
```

## How to use with Jest
1. Add `"codeCoverage": true,` under test > options in angular.json
2. In your jest.config.js set coverageReporters to include `json-summary` and set coverageDirectory to 'coverage' if using the path in the sample setup above.
3. Use in your workflow as illustrated above in the Karma example.

## Parameters

- `token` (**required**) - The GitHub authentication token (workflows automatically set this for you, nothing needed here)
- `path` (**required**) - Path to your coverage-summary.json file
- `title` (**optional**) - Title of comment in PR (defaults to "Test Coverage")

## How to edit the action
Feel free to submit a PR to this repo and ask me to update the action, but if you'd like to create your own action:
1. Clone down repo, `npm install`, and make changes
2. Run `npm run package` 
3. Commit changes
4. Create a new release on GitHub to publish latest version of the action. See https://help.github.com/en/actions/building-actions/publishing-actions-in-github-marketplace

## Use in monorepo

When using a monorepo in Github, multiple use of comment-test-coverage actions will overwrite each other.
To address that, specify a value for the `id` input to the action for each project in your monorepo.

For example:

```yml
name: test-pull-request
on: [pull_request]
jobs:
  build-project-1:
    defaults:
      run:
        working-directory: project-1
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v1

      - name: Run Jasmine tests
        run: npm run test -- --no-watch --no-progress --browsers=ChromeHeadlessCI

      - name: Comment Test Coverage
        uses: AthleticNet/comment-test-coverage@1.1
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          path: project-1/coverage/coverage-summary.json
          title: Karma Test Coverage
          id: project-1
  build-project-2:
    defaults:
      run:
        working-directory: project-2
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Run Jasmine tests
        run: npm run test -- --no-watch --no-progress --browsers=ChromeHeadlessCI

      - name: Comment Test Coverage
        uses: AthleticNet/comment-test-coverage@1.1
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          path: project-2/coverage/coverage-summary.json
          title: Karma Test Coverage
          id: project-2
```

## Testing

```bash
env GITHUB_WORKSPACE="" GITHUB_REPOSITORY=test/acme INPUT_DRY_RUN=1 INPUT_TOKEN=dummy_token INPUT_PATH=test/_stubs/coverage-summary-90-pct.json INPUT_ID=test-1 INPUT_ISSUE_NUMBER=ISS1 node index.js 
```

```bash
env GITHUB_WORKSPACE="" GITHUB_REPOSITORY=test/acme INPUT_DRY_RUN=1 INPUT_TOKEN=dummy_token INPUT_PATH='test/(?<app>app[^/]+)/coverage-summary-90-pct.json' INPUT_ID='${app}' INPUT_ISSUE_NUMBER=ISS1 node index.js
```


## License

Repurposed from https://github.com/peter-evans/commit-comment, Copyright (c) 2019 Peter Evans and https://github.com/mshick/add-pr-comment, Copyright (c) 2019 Michael Shick
