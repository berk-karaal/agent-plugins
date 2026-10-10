# Security Policy

## Supported versions

Security fixes are provided for the latest tagged release.

## Privacy contract

Notification payloads contain only:

- normalized event (`finished`, `needs-input`, or `error`);
- a fixed title;
- hostname;
- project directory basename.

The plugin does not place prompts, model output, tool I/O, paths, session IDs, permission details, form contents, provider errors, ntfy topics, or arbitrary environment values into payloads or logs.

## Command execution

Desktop notifications, sounds, and custom scripts execute with explicit executable and argument arrays. The plugin never invokes a shell or constructs command source from notification values. Custom-script paths must be absolute regular executable files.

## Secrets

Treat ntfy topics as bearer secrets. Store global configuration with user-only filesystem permissions and do not commit project configuration containing private topics. Backend errors redact topic, URL, response body, payload, and script environment values.

## Reporting a vulnerability

Use GitHub's private vulnerability reporting for this repository. Include affected version, platform, reproduction steps, and impact. Do not place real topics, credentials, prompts, or private project data in the report.
