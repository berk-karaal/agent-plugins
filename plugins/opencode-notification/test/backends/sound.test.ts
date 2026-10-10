import { describe, expect, test } from "bun:test"
import type { RunProcessInput } from "../../src/backends/process"
import { createSoundBackend } from "../../src/backends/sound"
import type { Config } from "../../src/config/types"
import type { NotificationPayload } from "../../src/notifications/types"

const config: Config["sound"] = {
  enabled: true,
  on_finished: "/sounds/done file.wav",
  on_needs_input: "/sounds/input.wav",
  on_error: "",
}

const payload = (event: NotificationPayload["event"]): NotificationPayload => ({
  event,
  title: event === "finished" ? "OpenCode Finished" : event === "error" ? "OpenCode Error" : "OpenCode Needs Input",
  body: "body",
  hostname: "host",
  project: "project",
})

describe("sound backend", () => {
  test("uses afplay directly on macOS and falls error back to finished", async () => {
    const calls: RunProcessInput[] = []
    const backend = createSoundBackend(config, {
      platform: "darwin",
      which: async () => undefined,
      runProcess: async (input) => {
        calls.push(input)
      },
    })
    await backend.send(payload("error"), new AbortController().signal)
    expect(calls[0]).toMatchObject({ executable: "afplay", args: [config.on_finished], timeoutMs: 15000 })
  })

  test("prefers paplay then falls back to aplay on Linux", async () => {
    const calls: RunProcessInput[] = []
    const backend = createSoundBackend(config, {
      platform: "linux",
      which: async (name) => (name === "aplay" ? "/usr/bin/aplay" : undefined),
      runProcess: async (input) => {
        calls.push(input)
      },
    })
    await backend.send(payload("finished"), new AbortController().signal)
    expect(calls[0]?.executable).toBe("/usr/bin/aplay")
    expect(calls[0]?.args).toEqual([config.on_finished])
  })

  test("errors when Linux has no audio player", async () => {
    const backend = createSoundBackend(config, {
      platform: "linux",
      which: async () => undefined,
      runProcess: async () => undefined,
    })
    await expect(backend.send(payload("finished"), new AbortController().signal)).rejects.toThrow("audio player")
  })

  test("does nothing when the selected event has no file", async () => {
    let calls = 0
    const backend = createSoundBackend(
      { ...config, on_needs_input: "" },
      {
        platform: "darwin",
        which: async () => undefined,
        runProcess: async () => {
          calls += 1
        },
      },
    )
    await backend.send(payload("needs-input"), new AbortController().signal)
    expect(calls).toBe(0)
  })
})
