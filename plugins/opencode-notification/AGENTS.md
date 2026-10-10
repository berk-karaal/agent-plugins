# opencode-notification

Native OpenCode V2 plugin that sends privacy-safe notifications when top-level sessions finish, fail, or need input.

## Architecture

- `src/events/` normalizes OpenCode events and owns session state.
- `src/config/` loads and validates global/project configuration.
- `src/notifications/` creates safe payloads and schedules delivery.
- `src/backends/` contains isolated ntfy, desktop, sound, and script backends.
- `src/plugin.ts` is the only module that coordinates OpenCode APIs.

Keep modules focused and dependencies injected at network, process, filesystem, hostname, and session boundaries.

## Privacy and safety

- Payloads may contain only normalized event type, fixed title, hostname, and project basename.
- Never include prompts, model output, tool data, paths, session IDs, permission details, form contents, or raw errors.
- Never execute through a shell. Pass executable and arguments separately.
- Never log ntfy topics, payload bodies, script environments, or response bodies.
- Backend failures must never interrupt OpenCode or suppress other backends.

## Development

```bash
bun install
bun run check
```

Use test-driven development for behavior changes. Tests must stub network/process boundaries and must never send a real notification.

## Release

No versions or release tags. This plugin lives in `berk-karaal/agent-plugins`, and every push to `main` is a release.
