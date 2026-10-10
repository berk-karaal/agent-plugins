export interface SpawnOptions {
  env: Record<string, string>
  stdout: "ignore"
  stderr: "ignore"
}

export interface SpawnedProcess {
  exited: Promise<number>
  kill(signal?: number | NodeJS.Signals): void
}

export type Spawn = (command: string[], options: SpawnOptions) => SpawnedProcess

export interface RunProcessInput {
  executable: string
  args: readonly string[]
  env: Record<string, string>
  timeoutMs: number
  signal?: AbortSignal
  spawn?: Spawn
}

function inheritedEnvironment() {
  return Object.fromEntries(
    Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
  )
}

const defaultSpawn: Spawn = (command, options) => Bun.spawn(command, options)

export async function runProcess(input: RunProcessInput): Promise<void> {
  input.signal?.throwIfAborted()
  const child = (input.spawn ?? defaultSpawn)([input.executable, ...input.args], {
    env: { ...inheritedEnvironment(), ...input.env },
    stdout: "ignore",
    stderr: "ignore",
  })
  let killed = false
  const kill = () => {
    if (killed) return
    killed = true
    child.kill()
  }

  let timeout: ReturnType<typeof setTimeout> | undefined
  let onAbort: (() => void) | undefined
  const interrupted = new Promise<"timeout" | "aborted">((resolve) => {
    timeout = setTimeout(() => resolve("timeout"), input.timeoutMs)
    if (input.signal) {
      onAbort = () => resolve("aborted")
      input.signal.addEventListener("abort", onAbort, { once: true })
    }
  })

  try {
    const result = await Promise.race([
      child.exited.then((status) => ({ type: "exit" as const, status })),
      interrupted.then((reason) => ({ type: "interrupt" as const, reason })),
    ])
    if (result.type === "interrupt") {
      kill()
      await child.exited.catch(() => undefined)
      throw new Error(result.reason === "timeout" ? "process timed out" : "process aborted")
    }
    if (result.status !== 0) throw new Error(`process exited with status ${result.status}`)
  } finally {
    if (timeout) clearTimeout(timeout)
    if (input.signal && onAbort) input.signal.removeEventListener("abort", onAbort)
  }
}
