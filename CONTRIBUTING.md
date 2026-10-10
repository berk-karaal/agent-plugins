# Contributing

This repo hosts plugins for **Claude Code** and **OpenCode V2**. Each plugin lives in its own
`plugins/<name>/` folder and installs on its own. A single folder can serve both clients:

- Claude Code reads it through the marketplace in `.claude-plugin/marketplace.json`.
- OpenCode V2 installs it as an npm-style package straight from the git subdirectory.

## Repository layout

```
agent-plugins/
├─ .claude-plugin/marketplace.json   # Claude Code marketplace "berk-karaal": one entry per plugin
├─ .github/workflows/ci.yml          # all checks on push, PR and weekly
├─ scripts/                          # repo checks for OpenCode plugins (load + install)
├─ package.json                      # private dev root: npm workspaces over plugins/*
├─ tsconfig.json                     # typechecks every plugins/*/index.ts (except Bun projects)
├─ LICENSE                           # MIT, covers every plugin unless the plugin says otherwise
└─ plugins/<name>/
   ├─ .claude-plugin/plugin.json     # Claude Code manifest
   ├─ skills/<skill>/SKILL.md        # skills, shared by both clients
   ├─ commands/  agents/  hooks/     # Claude Code components (optional)
   ├─ scripts/                       # helper scripts used by hooks/commands (optional)
   ├─ package.json                   # OpenCode V2 package manifest
   ├─ index.ts                       # OpenCode V2 entrypoint
   ├─ test/                          # plugin tests (optional)
   └─ README.md
```

The root `package.json` is for development only. Users never install it.

## Which client a plugin supports

The files a plugin folder contains decide which clients it supports. Nothing else needs configuring.

| Plugin kind | `.claude-plugin/plugin.json` + marketplace entry | `package.json` + `index.ts` |
|---|---|---|
| Both clients | ✓ | ✓ |
| Claude Code only | ✓ | – |
| OpenCode V2 only | – | ✓ |

Prefer **both** for plain skills. Make a plugin client-specific only when it relies on something one
client has and the other doesn't, such as Claude Code hooks or an OpenCode tool hook.

## Naming

- The plugin name is the folder name, in kebab-case: `plugins/git-helpers/`.
- That name appears in three places, which must all match:
  - the folder name
  - `plugin.json` → `name`
  - the marketplace entry `name`
- The OpenCode package name is `opencode-<name>`, or just `<name>` when the name already starts
  with `opencode-` (`opencode-notification`). The `Plugin.define` `id` is `<name>`.
- Claude Code reserves some plugin names, and `claude plugin validate` rejects them. A name must
  not start with `claude-`, `anthropic-`, `anthropics-` or `cc-plugin-`. It also must not be
  `claude`, `anthropic`, `anthropics`, `claude-code` or `claude-mods`, or pair `official` with
  `claude` or `anthropic`. Name a plugin for what it does.
- OpenCode commands are registered as `<name>:<command>`, one per `commands/<command>.md`,
  matching what Claude Code shows. `npm run validate` checks this.
- The skill folder name must equal the skill's `name` frontmatter: `skills/commit-message/SKILL.md` → `name: commit-message`.
- Claude Code namespaces plugin skills and commands, so `skills/commit-message` in plugin `git-helpers` runs as `/git-helpers:commit-message`.

## Adding a skill plugin (both clients)

This is the common case: one or more skills, no hooks. The steps use `git-helpers` with one
skill, `commit-message`.

### 1. Write the skill

`plugins/git-helpers/skills/commit-message/SKILL.md`:

```markdown
---
name: commit-message
description: Writes a Conventional Commits message for the staged diff. Use when the user asks for a commit message.
---

# Commit message

…instructions…
```

Frontmatter rules:

