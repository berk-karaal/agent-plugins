import { describe, expect, test } from "bun:test"
import type { RunProcessInput } from "../../src/backends/process"
import { createSystemBackend } from "../../src/backends/system"
import type { NotificationPayload } from "../../src/notifications/types"

const payload: NotificationPayload = {
  event: "needs-input",
  title: "OpenCode Needs Input",
  body: "$(touch /tmp/bad); line1\nline2",
  hostname: "host",
  project: "project",
}

describe("system notification backend", () => {
  test("uses static AppleScript with positional values on macOS", async () => {
    const calls: RunProcessInput[] = []
    const backend = createSystemBackend({
      platform: "darwin",
      runProcess: async (input) => {
        calls.push(input)
      },
    })
    await backend.send(payload, new AbortController().signal)
    expect(calls[0]?.executable).toBe("osascript")
    expect(calls[0]?.args.at(-2)).toBe(payload.title)
    expect(calls[0]?.args.at(-1)).toBe(payload.body)
    expect(calls[0]?.args[0]).toBe("-e")
    expect(calls[0]?.timeoutMs).toBe(5000)
  })

  test("uses notify-send argument separation on Linux", async () => {
    const calls: RunProcessInput[] = []
    const backend = createSystemBackend({
      platform: "linux",
      runProcess: async (input) => {
        calls.push(input)
      },
    })
    await backend.send(payload, new AbortController().signal)
    expect(calls[0]).toMatchObject({
      executable: "notify-send",
      args: ["--", payload.title, payload.body],
      timeoutMs: 5000,
    })
  })

  test("rejects unsupported platforms", async () => {
    const backend = createSystemBackend({ platform: "win32", runProcess: async () => undefined })
    await expect(backend.send(payload, new AbortController().signal)).rejects.toThrow("unsupported platform")
  })
})
