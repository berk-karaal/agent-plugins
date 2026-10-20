---
name: review-loop
description: Works through GitHub pull request reviews in rounds until the PR is mergeable - watches for reviews, fixes agreed comments, asks the user about unsure or significant ones, declines invalid ones and needless nits, pushes, replies, resolves fixed threads and re-requests review; can auto-merge. Use after opening a PR or when asked to handle PR review feedback. Flags --one-round, --approve N, --auto-merge [squash|merge|rebase].
argument-hint: "[PR] [--one-round | --approve N] [--auto-merge [squash|merge|rebase]]"
---

# Review loop

GitHub only; use `gh` for everything, from the repository's directory. `PR` is the number the
user gave, else `gh pr view --json number --jq .number`.

## Flags

- No flag: loop until the PR is mergeable (`mergeStateStatus` is `CLEAN`).
- `--approve N`: loop until N reviewers' latest review is an approval.
- `--one-round`: stop after one round.
- `--auto-merge [squash|merge|rebase]`: when `CLEAN`, `gh pr merge "$PR" --squash` (or the given
  method). Never delete the branch.

## Status in herdr

Inside herdr (`HERDR_TAB_ID` set), show the state after the tab's own name. Run this at every
change, with STATUS one of `polling`, `fixing`, `NEED YOU`, `MERGEABLE`, `MERGED`, `APPROVED`,
`ROUND DONE`:

```sh
[ -z "$HERDR_TAB_ID" ] || herdr tab rename "$HERDR_TAB_ID" "$(herdr tab get "$HERDR_TAB_ID" | jq -r .result.tab.label | sed -E 's/ - (polling|fixing|NEED YOU|MERGEABLE|MERGED|APPROVED|ROUND DONE)$//') - STATUS" >/dev/null
```

## Loop

1. **Check** the PR. Right after a push GitHub can report `CLEAN` before CI has registered its
   checks, so trust this only when the last push is at least 2 minutes old; wait until it is.

   ```sh
   gh pr view "$PR" --json mergeStateStatus,reviewDecision,latestReviews,statusCheckRollup --jq '[.statusCheckRollup[] | if .__typename == "CheckRun" then (if .status == "COMPLETED" then .conclusion else "PENDING" end) else .state end] as $c | {mergeStateStatus, reviewDecision, approvals: ([.latestReviews[] | select(.state == "APPROVED")] | length), checksFailed: any($c[]; IN("FAILURE","ERROR","TIMED_OUT","CANCELLED","ACTION_REQUIRED","STARTUP_FAILURE")), checksPending: any($c[]; IN("PENDING","EXPECTED"))}'
   ```

   - Flag condition met, but feedback from others newer than the last commit that this run has
     not handled yet (such as an approval with a nit): go to 3 first.
   - Flag condition met: auto-merge (`MERGED`), or stop with `MERGEABLE` / `APPROVED` /
     `ROUND DONE`.
   - Stop with `NEED YOU` on failed checks, `DIRTY`, `BEHIND`, `BLOCKED` while approved with no
     checks pending, or a failed merge: fixing CI or conflicts is not this skill's job (for
     `DIRTY`/`BEHIND`, suggest `/brk-pr:update-branch`).
   - Otherwise (including `UNSTABLE`/`BLOCKED` while checks are pending) go to 2.

2. **Wait** (`polling`) for feedback from others newer than the PR's last commit; feedback that is
   already there counts. It also exits on `CLEAN` (unless `UNTIL_CLEAN=0`, set it with `--approve`
   or `--one-round`), failed checks, `DIRTY` or `BEHIND`. Run it in the background if you can.

   ```sh
   export PR UNTIL_CLEAN=1 ME="$(gh api user --jq .login)" SINCE="$(gh pr view "$PR" --json commits --jq '.commits[-1].committedDate')"
   until gh pr view "$PR" --json reviews,comments,mergeStateStatus,statusCheckRollup --jq '([(.reviews[] | select(.submittedAt > $ENV.SINCE and .author.login != $ENV.ME)), (.comments[] | select(.createdAt > $ENV.SINCE and .author.login != $ENV.ME))] | length > 0) or (.mergeStateStatus == "CLEAN" and $ENV.UNTIL_CLEAN == "1") or IN(.mergeStateStatus; "DIRTY", "BEHIND") or any(.statusCheckRollup[]; (.conclusion // .state) | IN("FAILURE","ERROR","TIMED_OUT","CANCELLED","ACTION_REQUIRED","STARTUP_FAILURE"))' | grep -qx true; do sleep 120; done
   ```

3. **Collect** (`fixing`): unresolved threads, plus review bodies and PR comments from step 2's
   window (`gh pr view "$PR" --json reviews,comments`).

   ```sh
   gh api graphql -F owner='{owner}' -F repo='{repo}' -F n="$PR" -f query='query($owner:String!,$repo:String!,$n:Int!){repository(owner:$owner,name:$repo){pullRequest(number:$n){reviewThreads(first:100){nodes{id isResolved path line comments(first:50){nodes{author{login} body}}}}}}}' --jq '.data.repository.pullRequest.reviewThreads.nodes[] | select(.isResolved | not)'
   ```

4. **Judge each item** against the actual code and the whole thread. Bot comments get the same
   scrutiny.
   - Agree, small or local: fix it.
   - Agree but structural or significant (architecture, public API, data model, migration, new
     dependency, beyond the PR's scope, rewrites much of the diff): ask.
   - Unsure: ask.
   - Valid nit (naming, wording, style, a small optional suggestion): never worth a push on its
     own, since a push means another round of CI and review. Apply it only alongside other fixes
     in the same round. If nits are all the round has, ask whether to apply them; if not, reply
     that it is left as is to avoid another review round.
   - Invalid or a needless nit: decline with a short reason.

   Ask everything in one message with your recommendation for each, and set `NEED YOU` while
   waiting. Agreed small fixes may proceed meanwhile; nothing waiting on the user is committed.

5. **Fix** the agreed items, run the project's tests and linters, commit, push.

6. **Answer.** Reply in each thread with what changed (with the commit) or why it is declined;
   resolve only fixed threads. Answer review bodies and PR comments in one `gh pr comment`.

   ```sh
   gh api graphql -F id="$THREAD_ID" -f body="$REPLY" -f query='mutation($id:ID!,$body:String!){addPullRequestReviewThreadReply(input:{pullRequestReviewThreadId:$id,body:$body}){comment{url}}}'
   gh api graphql -F id="$THREAD_ID" -f query='mutation($id:ID!){resolveReviewThread(input:{threadId:$id}){thread{isResolved}}}'
   ```

7. **Re-request** everyone who left feedback: `gh pr edit "$PR" --add-reviewer <login>` (bots by
   their documented trigger comment). Skip this when the push holds only nits on an already
   approved PR. Back to 1.