- Stick to the [Agent Skills](https://agentskills.io/specification) fields: `name`,
  `description`, `license`, `compatibility`, `metadata` and `allowed-tools`.
  - Claude Code-only extensions (`when_to_use`, `disable-model-invocation`, `argument-hint`, …)
    are fine as long as OpenCode can ignore them without breaking the skill.
- Keep `name` and `description` on **one line each**. The OpenCode loader below reads frontmatter
  line by line. YAML block scalars (`description: >`) are not supported. Quoting the value is fine.
- `description` is what the model uses to decide when to load the skill. Say what the skill does
  **and** when to use it. Maximum 1024 characters.

### 2. Add the Claude Code manifest

`plugins/git-helpers/.claude-plugin/plugin.json`:

```json
{
  "name": "git-helpers",
  "description": "Git helper skills: commit messages, …",
  "author": { "name": "Berk Karaal" }
}
```

Do **not** add a `version` (see [Versioning](#versioning-and-releases)).

Claude Code picks up `skills/`, `commands/`, `agents/` and `hooks/hooks.json` automatically from
the plugin root. Every path must stay inside the plugin folder: `../` is rejected, so a plugin
can't reuse files from a sibling plugin.

### 3. Register it in the marketplace

Add an entry to `.claude-plugin/marketplace.json`:

```json
{
  "name": "git-helpers",
  "source": "./plugins/git-helpers",
  "description": "Git helper skills: commit messages, …"
}
```

### 4. Add the OpenCode package

`plugins/git-helpers/package.json`:

```json
{
  "name": "opencode-git-helpers",
  "private": true,
  "type": "module",
  "exports": { ".": "./index.ts" },
  "dependencies": {
    "@opencode/plugin": "^2.0.15"
  }
}
```

- `private: true` prevents an accidental npm publish. Users install from git, not npm.
- Don't add a `files` field. A git subdirectory install must contain the whole folder,
  `skills/` included.
- Put every runtime dependency in **this** `package.json`. The root `package.json` and its
  hoisted dev dependencies are not part of the installed package.

### 5. Add the OpenCode entrypoint

`plugins/git-helpers/index.ts` registers every `skills/*/SKILL.md` with OpenCode. Copy it as is
and change only the `id`:

```ts
import { readdir, readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { Plugin, Skill } from "@opencode/plugin"

const skillsDir = new URL("./skills/", import.meta.url)

export function parseSkill(markdown: string) {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/)
  const fields: Record<string, string> = {}
  for (const line of (match?.[1] ?? "").split(/\r?\n/)) {
    const field = line.match(/^([\w-]+):\s*(.*)$/)
    if (field) fields[field[1]] = field[2].trim().replace(/^(["'])(.*)\1$/, "$2")
  }
  return { fields, body: markdown.slice(match?.[0].length ?? 0).trim() }
}

export default Plugin.define({
  id: "git-helpers",
  async setup(ctx) {
    const dirs = (await readdir(skillsDir, { withFileTypes: true })).filter((entry) => entry.isDirectory())
    const skills = await Promise.all(
      dirs.map(async ({ name }) => {
        const location = fileURLToPath(new URL(`${name}/SKILL.md`, skillsDir))
        const { fields, body } = parseSkill(await readFile(location, "utf8"))
        return Skill.Info.make({
          id: Skill.ID.make(name),
          name: Skill.Name.make(fields.name ?? name),
          description: fields.description ?? "",
          path: location as typeof ctx.location.directory,
          content: body,
        })
      }),
    )
    await ctx.skill.transform((editor) => {
      for (const skill of skills) editor.add(skill)
    })
  },
})
```

Every skill-only plugin carries its own copy of this loader. That is deliberate: a shared package
inside this repo isn't known to resolve when OpenCode installs a single subdirectory from git.

### 6. Document it

- Create `plugins/git-helpers/README.md` with what the plugin does, plus the install commands:

  ````markdown
  ## Install in Claude Code

  ```text
  /plugin marketplace add berk-karaal/agent-plugins
  /plugin install git-helpers@berk-karaal
  ```

  ## Install in OpenCode V2

  Requires OpenCode V2 2.0.15 or newer (earlier versions can't install from a repo subdirectory).

  ```sh
  opencode plugin add 'github:berk-karaal/agent-plugins#main::path:plugins/git-helpers'
  ```
  ````

- Add a row to the plugin table in the root `README.md`.

### 7. Install dependencies and run the checks

```sh
npm install          # registers the new workspace and updates package-lock.json
npm run validate
npm run typecheck
npm test
```

Then test it in both clients (see [Testing locally](#testing-locally)) and commit, including
`package-lock.json`. After committing, run `npm run check:install`. It installs from the
commit, not the working tree.

## Claude Code-only plugins

Leave out `package.json` and `index.ts`, and add only the marketplace entry. Components you can
ship:

| Component | Location |
|---|---|
| Skills | `skills/<skill>/SKILL.md` |
| Slash commands | `commands/<command>.md` |
| Subagents | `agents/<agent>.md` |
| Hooks | `hooks/hooks.json` |
| MCP servers | `.mcp.json` |

In hooks and MCP configs, refer to the plugin's own files through `${CLAUDE_PLUGIN_ROOT}`. For
example:

```json
{ "type": "command", "command": "\"${CLAUDE_PLUGIN_ROOT}/scripts/sync.sh\"" }
```

`${CLAUDE_PLUGIN_ROOT}` changes on every update, so never write state there. Use
`${CLAUDE_PLUGIN_DATA}` for anything that must survive an update.

Mark scripts executable (`chmod +x`) before committing. Git keeps the mode.

Reference: the [plugins reference](https://code.claude.com/docs/en/plugins/manifest-reference).

## OpenCode V2-only plugins

Leave out `.claude-plugin/` and don't add a marketplace entry. Besides
`ctx.skill.transform`, the `setup(ctx)` function can use:

- `ctx.command.transform(editor => editor.add({ name, description, execute }))` for slash commands
- `ctx.tool.transform(...)` for custom tools
- `ctx.tool.hook("execute.before" | "execute.after", ...)` for tool hooks
- `ctx.session.hook(...)` for session hooks

Reference: [OpenCode V2 plugin docs](https://opencode.ai/v2/docs/build/plugins).

## Plugins with commands and hooks for both clients

Write the Claude Code components (`commands/`, `hooks/hooks.json`), then have `index.ts`
register the same behaviour for OpenCode from the same files. `plugins/task-tracker/index.ts` is
the reference:

- It reads each `commands/*.md`, strips the frontmatter, and registers it with
  `ctx.command.transform`. It substitutes `$ARGUMENTS` the way Claude Code does.
- It mirrors the Claude Code `PostToolUse` hook with `ctx.tool.hook("execute.after", ...)`, which
  calls the same script under `scripts/`.

Keep the Markdown files the single source of truth, so the two clients never drift.

## Bun-based OpenCode plugins

A plugin can be its own Bun project, with its own `bun.lock`, `tsconfig.json`, test runner and
linter. `plugins/opencode-notification/` is one. That suits plugins with a real code base, and
OpenCode loads plugins with Bun anyway. Such a plugin:

- keeps its own `check` script (for example `biome check . && tsc --noEmit && bun test`);
- is excluded from the npm workspaces in the root `package.json`
  (`"!plugins/<name>"` in `workspaces`), so npm never installs its dependencies;
- is excluded from the root `tsconfig.json` (`exclude`), because it typechecks itself;
- gets a step in `.github/workflows/ci.yml` that runs `bun run check` in its folder
  (`working-directory: plugins/<name>`). Its dependencies come from the root `postinstall`.

The root `postinstall` runs `bun install --frozen-lockfile` in every plugin that has a `bun.lock`,
so `npm install` at the root sets everything up.

Add the workspace exclusion **before** running `bun install` in the plugin. Otherwise Bun treats
the repo root as the workspace root and writes a `bun.lock` there.

Bun projects may use TypeScript syntax that plain Node can't strip, such as constructor parameter
properties. That's fine: the load check runs under Bun.

## Plugins hosted in another repo

A plugin that has its own release pipeline, such as a compiled binary with versioned GitHub
Releases, can stay in its own repo and still be listed in this marketplace. Use a `git-subdir`
source:

```json
{
  "name": "notification",
  "source": { "source": "git-subdir", "url": "berk-karaal/claude-code-notification", "path": "plugin" },
  "description": "…"
}
```

- Claude Code clones only that subdirectory at install time, and the plugin's own `plugin.json`
  `version` decides when users get updates.
- `npm run validate` checks the marketplace entry but doesn't fetch the external plugin, so test
  changes in that repo itself.
- The entry's `name` may differ from the external `plugin.json` name. Users install
  `<entry name>@berk-karaal`. That's how `claude-code-notification`, a name Claude Code now
  reserves, is listed as `notification`. Skills and commands keep the namespace from the plugin's
  own `plugin.json`, so its skill still runs as `/claude-code-notification:configure`.
- Add a README row that links the external repo.

## Testing locally

### Repo checks

| Command | What it checks |
|---|---|
| `npm run validate` | `claude plugin validate` on the marketplace and every Claude Code plugin, then the OpenCode load check |
| `npm run typecheck` | `tsc --noEmit` over every `plugins/*/index.ts`, except Bun projects |
| `npm test` | each npm-workspace plugin's own `test` script, if it has one |
| `npm run check:install` | the OpenCode install check (needs the `opencode` CLI, tests `HEAD`) |
| `bun run check` in a Bun plugin's folder | that plugin's own lint, typecheck and tests |

You need Node 24, [Bun](https://bun.sh), `jq`, and the Claude Code CLI. The install check also
needs the OpenCode CLI.

`validate` always prints `No version specified` warnings. That is expected (see
[Versioning](#versioning-and-releases)). The repo deliberately doesn't run validation with
`--strict`.

OpenCode has no validator of its own, so this repo has two checks for OpenCode plugins (every
`plugins/*/` with a `package.json`):

- **Load check** (`scripts/check-opencode.mjs`, part of `validate`) runs under Bun, the runtime
  OpenCode itself uses. It imports each `index.ts` and runs `setup()` against a stand-in `ctx`
  that records what gets registered.
  - The stand-in provides `location` (`directory`, `project.canonical`) and an `event.subscribe`
    stream that stays open until it's cancelled. Every other domain method is a harmless no-op.
  - It fails when:
    - the default export isn't `Plugin.define({ id, setup })`, or `setup()` throws;
    - the cleanup function returned by `setup()` throws, or doesn't finish within 5 seconds (for
      example, an event subscription that's never cancelled);
    - the registered skills don't match the `skills/*/SKILL.md` folders, a skill's `path` doesn't
      exist, or its content or description is empty;
    - the registered commands don't match `commands/*.md` as `<id>:<command>`;
    - any runtime source file (everything outside `test/` and `node_modules/`) imports a package
      that the plugin's own `package.json` doesn't list under `dependencies`. The repo root's
      hoisted `node_modules` would otherwise hide this until a user installs.

  It needs no model and no API key, and it gives the same result on every run. It can't see
  runtime behaviour such as what a command does or whether a hook fires. Cover that with plugin
  tests.
- **Install check** (`scripts/check-opencode-install.sh`) runs, for each plugin,
  `opencode plugin add 'git+file://<repo>#<HEAD sha>::path:plugins/<name>'`. That is the same
  subdirectory install users run, but into a throwaway OpenCode home, so your own config is never
  touched. It then fails unless:
  - the installed files equal the committed plugin folder, which catches a `files` field or
    anything else that strips the package;
  - every dependency is installed.

  It tests the last commit, not uncommitted changes.

### Plugin tests

Plugins with logic beyond the standard loader should ship tests. Add a `test` script to the
plugin's `package.json` and put the tests in `test/`:

```json
"scripts": {
  "test": "node --test test/*.test.mjs"
}
```

- Tests run with Node 24's built-in TypeScript type stripping, so `node --test` can import
  `../index.ts` directly. Use only erasable TypeScript syntax in `index.ts`: no `enum`, no
  `namespace`, no constructor parameter properties.
- Tests run with the plugin folder as the working directory. Resolve paths from the test
  file's location, not from the current directory.
- `plugins/task-tracker/test/` is the reference.

### In Claude Code

Load the plugin straight from the working tree, without installing it:

```sh
claude --plugin-dir plugins/<name>
```

Check that the skills and commands appear as `/<name>:...`. For a quick non-interactive check:

```sh
claude --plugin-dir plugins/<name> -p "…a prompt that should trigger the skill…"
```

### In OpenCode V2

Point a throwaway project at the plugin folder. Use the absolute path, because relative paths
resolve from the config file:

```sh
mkdir -p /tmp/oc-try && cd /tmp/oc-try && git init -q
cat > opencode.jsonc <<EOF
{ "plugins": ["$HOME/path/to/agent-plugins/plugins/<name>"] }
EOF
opencode --standalone
```

- `--standalone` starts a private server. Without it, OpenCode talks to the background service,
  which keeps the plugins it loaded when it started. Restart that service with
  `opencode service restart`.
- For a non-interactive check:

  ```sh
  opencode run --standalone -m <provider/model> "…prompt that triggers the skill…"
  ```

  The output shows `→ Skill "<skill>"` when the skill loads.

### The real install path

After pushing, check the published install at least once for a new plugin:

```sh
opencode plugin add 'github:berk-karaal/agent-plugins#main::path:plugins/<name>'
claude plugin marketplace update berk-karaal && claude plugin install <name>@berk-karaal
```

## Versioning and releases

There are no versions and no release step. **Every push to `main` is a release.**

- Claude Code derives the plugin version from the git commit. Users get changes with
  `claude plugin marketplace update berk-karaal`, then `claude plugin update <name>@berk-karaal`,
  or the same steps through `/plugin`. Auto-update is off by default for third-party
  marketplaces.
- OpenCode records the installed commit. Users get changes with `opencode plugin update`.

So keep `main` working: run the checks before pushing, and let CI confirm.

Don't add `version` to `plugin.json`, `package.json` or marketplace entries. With a pinned
version, Claude Code stops delivering new commits until someone bumps it.

## CI

`.github/workflows/ci.yml` runs on every push to `main`, on every pull request, and **weekly**, on
Mondays at 06:00 UTC. It has a single job on `ubuntu-slim`:

1. sets up Node 24 and the latest Bun, then runs `npm ci`. Its `postinstall` also installs the
   Bun plugins.
2. installs the **latest** Claude Code and OpenCode CLIs, and prints all tool versions.
3. runs `npm run validate`, `npm run typecheck`, `npm test`, each Bun plugin's `bun run check`,
   and `npm run check:install`.

There's no macOS runner. The plugins' tests pass the platform in as an input and stub every
OS command, so the macOS code paths are already exercised on Linux, and a real `osascript` or
`afplay` never runs in CI anyway.

The CLIs aren't pinned on purpose. Users run the latest versions, so CI does too. The weekly
run catches a new CLI release that breaks a plugin even when nothing was pushed. If a run fails
with no repo change, compare the printed CLI versions with the last green run.

The smoke tests need `jq`. `ubuntu-slim` ships it, and locally the tests exit with `jq required`
if it's missing.

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org), with the plugin name as the scope
when a change touches one plugin:

```
feat(git-helpers): add commit-message skill
fix(task-tracker): resolve linked task paths
docs: update install instructions
ci: run checks weekly
```

## Gotchas

- **OpenCode V2 older than 2.0.15** can't install from a repo subdirectory (`::path:`).
- **No `../` in Claude Code plugins.** Everything a plugin uses must live inside its folder.
- **No `files` in a plugin's `package.json`.** It would strip skills and scripts from the
  OpenCode install. `npm run check:install` catches it.
- **The OpenCode background service caches plugins.** After changing a plugin, restart the
  service or test with `--standalone`.
- **Claude Code-only folders** (no `package.json`) are fine inside the npm workspaces glob.
  npm skips them.
- **Reserved plugin names** (`claude-*` and others, see [Naming](#naming)) fail
  `claude plugin validate`, even though installs still succeed today.
- **Running `bun install` inside a plugin that isn't excluded from the npm workspaces** makes
  Bun write a `bun.lock` at the repo root. Exclude the plugin first.
