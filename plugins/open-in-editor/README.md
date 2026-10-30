# open-in-editor

A Claude Code mod that shows the last three files Claude wrote or edited (Write, Edit or NotebookEdit) as rows above the
prompt box, newest first, each with buttons to copy its path or open it:

```
research-notes.md   /Users/me/tmp/band-test   Copy  Zed  VS Code  ×
```

- **Copy** puts the full path on the clipboard.
- **Zed** and **VS Code** open the file with `open -a`, so it works on macOS only and needs no editor CLI on `PATH`.
- **×** removes the row.
- The rows stay hidden until Claude writes a file, and while a survey question is up.
- Files Claude creates through Bash (`cat > file`) are not tracked.

## Install in Claude Code

```text
/plugin marketplace add berk-karaal/agent-plugins
/plugin install open-in-editor@berk-karaal
```
