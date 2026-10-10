import { describe, expect, test } from "bun:test"
import { readFile } from "node:fs/promises"
import { buildPayload } from "../src/notifications/payload"

describe("safe notification payload", () => {
  test.each([
    ["finished", "OpenCode Finished"],
    ["needs-input", "OpenCode Needs Input"],
    ["error", "OpenCode Error"],
  ] as const)("builds an exact %s payload", (event, title) => {
    expect(buildPayload(event, "/workspace/project with spaces", "server-1")).toEqual({
      event,
      title,
      body: "[server-1] Project: project with spaces",
      hostname: "server-1",
      project: "project with spaces",
    })
  })

  test("payload module defines no unsafe object fields", async () => {
    const source = await readFile(new URL("../src/notifications/payload.ts", import.meta.url), "utf8")
    expect(source).not.toMatch(/\b(prompt|tool|sessionID|path|permission|form|errorMessage)\s*:/)
  })
})
