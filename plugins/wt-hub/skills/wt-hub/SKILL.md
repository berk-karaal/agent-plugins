---
name: wt-hub
description: Sets up a git repository as a worktree hub (bare repo in .bare, a permanent default-branch worktree, one worktree per branch, managed by Worktrunk's wt with hub-local hooks), either by cloning a URL or by converting an existing clone. Use when the user wants to clone a repo into the worktree hub layout, convert a regular clone into it, or asks how a hub is set up.
---

# Worktree hub

A hub is one directory per repository:

```
<hub>/                    named after the repository
├── .bare/                bare repository
├── .git                  file: "gitdir: ./.bare"
├── AGENTS.md             rules for agents working in the hub
├── mise.toml             WORKTRUNK_* env + hub:add/rm/ls/trust tasks
├── wt.toml               Worktrunk hooks
├── <default>/            permanent worktree of the remote's default branch
└── <branch|sanitize>/    one worktree per branch (fix/x → fix-x)
```

Creating a worktree (`wt switch -c`) fetches, fast-forwards `<default>/`, copies the local
config/secrets listed in `<default>/.worktreeinclude`, writes the generated per-worktree values
to `.mise.local.toml` (ports, database names) and trusts the new worktree's mise config.
Nothing is committed to the repository.

The templates for the hub files are in `templates/` next to this file.

## 1. Check the tools

Run these and stop with the fix if one fails:

- `git version` — 2.48 or newer (relative worktree links).
- `mise --version`, and mise must be active in the shell (`mise env` prints without error).
- `wt --version` — if missing, ask the user before running `mise use -g worktrunk`.

Run every command below in bash or zsh. Set the variables first and quote them as shown.

## 2. Pick the mode and the paths

- **Clone**: the user gives a URL. `REPO` is the repository name, `HUB` defaults to
  `$PWD/$REPO`; ask if another location is wanted. `HUB` must not exist.
- **Convert**: the user gives an existing clone `OLD`. `HUB` becomes that same path, `REPO` its
  directory name. Work happens in `TMP="$(dirname "$OLD")/.$REPO.hub-tmp"`, then the two are
  swapped; the old clone ends up at `$OLD.pre-hub` and is never deleted.

For convert, refuse and tell the user what to fix if:

- `git -C "$OLD" status --porcelain` prints anything (uncommitted or untracked files);
- a rebase, merge, cherry-pick, revert or bisect is in progress (`git -C "$OLD" status`);
- after `git -C "$OLD" worktree prune`, `git -C "$OLD" worktree list` shows more than one entry;
- `$OLD.pre-hub` or `$TMP` already exists.

If `git -C "$OLD" symbolic-ref refs/remotes/origin/HEAD` fails, run
`git -C "$OLD" remote set-head origin --auto` first.

For both: if the repository has a `.gitmodules`, stop: submodules are not supported.

## 3. Propose the project values, confirm once

Read the repository (for convert: `OLD`; for clone: after step 4) and propose, in one message:

1. **Default branch**: the remote's `origin/HEAD` (`git ls-remote --symref "$URL" HEAD`, or
   `git -C "$OLD" symbolic-ref --short refs/remotes/origin/HEAD`).
2. **Copied files**: ignored files that are per-checkout config or secrets, as gitignore
   patterns for `.worktreeinclude` (e.g. `mise.local.toml`, `.env`, `.env.*.local`). Look at
   `.gitignore` and, for convert, `git -C "$OLD" ls-files --others --ignored --exclude-standard --directory`.
   Not build output, caches, or personal notes.
3. **Generated values**: settings two worktrees must not share when they run at the same time.
   Find how the project reads them from the environment (config loaders, README, compose
   files), then propose one line each:
   - ports: `NAME = "{{ (remote_url ~ '/' ~ branch) | hash_port }}"` (10000–19999, stable per
     branch);
   - database names: `NAME = "<prefix>_{{ branch | sanitize_db }}"`.
   If the project needs values allocated from a small pool (e.g. a few Redis databases), say
   so: that needs a project-specific hook, which this skill doesn't write.
4. **Project-specific AGENTS.md section**: what the generated values mean (and that
   `<default>/` uses the project defaults), plus anything else the user wants agents to know.

