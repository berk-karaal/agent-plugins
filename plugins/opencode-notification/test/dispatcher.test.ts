import { describe, expect, test } from "bun:test"
import type { Backend } from "../src/backends/backend"
import { DEFAULT_CONFIG } from "../src/config/defaults"
import { mergeConfig } from "../src/config/merge"
import { createDispatcher } from "../src/notifications/dispatcher"

describe("notification dispatcher", () => {
  test("does not create or run backends for disabled configuration", async () => {
    let factoryCalls = 0
    const dispatcher = createDispatcher({
      hostname: () => "host",
      loadConfig: async () => mergeConfig(DEFAULT_CONFIG, {}),
      createBackends: () => {
        factoryCalls += 1
        return []
      },
    })
    await dispatcher.dispatch({ event: "finished", projectRoot: "/workspace/project" }, new AbortController().signal)
    expect(factoryCalls).toBe(1)
  })

  test("runs backends concurrently and isolates failures", async () => {
    const order: string[] = []
    const errors: Array<{ backend: string; category: string }> = []
    const backends: Backend[] = [
      {
        id: "first",
        async send() {
          order.push("first:start")
          await Promise.resolve()
          order.push("first:end")
        },
      },
      {
        id: "second",
        async send() {
          order.push("second:start")
          throw new Error("secret response body")
        },
      },
    ]
    const dispatcher = createDispatcher({
      hostname: () => "host",
      loadConfig: async () => mergeConfig(DEFAULT_CONFIG, { system_notification: { enabled: true } }),
      createBackends: () => backends,
      onError: (error) => errors.push(error),
    })
    await dispatcher.dispatch({ event: "finished", projectRoot: "/workspace/project" }, new AbortController().signal)
    expect(order.slice(0, 2)).toEqual(["first:start", "second:start"])
    expect(order).toContain("first:end")
    expect(errors).toEqual([{ backend: "second", category: "delivery-failed" }])
    expect(JSON.stringify(errors)).not.toContain("secret response body")
  })

  test("config errors skip delivery with a redacted category", async () => {
    const errors: Array<{ backend: string; category: string }> = []
    let factoryCalls = 0
    const dispatcher = createDispatcher({
      hostname: () => "host",
      loadConfig: async () => {
        throw new Error("private config value")
      },
      createBackends: () => {
        factoryCalls += 1
        return []
      },
      onError: (error) => errors.push(error),
    })
    await dispatcher.dispatch({ event: "error", projectRoot: "/workspace/project" }, new AbortController().signal)
    expect(factoryCalls).toBe(0)
    expect(errors).toEqual([{ backend: "config", category: "load-failed" }])
  })

  test("does not report cancellation as a backend failure", async () => {
    const controller = new AbortController()
    const errors: Array<{ backend: string; category: string }> = []
    const dispatcher = createDispatcher({
      hostname: () => "host",
      loadConfig: async () => mergeConfig(DEFAULT_CONFIG, { system_notification: { enabled: true } }),
      createBackends: () => [
        {
          id: "system",
          async send(_payload, signal) {
            controller.abort()
            signal.throwIfAborted()
          },
        },
      ],
      onError: (error) => errors.push(error),
    })
    await dispatcher.dispatch({ event: "finished", projectRoot: "/workspace/project" }, controller.signal)
    expect(errors).toEqual([])
  })
})
