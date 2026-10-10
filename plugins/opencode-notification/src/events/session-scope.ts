export interface SessionInfoLike {
  id: string
  parentID?: string
}

export type GetSession = (sessionID: string) => Promise<SessionInfoLike>
export type SessionScope = "root" | "child"

export class SessionScopeResolver {
  readonly #cache = new Map<string, SessionScope>()

  constructor(private readonly getSession: GetSession) {}

  async resolve(sessionID: string): Promise<SessionScope> {
    if (!sessionID) throw new Error("session ID is required")
    const existing = this.#cache.get(sessionID)
    if (existing) return existing
    const session = await this.getSession(sessionID)
    if (session.id !== sessionID) throw new Error("session lookup returned a different session")
    const scope = session.parentID ? "child" : "root"
    this.#cache.set(sessionID, scope)
    return scope
  }

  delete(sessionID: string) {
    this.#cache.delete(sessionID)
  }

  clear() {
    this.#cache.clear()
  }
}
