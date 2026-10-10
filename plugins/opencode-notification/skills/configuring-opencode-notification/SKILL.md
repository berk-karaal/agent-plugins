---
name: configuring-opencode-notification
description: Use when configuring OpenCode notifications, enabling or disabling notification backends, changing ntfy settings, or setting event-specific sounds and scripts.
---

# Configuring OpenCode Notification

## Configuration files

The plugin merges these files in order:

1. `~/.config/opencode-notification/config.json`
2. `<project-root>/.opencode-notification.json`

Project fields override matching global fields. Omitted fields inherit. All backends are disabled until explicitly enabled.

Use the schema at `schema/config.schema.json`. Preserve unrelated existing fields when editing a config file.

## Backends

- **ntfy:** requires `enabled`, a private `topic`, and an HTTP(S) `server`.
- **system notification:** uses `system_notification.enabled` and the native Linux or macOS notification command.
- **sound:** accepts `on_finished`, `on_needs_input`, and `on_error` audio paths.
- **custom script:** accepts absolute executable paths for the same three events.

The error sound or script falls back to the finished value when `on_error` is empty.

## Safety

Treat the ntfy topic as a secret. Do not print an existing topic unless the user explicitly asks. Generate long, random topics rather than names derived from users, hosts, or projects.

Custom scripts receive only `OCN_EVENT`, `OCN_TITLE`, `OCN_BODY`, `OCN_HOSTNAME`, and `OCN_PROJECT`. Verify configured scripts are absolute regular executable files.

## Workflow

1. Ask which backend and scope the user wants when it is not clear.
2. Read the existing target file before editing.
3. Apply the smallest field-level change and keep valid JSON.
4. Validate the result against `schema/config.schema.json`.
5. Explain the effective configuration without revealing secrets.
6. Get approval before sending a test notification because it creates an external side effect.
