import type { Backend } from "./backend.ts"
import { type RunProcessInput, runProcess } from "./process.ts"

const APPLE_SCRIPT = "on run argv\n  display notification (item 2 of argv) with title (item 1 of argv)\nend run"

export interface SystemDependencies {
  platform?: NodeJS.Platform
  runProcess?: (input: RunProcessInput) => Promise<void>
}

export function createSystemBackend(dependencies: SystemDependencies = {}): Backend {
  const platform = dependencies.platform ?? process.platform
  const run = dependencies.runProcess ?? runProcess
  return {
    id: "system-notification",
    async send(payload, signal) {
      if (platform === "darwin") {
        await run({
          executable: "osascript",
          args: ["-e", APPLE_SCRIPT, payload.title, payload.body],
          env: {},
          timeoutMs: 5000,
          signal,
        })
        return
      }
      if (platform === "linux") {
        await run({
          executable: "notify-send",
          args: ["--", payload.title, payload.body],
          env: {},
          timeoutMs: 5000,
          signal,
        })
        return
      }
      throw new Error("system notifications are unavailable on this unsupported platform")
    },
  }
}
