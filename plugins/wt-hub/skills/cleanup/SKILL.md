---
name: cleanup
description: Cleans up a worktree hub - removes worktrees and local branches already merged into the default branch or whose GitHub PR was merged, and asks about closed-PR, remote-deleted and stale ones, including any with uncommitted or unpushed work. Use when the user wants to clean up, prune or tidy the worktrees or branches of a hub.
argument-hint: "[--stale-days N]"
---

# Clean up a hub

Run everything from the hub root (the directory with `.bare/`), with `mise exec -- wt` so the
hub's settings apply. Remote branches are never deleted. `STALE_DAYS` is `--stale-days`, else 30.

1. **Fetch.** `git fetch -q --prune origin`.

2. **Remove what is provably merged**, without asking. Report its output.

   ```sh
   mise exec -- wt step prune --foreground
   ```

   It removes clean worktrees and branches whose changes are all in the default branch
   (squash merges included), and skips anything younger than a day.

3. **Collect the rest.**

   ```sh
   mise exec -- wt list --branches --format json | jq -c '.items[] | select(.worktree.main | not) | {branch, path: .worktree.path, last: .head.committed_at, dirty: ([.worktree.changes // {} | to_entries[] | select(.value == true) | .key] | join(","))}'
   git for-each-ref --format='%(refname:short) %(upstream:track)' refs/heads | grep '\[gone\]'
   gh pr list --state all --limit 300 --json number,headRefName,headRefOid,state,title
   date -u +%Y-%m-%dT%H:%M:%SZ
   ```

   For each branch, unpushed commits are `git log --oneline "$BRANCH" --not --remotes`. If
   `gh` is missing or the repository is not on GitHub, skip the PR signal and say so.

4. **Classify** each branch by its newest PR:
   - **Remove without asking**: the PR is merged, the worktree is clean, and
     `git merge-base --is-ancestor "$BRANCH" <headRefOid>` succeeds (nothing local beyond what
     was merged).
   - **Ask**: a merged PR with more local work; a closed, unmerged PR; a deleted remote
     branch (`[gone]`) with no open PR; no open PR and a last commit older than `STALE_DAYS`.
   - **Keep**: everything else, such as open PRs and recent work.

5. **Ask once.** List every "ask" branch with its reason, PR, last commit date, and what would
   be lost (uncommitted changes, unpushed commits), plus your recommendation. Remove only what
   the user confirms.

6. **Remove** each one with `mise exec -- wt remove -D --foreground "$BRANCH"`. Add `--force`
   only for a dirty worktree the user confirmed. Never `rm -rf` a worktree. Finish with a
   summary of what was removed, kept and why, then `mise exec -- wt list`.
