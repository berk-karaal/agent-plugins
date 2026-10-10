import { describe, expect, test } from "bun:test"
import { SessionScopeResolver } from "../src/events/session-scope"
import { NotificationStateMachine } from "../src/events/state-machine"
import type { NormalizedEvent } from "../src/events/types"

const projectRoot = "/workspace/example-project"
const busy = (sessionID = "ses_root"): NormalizedEvent => ({ kind: "busy", sessionID })
const idle = (sessionID = "ses_root"): NormalizedEvent => ({ kind: "idle", sessionID })

function machine(getSession = async (sessionID: string) => ({ id: sessionID })) {
  const resolver = new SessionScopeResolver(getSession)
  return { resolver, state: new NotificationStateMachine({ projectRoot, resolver }) }
}

describe("notification state machine", () => {
  test("emits one finished action for a root busy to idle cycle", async () => {
    const { state } = machine()
    expect(await state.handle(busy())).toEqual([])
    expect(await state.handle(idle())).toEqual([{ event: "finished", projectRoot }])
    expect(await state.handle(idle())).toEqual([])
  })

  test("emits error and suppresses the following idle completion", async () => {
    const { state } = machine()
    await state.handle(busy())
    expect(await state.handle({ kind: "error", sessionID: "ses_root" })).toEqual([{ event: "error", projectRoot }])
    expect(await state.handle(idle())).toEqual([])
  })

  test("deduplicates blockers and prevents completion while blocked", async () => {
    const { state } = machine()
    await state.handle(busy())
    const opened: NormalizedEvent = { kind: "blocker-opened", sessionID: "ses_root", blockerID: "per_1" }
    expect(await state.handle(opened)).toEqual([{ event: "needs-input", projectRoot }])
    expect(await state.handle(opened)).toEqual([])
    expect(await state.handle(idle())).toEqual([])
    await state.handle({ kind: "blocker-closed", sessionID: "ses_root", blockerID: "per_1" })
    await state.handle(busy())
    expect(await state.handle(idle())).toEqual([{ event: "finished", projectRoot }])
  })

  test("ignores child sessions", async () => {
    const { state } = machine(async (id) => ({ id, parentID: "ses_parent" }))
    expect(await state.handle(busy("ses_child"))).toEqual([])
    expect(await state.handle(idle("ses_child"))).toEqual([])
    expect(await state.handle({ kind: "error", sessionID: "ses_child" })).toEqual([])
  })

  test("retries a failed scope lookup instead of caching it", async () => {
    let calls = 0
    const { state } = machine(async (id) => {
      calls += 1
      if (calls === 1) throw new Error("temporary")
      return { id }
    })
    expect(await state.handle(busy())).toEqual([])
    await state.handle(busy())
    expect(await state.handle(idle())).toEqual([{ event: "finished", projectRoot }])
    expect(calls).toBe(2)
  })

  test("notifies once for global forms without completion state", async () => {
    const { state } = machine()
    const opened: NormalizedEvent = { kind: "blocker-opened", sessionID: "global", blockerID: "frm_1" }
    expect(await state.handle(opened)).toEqual([{ event: "needs-input", projectRoot }])
    expect(await state.handle(opened)).toEqual([])
    await state.handle({ kind: "blocker-closed", sessionID: "global", blockerID: "frm_1" })
    expect(await state.handle(idle("global"))).toEqual([])
  })

  test("deletion clears state and scope cache", async () => {
    let calls = 0
    const { state } = machine(async (id) => {
      calls += 1
      return { id }
    })
    await state.handle(busy())
    await state.handle({ kind: "deleted", sessionID: "ses_root" })
    await state.handle(busy())
    expect(calls).toBe(2)
  })
})