Use what the user confirms; do not decide these alone.

## 4. Create the bare repository

**Clone** (`HUB` from step 2):

```sh
git clone --bare "$URL" "$HUB/.bare"
printf 'gitdir: ./.bare\n' > "$HUB/.git"
git -C "$HUB" config remote.origin.fetch '+refs/heads/*:refs/remotes/origin/*'
git -C "$HUB" fetch -q origin
git -C "$HUB" remote set-head origin --auto
DEFAULT=$(git -C "$HUB" symbolic-ref --short refs/remotes/origin/HEAD | sed 's#^origin/##')
git -C "$HUB" for-each-ref --format='%(refname:short)' refs/heads | grep -vx "$DEFAULT" | while IFS= read -r b; do git -C "$HUB" branch -q -D "$b"; done
HUB_BUILD="$HUB"
```

A bare clone copies every remote branch as a local one; the last line keeps only the default
branch (the others remain as `origin/*`).

**Convert** (build in `TMP` from the old clone itself, nothing is downloaded):

```sh
HUB="$OLD"; TMP="$(dirname "$OLD")/.$REPO.hub-tmp"
git clone -q --bare "$OLD" "$TMP/.bare"
printf 'gitdir: ./.bare\n' > "$TMP/.git"
git -C "$TMP" remote set-url origin "$(git -C "$OLD" remote get-url origin)"
git -C "$TMP" config remote.origin.fetch '+refs/heads/*:refs/remotes/origin/*'
git -C "$TMP" fetch -q "$OLD" 'refs/remotes/origin/*:refs/remotes/origin/*'
DEFAULT=$(git -C "$OLD" symbolic-ref --short refs/remotes/origin/HEAD | sed 's#^origin/##')
git -C "$TMP" symbolic-ref refs/remotes/origin/HEAD "refs/remotes/origin/$DEFAULT"
git -C "$OLD" config --local --name-only --list | grep -vE '^(core|extensions)\.|^remote\.origin\.(url|fetch)$' | sort -u | while IFS= read -r key; do
  git -C "$TMP" config --unset-all "$key" 2>/dev/null
  git -C "$OLD" config --local --get-all "$key" | while IFS= read -r value; do git -C "$TMP" config --add "$key" "$value"; done
done
cp "$OLD/.git/info/exclude" "$TMP/.bare/info/exclude"
for f in "$OLD"/.git/hooks/*; do case "$f" in *.sample) ;; *) [ -f "$f" ] && cp -p "$f" "$TMP/.bare/hooks/" ;; esac; done
HUB_BUILD="$TMP"
```

The bare clone carries every local branch; the config loop carries their upstreams and the
rest of the clone's local settings.

The remaining steps work in `HUB_BUILD`.

## 5. Configure the hub and create `<default>/`

```sh
git -C "$HUB_BUILD" config worktree.useRelativePaths true
git -C "$HUB_BUILD" symbolic-ref HEAD "refs/heads/$DEFAULT"
git -C "$HUB_BUILD" show-ref -q --verify "refs/heads/$DEFAULT" || git -C "$HUB_BUILD" branch -q "$DEFAULT" "origin/$DEFAULT"
git -C "$HUB_BUILD" branch -q --set-upstream-to="origin/$DEFAULT" "$DEFAULT"
printf '\n# worktree hub\n.mise.local.toml\n.worktreeinclude\n' >> "$HUB_BUILD/.bare/info/exclude"
git -C "$HUB_BUILD" worktree add -q "$DEFAULT" "$DEFAULT"
```

For **convert**, also bring `<default>/` up to date and carry over the clone's ignored files and
stashes:

```sh
git -C "$HUB_BUILD" fetch -q origin
git -C "$HUB_BUILD/$DEFAULT" merge -q --ff-only "origin/$DEFAULT"
git -C "$OLD" ls-files -z --others --ignored --exclude-standard --directory | (cd "$OLD" && tar --null -T - -cf -) | tar -xf - -C "$HUB_BUILD/$DEFAULT"
git -C "$OLD" stash list --format='%H %gs' | awk '{a[NR]=$0} END {for (i = NR; i > 0; i--) print a[i]}' | while read -r sha msg; do git -C "$HUB_BUILD/$DEFAULT" stash store -m "$msg" "$sha"; done
```

