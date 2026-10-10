import type { Config, NotificationEvent } from "../config/types.ts"
import type { Backend } from "./backend.ts"
import { type RunProcessInput, runProcess } from "./process.ts"

export interface SoundDependencies {
  platform?: NodeJS.Platform
  which?: (name: string) => Promise<string | undefined>
  runProcess?: (input: RunProcessInput) => Promise<void>
}

function selectedFile(config: Config["sound"], event: NotificationEvent) {
  if (event === "finished") return config.on_finished
  if (event === "needs-input") return config.on_needs_input
  return config.on_error || config.on_finished
}

async function defaultWhich(name: string) {
  return Bun.which(name) ?? undefined
}

export function createSoundBackend(config: Config["sound"], dependencies: SoundDependencies = {}): Backend {
  const platform = dependencies.platform ?? process.platform
  const which = dependencies.which ?? defaultWhich
  const run = dependencies.runProcess ?? runProcess
  return {
    id: "sound",
    async send(payload, signal) {
      const file = selectedFile(config, payload.event)
      if (!file) return
      let executable: string
      if (platform === "darwin") executable = "afplay"
      else if (platform === "linux") {
        executable = (await which("paplay")) ?? (await which("aplay")) ?? ""
        if (!executable) throw new Error("no supported Linux audio player is available")
      } else throw new Error("sound notifications are unavailable on this unsupported platform")
      await run({ executable, args: [file], env: {}, timeoutMs: 15_000, signal })
    },
  }
}
