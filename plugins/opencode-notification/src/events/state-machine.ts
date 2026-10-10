import type { NotificationAction } from "../notifications/types.ts"
import type { SessionScopeResolver } from "./session-scope.ts"
import type { NormalizedEvent } from "./types.ts"

interface SessionState {
  active: boolean
  failed: boolean
  blockers: Set<string>
  notifiedBlockers: Set<string>
}

export interface NotificationStateMachineInput {
  projectRoot: string
  resolver: SessionScopeResolver
  onScopeError?: (error: unknown) => void
}

function initialState(): SessionState {
  return { active: false, failed: false, blockers: new Set(), notifiedBlockers: new Set() }
}

export class NotificationStateMachine {
  readonly #states = new Map<string, SessionState>()

  constructor(private readonly input: NotificationStateMachineInput) {}

  async handle(event: NormalizedEvent): Promise<readonly NotificationAction[]> {
    if (event.kind === "deleted") {
      this.#states.delete(event.sessionID)
      this.input.resolver.delete(event.sessionID)
      return []
    }

    const global = event.sessionID === "global"
    if (!global) {
      try {
        if ((await this.input.resolver.resolve(event.sessionID)) === "child") return []
      } catch (error) {
        this.input.onScopeError?.(error)
        return []
      }
    }

    const state = this.#states.get(event.sessionID) ?? initialState()
    this.#states.set(event.sessionID, state)

    switch (event.kind) {
      case "busy":
        if (global) return []
        state.active = true
        state.failed = false
        return []
      case "blocker-opened":
        state.blockers.add(event.blockerID)
        if (state.notifiedBlockers.has(event.blockerID)) return []
        state.notifiedBlockers.add(event.blockerID)
        return [{ event: "needs-input", projectRoot: this.input.projectRoot }]
      case "blocker-closed":
        state.blockers.delete(event.blockerID)
        state.notifiedBlockers.delete(event.blockerID)
        return []
      case "error":
        if (global || state.failed) return []
        state.failed = true
        state.active = false
        return [{ event: "error", projectRoot: this.input.projectRoot }]
      case "idle":
        if (global || !state.active || state.failed || state.blockers.size > 0) return []
        state.active = false
        return [{ event: "finished", projectRoot: this.input.projectRoot }]
    }
  }

  clear() {
    this.#states.clear()
    this.input.resolver.clear()
  }
}
