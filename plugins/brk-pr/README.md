# brk-pr

GitHub pull request workflow skills.

## review-loop

`/brk-pr:review-loop [PR] [--one-round | --approve N] [--auto-merge [squash|merge|rebase]]`

Run after opening a PR. Each round, the skill:

1. waits for reviews;
2. checks each comment against the code;
3. fixes the comments it agrees with;
4. asks you about unsure comments and structural or significant change requests, all in one message;
5. declines invalid comments and needless nits with a reason;
6. pushes, replies in each thread, resolves the fixed threads and re-requests review.

By default it loops until GitHub reports the PR as mergeable. It stops and asks you when there
are conflicts, the branch is behind its base, or CI is failing. It never deletes the branch.

| Flag | Effect |
|---|---|
| `--one-round` | stop after one round |
| `--approve N` | stop when N reviewers have approved |
| `--auto-merge [method]` | merge when mergeable (default `squash`) |

Inside [herdr](https://herdr.dev), the tab name shows the current state after its own name:
`polling`, `fixing`, `NEED YOU`, `MERGEABLE`, `MERGED`, `APPROVED` or `ROUND DONE`.

Requires the `gh` CLI, logged in. herdr status also needs `jq`.

## Install in Claude Code

```text
/plugin marketplace add berk-karaal/agent-plugins
/plugin install brk-pr@berk-karaal
```

## Install in OpenCode V2

Requires OpenCode V2 2.0.15 or newer (earlier versions can't install from a repo subdirectory).

```sh
opencode plugin add 'github:berk-karaal/agent-plugins#main::path:plugins/brk-pr'
```
