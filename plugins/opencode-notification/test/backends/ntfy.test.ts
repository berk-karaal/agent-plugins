import { describe, expect, test } from "bun:test"
import { createNtfyBackend } from "../../src/backends/ntfy"
import type { NotificationPayload } from "../../src/notifications/types"

const payload: NotificationPayload = {
  event: "finished",
  title: "OpenCode Finished",
  body: "[host] Project: project",
  hostname: "host",
  project: "project",
}

describe("ntfy backend", () => {
  test("posts a safe payload to an encoded topic", async () => {
    const calls: Array<[string | URL | Request, RequestInit | undefined]> = []
    const backend = createNtfyBackend(
      { enabled: true, topic: "private/topic", server: "https://ntfy.example/" },
      {
        fetch: async (url, init) => {
          calls.push([url, init])
          return new Response(null, { status: 204 })
        },
      },
    )
    await backend.send(payload, new AbortController().signal)
    expect(String(calls[0]?.[0])).toBe("https://ntfy.example/private%2Ftopic")
    expect(calls[0]?.[1]).toMatchObject({ method: "POST", body: payload.body, headers: { Title: payload.title } })
  })

  test("rejects unsupported server protocols", () => {
    expect(() => createNtfyBackend({ enabled: true, topic: "topic", server: "file:///tmp/ntfy" })).toThrow(
      "HTTP or HTTPS",
    )
  })

  test("redacts URL, topic, response, and payload on HTTP failure", async () => {
    const backend = createNtfyBackend(
      { enabled: true, topic: "private-topic", server: "https://ntfy.example" },
      { fetch: async () => new Response("private response", { status: 500 }) },
    )
    try {
      await backend.send(payload, new AbortController().signal)
      throw new Error("expected send to fail")
    } catch (error) {
      const message = String(error)
      expect(message).toContain("status 500")
      expect(message).not.toContain("private-topic")
      expect(message).not.toContain("ntfy.example")
      expect(message).not.toContain("private response")
      expect(message).not.toContain(payload.body)
    }
  })

  test("aborts a timed out request", async () => {
    let observedAbort = false
    const backend = createNtfyBackend(
      { enabled: true, topic: "topic", server: "https://ntfy.example" },
      {
        timeoutMs: 5,
        fetch: async (_url, init) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => {
              observedAbort = true
              reject(new DOMException("aborted", "AbortError"))
            })
          }),
      },
    )
    await expect(backend.send(payload, new AbortController().signal)).rejects.toThrow("timed out")
    expect(observedAbort).toBe(true)
  })

  test("honors caller cancellation", async () => {
    const controller = new AbortController()
    const backend = createNtfyBackend(
      { enabled: true, topic: "topic", server: "https://ntfy.example" },
      {
        fetch: async (_url, init) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")))
          }),
      },
    )
    const sending = backend.send(payload, controller.signal)
    controller.abort()
    await expect(sending).rejects.toThrow("aborted")
  })
})
