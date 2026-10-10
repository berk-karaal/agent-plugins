import { describe, expect, test } from "bun:test"
import { readFile } from "node:fs/promises"
import plugin from "../index"
import pkg from "../package.json"

describe("package contract", () => {
  test("exports an OpenCode V2 plugin definition", () => {
    expect(plugin.id).toBe("opencode-notification")
    expect(typeof plugin.setup).toBe("function")
  })

  test("is an unversioned private git package installed from agent-plugins", () => {
    expect(pkg.name).toBe("opencode-notification")
    expect("version" in pkg).toBe(false)
    expect("files" in pkg).toBe(false)
    expect(pkg.private).toBe(true)
    expect(pkg.type).toBe("module")
    expect(pkg.exports).toBe("./index.ts")
    expect(pkg.dependencies["@opencode/plugin"]).toBe("^2.0.15")
  })

  test("does not import undeclared transitive runtime packages", async () => {
    const source = await readFile(new URL("../src/skill/register.ts", import.meta.url), "utf8")
    expect(source).not.toContain("@opencode/schema")
  })
})
