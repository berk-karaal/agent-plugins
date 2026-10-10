import { describe, expect, test } from "bun:test"
import { NotificationQueue } from "../src/notifications/queue"

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe("notification queue", () => {
  test("processes items in FIFO order", async () => {
    const processed: number[] = []
    const finished = deferred()
    const queue = new NotificationQueue<number>({
      capacity: 100,
      worker: async (item) => {
        processed.push(item)
        if (processed.length === 3) finished.resolve()
      },
    })
    expect(queue.enqueue(1)).toBe(true)
    expect(queue.enqueue(2)).toBe(true)
    expect(queue.enqueue(3)).toBe(true)
    await finished.promise
    expect(processed).toEqual([1, 2, 3])
    await queue.close()
  })

  test("drops newest work when waiting capacity is exhausted", async () => {
    const release = deferred()
    let overflows = 0
    const queue = new NotificationQueue<number>({
      capacity: 2,
      worker: async () => release.promise,
      onOverflow: () => {
        overflows += 1
      },
    })
    expect(queue.enqueue(1)).toBe(true)
    await Promise.resolve()
    expect(queue.enqueue(2)).toBe(true)
    expect(queue.enqueue(3)).toBe(true)
    expect(queue.enqueue(4)).toBe(false)
    expect(overflows).toBe(1)
    release.resolve()
    await queue.close()
  })

  test("aborts active work and rejects new work after close", async () => {
    const aborted = deferred()
    const queue = new NotificationQueue<number>({
      capacity: 100,
      worker: async (_item, signal) => {
        await new Promise<void>((resolve) => {
          signal.addEventListener("abort", () => {
            aborted.resolve()
            resolve()
          })
        })
      },
    })
    queue.enqueue(1)
    await Promise.resolve()
    const closed = queue.close()
    await aborted.promise
    await closed
    expect(queue.enqueue(2)).toBe(false)
  })

  test("reports worker failures and continues draining", async () => {
    const errors: unknown[] = []
    const processed: number[] = []
    const finished = deferred()
    const queue = new NotificationQueue<number>({
      capacity: 100,
      worker: async (item) => {
        if (item === 1) throw new Error("failed")
        processed.push(item)
        finished.resolve()
      },
      onError: (error) => errors.push(error),
    })
    queue.enqueue(1)
    queue.enqueue(2)
    await finished.promise
    expect(errors).toHaveLength(1)
    expect(processed).toEqual([2])
    await queue.close()
  })
})
