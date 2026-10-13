# <repo> worktree hub

Applies to every session in this hub and its worktrees, on top of the repository's own
instructions.

## Layout

- `.bare/` is the bare repository; `.git` points at it.
- `<default>/` is the permanent worktree of the default branch. Never remove it.
- Every other directory is the worktree of one branch, named after it (`fix/x` → `fix-x/`).
- The hub root is not a work tree. Explore in `<default>/`; do not change code there.

## Worktrees

- Create one with `wt switch -c <branch> --no-cd` (or `mise run hub:add <branch>`) from
  anywhere in the hub. It fast-forwards `<default>/` to `origin/<default>` first and stops if
  it cannot; tell the user instead of working around it.
- Then enter it with EnterWorktree and its `path`. If that is refused, ask the user to run
  `/cd <directory>`.
- Never use `git worktree add`, `claude --worktree`, or EnterWorktree with a `name`: they
  skip the hub's hooks.
- Remove one with `wt remove <branch>` (or `mise run hub:rm <branch>`). It deletes the branch
  only if it adds nothing to `<default>`. Never `rm -rf` a worktree.
- List them with `wt list` (or `mise run hub:ls`).
- `wt` reads its settings from this hub's `mise.toml`; run it only where mise is active.
- After moving or renaming the hub, run `mise run hub:trust`.

## Local-only files

- <copied files> are copied from `<default>/` when a worktree is created
  (`<default>/.worktreeinclude` lists them).
- `.mise.local.toml` is generated per worktree (see Project-specific). Do not edit or copy it.
- Other ignored files and folders exist only in `<default>/`.

## Instruction files

Do not add a `CLAUDE.md`, `.claude/CLAUDE.md`, or `CLAUDE.local.md` here or above: Claude Code
then stops reading the `AGENTS.md` files.

## Project-specific

<project section>
