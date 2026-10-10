# agent-plugins

Berk Karaal's plugins for [Claude Code](https://code.claude.com) and [OpenCode V2](https://opencode.ai/v2/docs/). Every plugin installs on its own.

| Plugin | What it does | Claude Code | OpenCode V2 |
|---|---|---|---|
| [task-tracker](plugins/task-tracker) | Local-only persistent task tracking via `.tasks/` docs | ✓ | ✓ |

## Claude Code

```text
/plugin marketplace add berk-karaal/agent-plugins
/plugin install <plugin>@berk-karaal
```

## OpenCode V2

```sh
opencode plugin add 'github:berk-karaal/agent-plugins#main::path:plugins/<plugin>'
```

## Just the skill files

```sh
npx skills add berk-karaal/agent-plugins
```

## Adding a plugin

Create `plugins/<name>/`:

- **Claude Code:** add `.claude-plugin/plugin.json` (`name`, `description`, `author`; no `version`) and an entry in `.claude-plugin/marketplace.json`.
- **OpenCode V2:** add `package.json` (`private`, `"type": "module"`, `exports` → `./index.ts`, dependency `@opencode/plugin`) and an `index.ts` using `Plugin.define` that registers the plugin's `skills/*/SKILL.md` via `ctx.skill.transform`.
- Put shared skills in `skills/<skill>/SKILL.md`.

Run `npm run validate && npm run typecheck && npm test` before pushing.
