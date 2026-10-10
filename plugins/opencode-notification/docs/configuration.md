# Configuration

`opencode-notification` merges three layers:

1. Disabled built-in defaults.
2. `~/.config/opencode-notification/config.json`.
3. `<project-root>/.opencode-notification.json`.

Objects merge by known field. A project can disable a globally enabled backend without repeating its other settings:

```json title="~/.config/opencode-notification/config.json"
{
  "ntfy": {
    "enabled": true,
    "topic": "a-long-private-topic",
    "server": "https://ntfy.sh"
  }
}
```

```json title=".opencode-notification.json"
{
  "ntfy": {
    "enabled": false
  }
}
```

## Schema

Add the published schema for editor validation:

```json
{
  "$schema": "https://raw.githubusercontent.com/berk-karaal/agent-plugins/main/plugins/opencode-notification/schema/config.schema.json"
}
```

The runtime validates the same contract strictly. Unknown fields, incorrect types, non-HTTP(S) ntfy servers, enabled ntfy without a topic, and relative custom-script paths are errors. If an existing layer is invalid, that notification is skipped; the plugin does not silently fall back to lower-precedence credentials.

## Complete example

```json
{
  "$schema": "https://raw.githubusercontent.com/berk-karaal/agent-plugins/main/plugins/opencode-notification/schema/config.schema.json",
  "system_notification": {
    "enabled": true
  },
  "ntfy": {
    "enabled": true,
    "topic": "a-long-private-topic",
    "server": "https://ntfy.sh"
  },
  "sound": {
    "enabled": true,
    "on_finished": "/home/user/sounds/done.wav",
    "on_needs_input": "/home/user/sounds/input.wav",
    "on_error": "/home/user/sounds/error.wav"
  },
  "custom_script": {
    "enabled": true,
    "on_finished": "/home/user/bin/opencode-finished",
    "on_needs_input": "/home/user/bin/opencode-input",
    "on_error": "/home/user/bin/opencode-error"
  }
}
```

All backends default to `enabled: false`.

## ntfy

| Field | Type | Default | Meaning |
|---|---|---|---|
| `enabled` | boolean | `false` | Enables ntfy delivery |
| `topic` | string | empty | Private topic; required when enabled |
| `server` | HTTP(S) URL | `https://ntfy.sh` | Hosted or self-managed server |

The topic is URL-encoded as one path segment. Request failures are redacted from logs.

## System notification

`system_notification.enabled` enables `osascript` on macOS or `notify-send` on Linux. No shell is used. The backend fails independently when the platform command is unavailable.

## Sound

| Field | Meaning |
|---|---|
| `on_finished` | Audio file after successful completion |
| `on_needs_input` | Audio file for permissions and forms |
| `on_error` | Audio file after failure; falls back to `on_finished` when empty |

macOS uses `afplay`. Linux prefers `paplay`, then `aplay`. An empty selected event path is a no-op.

## Custom script

Custom-script paths must be absolute regular executable files. The selected script runs directly without a shell. `on_error` falls back to `on_finished` when empty.

The child receives the inherited process environment plus these safe event values:

| Variable | Meaning |
|---|---|
| `OCN_EVENT` | `finished`, `needs-input`, or `error` |
| `OCN_TITLE` | Fixed OpenCode notification title |
| `OCN_BODY` | Hostname and project basename |
| `OCN_HOSTNAME` | Machine hostname |
| `OCN_PROJECT` | Project directory basename |

No prompt, tool, session, permission, form, file-path, or provider-error data is added.
