import { describe, expect, test } from "bun:test"
import { readFile } from "node:fs/promises"

const read = (path: string) => readFile(new URL(`../${path}`, import.meta.url), "utf8")
const schemaUrl =
  "https://raw.githubusercontent.com/berk-karaal/agent-plugins/main/plugins/opencode-notification/schema/config.schema.json"

describe("documentation contracts", () => {
  test("README covers installation, behavior, privacy, and support", async () => {
    const source = await read("README.md")
    for (const text of [
      "opencode plugin add 'github:berk-karaal/agent-plugins#main::path:plugins/opencode-notification'",
      "OpenCode V2 2.0.15 or newer",
      "opencode service restart",
      "~/.config/opencode-notification/config.json",
      ".opencode-notification.json",
      schemaUrl,
      "disabled until configured",
      "ntfy",
      "System notifications",
      "Sound",
      "Custom scripts",
      "permission",
      "form",
      "top-level sessions",
      "Linux and macOS",
      "~/.local/share/opencode/log/opencode.log",
      "docs/configuration.md",
      "SECURITY.md",
      "bun run check",
    ]) {
      expect(source).toContain(text)
    }
    expect(source).not.toContain("berk-karaal/opencode-notification")
    expect(source).toContain("never include prompts")
  })

  test("configuration reference points at the agent-plugins schema", async () => {
    const source = await read("docs/configuration.md")
    expect(source).toContain(schemaUrl)
    expect(source).not.toContain("berk-karaal/opencode-notification")
  })

  test("repo CI installs the plugin with its lockfile and runs the complete check", async () => {
    const workflow = await read("../../.github/workflows/ci.yml")
    const rootPackage = JSON.parse(await read("../../package.json"))
    expect(workflow).toContain("oven-sh/setup-bun@v2")
    expect(workflow).toContain("npm ci")
    expect(rootPackage.scripts.postinstall).toContain("bun install --frozen-lockfile")
    expect(workflow).toContain("working-directory: plugins/opencode-notification")
    expect(workflow).toContain("run: bun run check")
    expect(workflow).not.toContain("macos-latest")
    expect(workflow).not.toContain("bun-version")
  })
})
