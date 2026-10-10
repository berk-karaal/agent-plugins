import type { Config } from "../config/types.ts"
import type { Backend } from "./backend.ts"

export interface NtfyDependencies {
  fetch?: (input: string | URL | Request, init?: RequestInit) => Promise<Response>
  timeoutMs?: number
}

export function createNtfyBackend(config: Config["ntfy"], dependencies: NtfyDependencies = {}): Backend {
  let server: URL
  try {
    server = new URL(config.server)
  } catch {
    throw new Error("ntfy server must be an HTTP or HTTPS URL")
  }
  if (server.protocol !== "http:" && server.protocol !== "https:") {
    throw new Error("ntfy server must be an HTTP or HTTPS URL")
  }
  const fetcher = dependencies.fetch ?? fetch
  const timeoutMs = dependencies.timeoutMs ?? 10_000

  return {
    id: "ntfy",
    async send(payload, signal) {
      signal.throwIfAborted()
      const controller = new AbortController()
      let timedOut = false
      const timeout = setTimeout(() => {
        timedOut = true
        controller.abort()
      }, timeoutMs)
      const onAbort = () => controller.abort()
      signal.addEventListener("abort", onAbort, { once: true })
      const url = `${server.toString().replace(/\/$/, "")}/${encodeURIComponent(config.topic)}`
      try {
        const response = await fetcher(url, {
          method: "POST",
          headers: { Title: payload.title },
          body: payload.body,
          signal: controller.signal,
        })
        if (!response.ok) throw new Error(`ntfy request failed with status ${response.status}`)
      } catch (error) {
        if (timedOut) throw new Error("ntfy request timed out")
        if (signal.aborted) throw new Error("ntfy request aborted")
        throw error
      } finally {
        clearTimeout(timeout)
        signal.removeEventListener("abort", onAbort)
      }
    },
  }
}
