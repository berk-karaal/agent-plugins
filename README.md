# agent-plugins

Berk Karaal's plugins for [Claude Code](https://code.claude.com) and [OpenCode V2](https://opencode.ai/v2/docs/). Every plugin installs on its own.

| Plugin | What it does | Claude Code | OpenCode V2 |
|---|---|---|---|
| [task-tracker](plugins/task-tracker) | Local-only persistent task tracking via `.tasks/` docs | ✓ | ✓ |
| [notification](https://github.com/berk-karaal/claude-code-notification) | Notifications (ntfy, desktop, sound, scripts) when Claude finishes, fails or needs input. Hosted in its own repo | ✓ | – |
| [opencode-notification](plugins/opencode-notification) | Notifications (ntfy, desktop, sound, scripts) when OpenCode finishes, fails or needs input | – | ✓ |
| [wt-hub](plugins/wt-hub) | Clone or convert a repo into a Worktrunk-managed worktree hub (bare repo + one worktree per branch) | ✓ | ✓ |

## Claude Code

```text
/plugin marketplace add berk-karaal/agent-plugins
/plugin install <plugin>@berk-karaal
```

## OpenCode V2

Requires OpenCode V2 2.0.15 or newer (earlier versions can't install from a repo subdirectory).

```sh
opencode plugin add 'github:berk-karaal/agent-plugins#main::path:plugins/<plugin>'
```

## Just the skill files

```sh
npx skills add berk-karaal/agent-plugins
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).
