import type { Backend } from "../backends/backend.ts"
import type { Config } from "../config/types.ts"
import { buildPayload } from "./payload.ts"
import type { NotificationAction } from "./types.ts"

export interface DeliveryError {
  backend: string
  category: "load-failed" | "delivery-failed"
}

export interface DispatcherInput {
  hostname: () => string
  loadConfig: (projectRoot: string) => Promise<Config>
  createBackends: (config: Config) => readonly Backend[]
  onError?: (error: DeliveryError) => void
}

export interface Dispatcher {
  dispatch(action: NotificationAction, signal: AbortSignal): Promise<void>
}

function cancellation(error: unknown, signal: AbortSignal) {
  return signal.aborted || (error instanceof DOMException && error.name === "AbortError")
}

export function createDispatcher(input: DispatcherInput): Dispatcher {
  return {
    async dispatch(action, signal) {
      let config: Config
      try {
        config = await input.loadConfig(action.projectRoot)
      } catch {
        if (!signal.aborted) input.onError?.({ backend: "config", category: "load-failed" })
        return
      }
      if (signal.aborted) return
      const payload = buildPayload(action.event, action.projectRoot, input.hostname())
      const backends = input.createBackends(config)
      const results = await Promise.allSettled(backends.map((backend) => backend.send(payload, signal)))
      results.forEach((result, index) => {
        if (result.status !== "rejected" || cancellation(result.reason, signal)) return
        const backend = backends[index]
        if (backend) input.onError?.({ backend: backend.id, category: "delivery-failed" })
      })
    },
  }
}
