# open-in-editor

A Claude Code mod that lists the files Claude wrote or edited (Write, Edit or NotebookEdit) as rows above the prompt
box, newest first, with buttons to copy each path or open it. A header switches between two lists:

```
[ Docs ] Code
report.md      /Users/me/tmp       Copy  Zed  VS Code  ×
index.html     /Users/me/out       Copy  Open  ×
```

- **Docs** (shown by default): the last 3 `.md .mdx .markdown .txt .rst .adoc .org .html .htm .pdf .csv` files.
- **Code**: the last 5 of every other file.
- **Copy** puts the full path on the clipboard.
- **Zed** and **VS Code** open the file. On macOS they use `open -a`, so no editor CLI is needed on `PATH`. On Linux
  they run the editor's CLI: `zed` (or `zeditor`, its name on some distros) and `code`.
- **Open** replaces the editor buttons on `.html`, `.htm` and `.pdf` files and opens them in the system's default app
  (`open` on macOS, `xdg-open` on Linux).
- **×** removes the row.
- The band stays hidden until Claude writes a file, and while a survey question is up.
- Files Claude changes through Bash (`sed -i`, formatters, scripts) are not tracked.

## Install in Claude Code

```text
/plugin marketplace add berk-karaal/agent-plugins
/plugin install open-in-editor@berk-karaal
```