If the fast-forward fails, the clone's `<default>` has local commits: stop and tell the user.

## 6. Write the hub files

Copy each template into `HUB_BUILD` and fill it in:

- `templates/mise.toml` → `$HUB_BUILD/mise.toml`, unchanged.
- `templates/wt.toml` → `$HUB_BUILD/wt.toml`. Replace the `EXAMPLE_PORT` line with the confirmed
  generated values; with none, delete the whole `worktree-env` step.
- `templates/AGENTS.md` → `$HUB_BUILD/AGENTS.md`. Replace `<repo>`, `<default>`, `<copied files>`
  and `<project section>`. Without generated values, drop the `.mise.local.toml` bullet.
- `$HUB_BUILD/$DEFAULT/.worktreeinclude`: the confirmed copied-file patterns, one per line.

Then trust the configs and approve the hooks. Show the user the commands
`mise exec -- wt config approvals list` prints, and approve them only after the user agrees:

```sh
mise trust -q "$HUB_BUILD/mise.toml"
mise trust -q "$HUB_BUILD/$DEFAULT"
cd "$HUB_BUILD/$DEFAULT" && mise exec -- wt config approvals list
cd "$HUB_BUILD/$DEFAULT" && mise exec -- wt -y config approvals add
```

## 7. Convert only: recreate the checked-out branch, verify, swap

If the old clone was on a branch other than `<default>`, give it a worktree through `wt`, so the
hooks run:

```sh
BRANCH=$(git -C "$OLD" symbolic-ref --short HEAD)
[ "$BRANCH" = "$DEFAULT" ] || (cd "$HUB_BUILD" && mise exec -- wt switch "$BRANCH" --no-cd)
```

Verify before swapping; stop on any difference:

```sh
diff <(git -C "$OLD" for-each-ref --format='%(refname) %(objectname) %(upstream)' refs/heads | grep -v "^refs/heads/$DEFAULT ") \
     <(git -C "$HUB_BUILD" for-each-ref --format='%(refname) %(objectname) %(upstream)' refs/heads | grep -v "^refs/heads/$DEFAULT ") && echo "branches: ok"
{ ! git -C "$OLD" show-ref -q --verify "refs/heads/$DEFAULT" || git -C "$HUB_BUILD" merge-base --is-ancestor "$(git -C "$OLD" rev-parse "$DEFAULT")" "$DEFAULT"; } && echo "$DEFAULT: ok"
diff <(git -C "$OLD" stash list --format=%H) <(git -C "$HUB_BUILD/$DEFAULT" stash list --format=%H) && echo "stashes: ok"
git -C "$OLD" ls-files -z --others --ignored --exclude-standard | while IFS= read -r -d '' f; do cmp -s "$OLD/$f" "$HUB_BUILD/$DEFAULT/$f" || echo "ignored file differs or is missing: $f"; done
```

The first three print `ok`; the last prints nothing.

Then swap and re-trust (mise trust is bound to absolute paths; git links are relative and
survive):

```sh
mv "$OLD" "$OLD.pre-hub" && mv "$TMP" "$HUB"
cd "$HUB" && mise run hub:trust
```

## 8. Check and report

From `$HUB`: `mise exec -- wt list` shows `<default>` (and the recreated branch). Create and
remove a throwaway worktree to prove the hooks:

```sh
cd "$HUB" && mise run hub:add wt-hub/check && ls -A wt-hub-check && cat wt-hub-check/.mise.local.toml 2>/dev/null
cd "$HUB" && mise run hub:rm wt-hub/check
```

Tell the user:

- the hub path, and that sessions should start in `<hub>/<default>/` (or a branch worktree) so
  the hub `AGENTS.md` loads;
- for convert, that the old clone is at `$OLD.pre-hub` and is theirs to delete;
- if the repository (or a directory above the hub) has a `CLAUDE.md`, `.claude/CLAUDE.md` or
  `CLAUDE.local.md`: Claude Code then skips the hub `AGENTS.md`.
