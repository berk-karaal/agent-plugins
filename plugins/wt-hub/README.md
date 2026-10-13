# wt-hub

A skill that sets up a repository as a **worktree hub**, by cloning a URL or by converting an
existing clone. [Worktrunk](https://github.com/max-sixty/worktrunk) (`wt`) runs the worktrees,
with hooks that live in the hub.

```
<repo>/                   the hub
├── .bare/                bare repository (.git is a file pointing at it)
├── AGENTS.md             rules for agents working in the hub
├── mise.toml             Worktrunk settings + hub:add/rm/ls/trust tasks
├── wt.toml               Worktrunk hooks
├── <default>/            permanent worktree of the default branch
└── fix-x/                one worktree per branch (fix/x)
```

`wt switch -c <branch>` (or `mise run hub:add <branch>`):

1. fetches and fast-forwards `<default>/`, so new branches start from the remote's latest commit;
2. copies the local config and secrets listed in `<default>/.worktreeinclude` (e.g.
   `mise.local.toml`, `.env`);
3. writes generated per-worktree values, such as ports and database names, to
   `.mise.local.toml`;
4. trusts the new worktree's mise config.

Nothing is committed to the repository. When converting, the skill builds the hub next to the
clone and checks that every branch, stash and ignored file arrived. Only then does it swap them,
leaving the old clone at `<repo>.pre-hub` for you to delete.

## Requirements

- Git 2.48 or newer
- [mise](https://mise.jdx.dev), active in your shell
- Worktrunk: `mise use -g worktrunk`

## Usage

Ask the agent, for example: "clone git@github.com:org/repo.git as a worktree hub" or "convert
~/code/repo to a worktree hub". It proposes the project-specific values (which ignored files to
copy, which ports or database names to generate) and asks you to confirm them before writing
anything.

## Install in Claude Code

```text
/plugin marketplace add berk-karaal/agent-plugins
/plugin install wt-hub@berk-karaal
```

## Install in OpenCode V2

Requires OpenCode V2 2.0.15 or newer (earlier versions can't install from a repo subdirectory).

```sh
opencode plugin add 'github:berk-karaal/agent-plugins#main::path:plugins/wt-hub'
```
