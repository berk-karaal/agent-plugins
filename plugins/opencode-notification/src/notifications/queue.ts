export interface NotificationQueueInput<T> {
  capacity: number
  worker: (item: T, signal: AbortSignal) => Promise<void>
  onError?: (error: unknown) => void
  onOverflow?: () => void
}

export class NotificationQueue<T> {
  readonly #items: T[] = []
  readonly #controller = new AbortController()
  #closed = false
  #drainPromise?: Promise<void>

  constructor(private readonly input: NotificationQueueInput<T>) {
    if (!Number.isInteger(input.capacity) || input.capacity < 1) throw new Error("queue capacity must be positive")
  }

  enqueue(item: T): boolean {
    if (this.#closed) return false
    if (this.#items.length >= this.input.capacity) {
      this.input.onOverflow?.()
      return false
    }
    this.#items.push(item)
    this.#drainPromise ??= this.#drain()
    return true
  }

  async close(): Promise<void> {
    if (!this.#closed) {
      this.#closed = true
      this.#items.length = 0
      this.#controller.abort()
    }
    await this.#drainPromise
  }

  async #drain() {
    while (!this.#closed && this.#items.length > 0) {
      const item = this.#items.shift()
      if (item === undefined) break
      try {
        await this.input.worker(item, this.#controller.signal)
      } catch (error) {
        if (!this.#controller.signal.aborted) this.input.onError?.(error)
      }
    }
    this.#drainPromise = undefined
    if (!this.#closed && this.#items.length > 0) this.#drainPromise = this.#drain()
  }
}
