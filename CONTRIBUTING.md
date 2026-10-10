# Contributing

## Adding a plugin

Create `plugins/<name>/`:

- **Claude Code:** add `.claude-plugin/plugin.json` (`name`, `description`, `author`; no `version`) and an entry in `.claude-plugin/marketplace.json`.
- **OpenCode V2:** add `package.json` (`private`, `"type": "module"`, `exports` → `./index.ts`, dependency `@opencode/plugin`) and an `index.ts` using `Plugin.define` that registers the plugin's `skills/*/SKILL.md` via `ctx.skill.transform`.
- Put shared skills in `skills/<skill>/SKILL.md`.

Run `npm run validate && npm run typecheck && npm test` before pushing.
