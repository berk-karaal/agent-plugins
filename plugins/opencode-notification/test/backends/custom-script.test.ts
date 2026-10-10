import { describe, expect, test } from "bun:test"
import { createCustomScriptBackend } from "../../src/backends/custom-script"
import type { RunProcessInput } from "../../src/backends/process"
import type { Config } from "../../src/config/types"
import type { NotificationPayload } from "../../src/notifications/types"

const config: Config["custom_script"] = {
  enabled: true,
  on_finished: "/scripts/finished.sh",
  on_needs_input: "/scripts/input.sh",
  on_error: "",
}

const payload: NotificationPayload = {
  event: "error",
  title: "OpenCode Error",
  body: "[host] Project: project",
  hostname: "host",
  project: "project",
}

describe("custom script backend", () => {
  test("runs the selected executable with only safe OCN values", async () => {
    const calls: RunProcessInput[] = []
    const backend = createCustomScriptBackend(config, {
      stat: async () => ({ isFile: () => true, mode: 0o100755 }),
      runProcess: async (input) => {
        calls.push(input)
      },
    })
    await backend.send(payload, new AbortController().signal)
    expect(calls[0]).toMatchObject({ executable: config.on_finished, args: [], timeoutMs: 15000 })
    expect(calls[0]?.env).toEqual({
      OCN_EVENT: payload.event,
      OCN_TITLE: payload.title,
      OCN_BODY: payload.body,
      OCN_HOSTNAME: payload.hostname,
      OCN_PROJECT: payload.project,
    })
    expect(JSON.stringify(calls[0]?.env)).not.toContain("PRIVATE_PROMPT_SENTINEL")
    expect(JSON.stringify(calls[0]?.env)).not.toContain("sessionID")
  })

  test("rejects relative, non-file, and non-executable scripts", async () => {
    expect(() => createCustomScriptBackend({ ...config, on_finished: "relative.sh" })).toThrow("absolute")
    const nonFile = createCustomScriptBackend(config, {
      stat: async () => ({ isFile: () => false, mode: 0o100755 }),
      runProcess: async () => undefined,
    })
    await expect(
      nonFile.send({ ...payload, event: "finished", title: "OpenCode Finished" }, new AbortController().signal),
    ).rejects.toThrow("regular file")
    const nonExecutable = createCustomScriptBackend(config, {
      stat: async () => ({ isFile: () => true, mode: 0o100644 }),
      runProcess: async () => undefined,
    })
    await expect(
      nonExecutable.send({ ...payload, event: "finished", title: "OpenCode Finished" }, new AbortController().signal),
    ).rejects.toThrow("executable")
  })

  test("does nothing when the selected event has no script", async () => {
    let calls = 0
    const backend = createCustomScriptBackend(
      { ...config, on_needs_input: "" },
      {
        stat: async () => ({ isFile: () => true, mode: 0o100755 }),
        runProcess: async () => {
          calls += 1
        },
      },
    )
    await backend.send(
      { ...payload, event: "needs-input", title: "OpenCode Needs Input" },
      new AbortController().signal,
    )
    expect(calls).toBe(0)
  })
})
