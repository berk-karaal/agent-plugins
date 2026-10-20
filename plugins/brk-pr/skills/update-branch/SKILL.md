---
name: update-branch
description: Brings a GitHub pull request branch up to date with its base branch, like GitHub's "Update branch" button - fetches the base, merges it into the PR branch, resolves conflicts, and pushes. Asks the user when a conflict or a structural change in the base needs their decision. Use when a PR is behind its base or has merge conflicts.
argument-hint: "[PR]"
---

# Update branch

GitHub only; use `gh` and `git` from the repository's directory. `PR` is the number the user gave,
else `gh pr view --json number --jq .number`. Merge only: never rebase, never force-push.

1. **Prepare.**
   - `BASE`/`HEAD`: `gh pr view "$PR" --json baseRefName,headRefName`. The base remote is the
     one pointing at the PR's base repository, usually `origin`.
   - Remember the current branch. If the tree is dirty, `git stash push -u -m brk-pr-update-branch`.
   - If the current branch isn't `HEAD`, `gh pr checkout "$PR"`.
   - `git pull --ff-only`. If the local and remote PR branch have diverged, stop and ask.

2. **Merge.** `git fetch origin "$BASE"`. If `git merge-base --is-ancestor "origin/$BASE" HEAD`,
   it is already up to date: skip to 4. Otherwise `git merge --no-edit "origin/$BASE"`.

3. **Resolve conflicts**, if any. For each file, learn what both sides meant
   (`git log --oneline -p HEAD..."origin/$BASE" -- <file>` and the PR's own changes) and
   combine them so both intents survive; take one side only when that is truly right. Then
   run the project's tests and linters and fix what the merge broke. `git commit --no-edit`.

   Tell the user about structural changes in the base that affect the PR, even when they merged
   cleanly: renamed, moved or deleted code the PR uses, changed signatures or data models,
   clashing migrations, or both sides reworking the same logic differently. When one needs a
   decision, ask everything in one message with your recommendation and wait; push nothing
   until answered. If they want to drop the update, `git merge --abort`.

4. **Push** with `git push`. Switch back to the remembered branch and `git stash pop` if you
   stashed; if the pop conflicts, tell the user and leave the stash in place. Report what was
   merged, how each conflict was resolved, and anything the user should know.
