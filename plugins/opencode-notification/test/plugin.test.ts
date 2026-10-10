import { describe, expect, test } from "bun:test"
import type { NotificationAction } from "../src/notifications/types"
import { createPlugin } from "../src/plugin"

async function waitFor(predicate: () => boolean, timeoutMs = 1000) {
  const deadline = Date.now() + timeoutMs
  while (!predicate() && Date.now() < deadline) await Bun.sleep(5)
  if (!predicate()) throw new Error("condition timed out")
}

describe("OpenCode plugin integration", () => {
  test("maps root lifecycle and blocker events while suppressing children", async () => {
    const events = [
      { type: "session.status", data: { sessionID: "ses_root", status: { type: "busy" } } },
      { type: "session.status", data: { sessionID: "ses_root", status: { type: "idle" } } },
      { type: "session.idle", data: { sessionID: "ses_root" } },
      { type: "session.status", data: { sessionID: "ses_child", status: { type: "busy" } } },
      { type: "session.status", data: { sessionID: "ses_child", status: { type: "idle" } } },
      { type: "permission.asked", data: { sessionID: "ses_root", id: "per_1" } },
      { type: "permission.asked", data: { sessionID: "ses_root", id: "per_1" } },
      { type: "permission.replied", data: { sessionID: "ses_root", requestID: "per_1" } },
      { type: "form.created", data: { form: { sessionID: "global", id: "frm_1" } } },
      { type: "session.status", data: { sessionID: "ses_root", status: { type: "busy" } } },
      { type: "session.execution.failed", data: { sessionID: "ses_root", error: { message: "private" } } },
      { type: "session.error", properties: { sessionID: "ses_root", error: "private" } },
      { type: "session.idle", data: { sessionID: "ses_root" } },
    ]
    const actions: NotificationAction[] = []
    let subscriptionSignal: AbortSignal | undefined
    let skillRegistrations = 0
    const plugin = createPlugin({
      dispatchAction: async (action) => {
        actions.push(action)
      },
      registerSkill: async () => {
        skillRegistrations += 1
      },
    })
    const context = {
      location: { project: { canonical: "/workspace/project" } },
      session: {
        get: async ({ sessionID }: { sessionID: string }) => ({
          id: sessionID,
          ...(sessionID === "ses_child" ? { parentID: "ses_root" } : {}),
        }),
      },
      skill: {},
      event: {
        subscribe: ({ signal }: { signal?: AbortSignal }) => {
          subscriptionSignal = signal
          return (async function* () {
            for (const event of events) yield event
            await new Promise<void>((resolve) => signal?.addEventListener("abort", () => resolve(), { once: true }))
          })()
        },
      },
    }

    const cleanup = await plugin.setup(context as never)
    await waitFor(() => actions.length === 4)
    expect(actions).toEqual([
      { event: "finished", projectRoot: "/workspace/project" },
      { event: "needs-input", projectRoot: "/workspace/project" },
      { event: "needs-input", projectRoot: "/workspace/project" },
      { event: "error", projectRoot: "/workspace/project" },
    ])
    expect(skillRegistrations).toBe(1)
    expect(subscriptionSignal?.aborted).toBe(false)
    expect(typeof cleanup).toBe("function")
    await cleanup?.()
    expect(subscriptionSignal?.aborted).toBe(true)
  })
})
