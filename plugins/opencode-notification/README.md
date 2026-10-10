# opencode-notification

Native OpenCode V2 notifications for completed work, errors, and requests that need your input.

The plugin watches top-level sessions and can deliver through ntfy, native desktop notifications, sound, and custom scripts. Child/subagent sessions stay silent. Every backend is disabled until configured, so installing the package alone has no notification side effects.

## Features

- Completion notifications when a top-level session finishes.
- Error notifications without exposing provider or model error text.
- Attention notifications for permission requests and interactive forms/questions.
- Deduplication across current and compatibility OpenCode events.
- Global configuration with per-project overrides.
- A native `configuring-opencode-notification` skill.
- Linux and macOS support.

## Requirements

- OpenCode V2 2.0.15 or newer (earlier versions can't install from a repo subdirectory).
- Bun 1.4.0 or newer, used by OpenCode to load the package.
- Linux or macOS.
- Optional system programs for desktop and sound backends; see [configuration](docs/configuration.md).

## Install in OpenCode V2

```sh
opencode plugin add 'github:berk-karaal/agent-plugins#main::path:plugins/opencode-notification'
```

Restart the service after first installation:

```bash
opencode service restart
opencode plugin list
```

## Quick start

Run the `configuring-opencode-notification` skill inside OpenCode, or create the global config manually:

```json title="~/.config/opencode-notification/config.json"
{
  "$schema": "https://raw.githubusercontent.com/berk-karaal/agent-plugins/main/plugins/opencode-notification/schema/config.schema.json",
  "ntfy": {
    "enabled": true,
    "topic": "a-long-private-topic",
    "server": "https://ntfy.sh"
  }
}
```

Configuration changes are read at delivery time and do not require a restart. Project overrides live in `.opencode-notification.json` at the project root. See the [complete configuration reference](docs/configuration.md).

## Events

| Notification | OpenCode behavior |
|---|---|
| **OpenCode Finished** | An active top-level session becomes idle successfully |
| **OpenCode Needs Input** | A permission, form, or compatibility question is waiting |
| **OpenCode Error** | A top-level session execution fails |

Repeated compatibility events are deduplicated. A failure suppresses the following idle completion, and pending blockers prevent false completion notifications.

## Backends

### ntfy

Sends an HTTP POST to an ntfy server. Use a long, unguessable topic and treat it as a secret.

### System notifications

Uses `osascript` on macOS and `notify-send` on Linux. Commands receive values as direct arguments, never shell source.

### Sound

Uses `afplay` on macOS. Linux prefers `paplay` and falls back to `aplay`. Configure separate files for finished, needs-input, and error events.

### Custom scripts

Executes an absolute executable path directly without a shell. Scripts receive only the documented `OCN_*` variables.

## Privacy and security

Notifications contain only the normalized event, a fixed title, hostname, and project directory basename. They never include prompts, model output, tool I/O, file paths, session IDs, permission details, form contents, provider errors, or arbitrary environment values.

See [SECURITY.md](SECURITY.md) for the complete security contract and reporting instructions.

## Troubleshooting

Check that the package loaded:

```bash
opencode plugin list
```

OpenCode records plugin errors in:

```text
~/.local/share/opencode/log/opencode.log
```

Filter for `opencode-notification`. Logged errors identify only a backend and failure category; notification bodies, ntfy topics, response bodies, and script environments are redacted.

## Development

This plugin is a Bun project. From `plugins/opencode-notification/`:

```bash
bun install --frozen-lockfile
bun run check
```

`bun run check` runs Biome, the TypeScript check and the test suite. Tests stub every network and process boundary and never send a real notification. There are no versions or releases: every push to `main` is a release. See the repo's [CONTRIBUTING.md](../../CONTRIBUTING.md) for the shared checks.

## License

[MIT](LICENSE)
