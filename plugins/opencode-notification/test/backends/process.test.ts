import { describe, expect, test } from "bun:test"
import { runProcess, type Spawn } from "../../src/backends/process"

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

describe("process runner", () => {
  test("passes executable and hostile arguments directly without a shell", async () => {
    const calls: Parameters<Spawn>[] = []
    const spawn: Spawn = (command, options) => {
      calls.push([command, options])
      return { exited: Promise.resolve(0), kill() {} }
    }
    const args = ["hello world", "$(touch /tmp/bad)", `quote'"`, "; rm -rf /", "line1\nline2"]
    await runProcess({ executable: "/usr/bin/example", args, env: { OCN_EVENT: "finished" }, timeoutMs: 1000, spawn })
    expect(calls).toHaveLength(1)
    expect(calls[0]?.[0]).toEqual(["/usr/bin/example", ...args])
    expect(calls[0]?.[1].env.OCN_EVENT).toBe("finished")
    expect(calls[0]?.[1].env.PATH).toBe(process.env.PATH)
  })

  test("reports non-zero status without process output", async () => {
    const spawn: Spawn = () => ({ exited: Promise.resolve(7), kill() {} })
    await expect(runProcess({ executable: "example", args: [], env: {}, timeoutMs: 1000, spawn })).rejects.toThrow(
      "process exited with status 7",
    )
  })

  test("kills a timed out process", async () => {
    const exit = deferred<number>()
    let kills = 0
    const spawn: Spawn = () => ({
      exited: exit.promise,
      kill() {
        kills += 1
        exit.resolve(143)
      },
    })
    await expect(runProcess({ executable: "example", args: [], env: {}, timeoutMs: 5, spawn })).rejects.toThrow(
      "process timed out",
    )
    expect(kills).toBe(1)
  })

  test("kills a process when its caller aborts", async () => {
    const exit = deferred<number>()
    const controller = new AbortController()
    let kills = 0
    const spawn: Spawn = () => ({
      exited: exit.promise,
      kill() {
        kills += 1
        exit.resolve(143)
      },
    })
    const running = runProcess({
      executable: "example",
      args: [],
      env: {},
      timeoutMs: 1000,
      spawn,
      signal: controller.signal,
    })
    controller.abort()
    await expect(running).rejects.toThrow("process aborted")
    expect(kills).toBe(1)
  })
})
