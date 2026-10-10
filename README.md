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
