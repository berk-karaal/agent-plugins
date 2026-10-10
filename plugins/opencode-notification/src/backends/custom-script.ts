import { stat as nodeStat } from "node:fs/promises"
import { isAbsolute } from "node:path"
import type { Config, NotificationEvent } from "../config/types.ts"
import type { Backend } from "./backend.ts"
import { type RunProcessInput, runProcess } from "./process.ts"

interface StatLike {
  isFile(): boolean
  mode: number
}

export interface CustomScriptDependencies {
  stat?: (path: string) => Promise<StatLike>
  runProcess?: (input: RunProcessInput) => Promise<void>
}

function selectedScript(config: Config["custom_script"], event: NotificationEvent) {
  if (event === "finished") return config.on_finished
  if (event === "needs-input") return config.on_needs_input
  return config.on_error || config.on_finished
}

export function createCustomScriptBackend(
  config: Config["custom_script"],
  dependencies: CustomScriptDependencies = {},
): Backend {
  for (const script of [config.on_finished, config.on_needs_input, config.on_error]) {
    if (script && !isAbsolute(script)) throw new Error("custom script paths must be absolute")
  }
  const stat = dependencies.stat ?? nodeStat
  const run = dependencies.runProcess ?? runProcess
  return {
    id: "custom-script",
    async send(payload, signal) {
      const script = selectedScript(config, payload.event)
      if (!script) return
      const info = await stat(script)
      if (!info.isFile()) throw new Error("custom script must be a regular file")
      if ((info.mode & 0o111) === 0) throw new Error("custom script must be executable")
      await run({
        executable: script,
        args: [],
        env: {
          OCN_EVENT: payload.event,
          OCN_TITLE: payload.title,
          OCN_BODY: payload.body,
          OCN_HOSTNAME: payload.hostname,
          OCN_PROJECT: payload.project,
        },
        timeoutMs: 15_000,
        signal,
      })
    },
  }
}
