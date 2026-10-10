import { describe, expect, test } from "bun:test"
import { normalizeEvent } from "../src/events/normalize"

const secretFixture = {
  prompt: "PRIVATE_PROMPT_SENTINEL",
  error: "PRIVATE_ERROR_SENTINEL",
  path: "/private/path/sentinel",
  metadata: { permission: "PRIVATE_PERMISSION_SENTINEL" },
  fields: [{ label: "PRIVATE_FORM_SENTINEL" }],
}

describe("event normalization", () => {
  const cases = [
    ["session.status", { sessionID: "ses_1", status: { type: "busy" } }, { kind: "busy", sessionID: "ses_1" }],
    ["session.status", { sessionID: "ses_1", status: { type: "idle" } }, { kind: "idle", sessionID: "ses_1" }],
    ["session.idle", { sessionID: "ses_1" }, { kind: "idle", sessionID: "ses_1" }],
    ["session.error", { sessionID: "ses_1" }, { kind: "error", sessionID: "ses_1" }],
    [
      "permission.asked",
      { sessionID: "ses_1", id: "per_1" },
      { kind: "blocker-opened", sessionID: "ses_1", blockerID: "per_1" },
    ],
    [
      "permission.replied",
      { sessionID: "ses_1", requestID: "per_1" },
      { kind: "blocker-closed", sessionID: "ses_1", blockerID: "per_1" },
    ],
    [
      "form.created",
      { sessionID: "ses_1", id: "frm_1" },
      { kind: "blocker-opened", sessionID: "ses_1", blockerID: "frm_1" },
    ],
    [
      "form.replied",
      { sessionID: "ses_1", id: "frm_1" },
      { kind: "blocker-closed", sessionID: "ses_1", blockerID: "frm_1" },
    ],
    [
      "form.cancelled",
      { sessionID: "ses_1", id: "frm_1" },
      { kind: "blocker-closed", sessionID: "ses_1", blockerID: "frm_1" },
    ],
    [
      "question.asked",
      { sessionID: "ses_1", id: "que_1" },
      { kind: "blocker-opened", sessionID: "ses_1", blockerID: "que_1" },
    ],
    [
      "question.replied",
      { sessionID: "ses_1", requestID: "que_1" },
      { kind: "blocker-closed", sessionID: "ses_1", blockerID: "que_1" },
    ],
    [
      "question.rejected",
      { sessionID: "ses_1", requestID: "que_1" },
      { kind: "blocker-closed", sessionID: "ses_1", blockerID: "que_1" },
    ],
    ["session.deleted", { sessionID: "ses_1" }, { kind: "deleted", sessionID: "ses_1" }],
  ] as const

  for (const [type, payload, expected] of cases) {
    for (const container of ["properties", "data"] as const) {
      test(`normalizes ${type} from ${container}`, () => {
        const result = normalizeEvent({ type, [container]: { ...payload, ...secretFixture } })
        expect(result).toEqual(expected)
        const serialized = JSON.stringify(result)
        for (const sentinel of Object.values(secretFixture).flatMap((value) =>
          typeof value === "string" ? [value] : [JSON.stringify(value)],
        )) {
          expect(serialized).not.toContain(sentinel)
        }
      })
    }
  }

  test("accepts nested info records from public event projections", () => {
    expect(
      normalizeEvent({ type: "form.created", properties: { info: { sessionID: "global", id: "frm_2" } } }),
    ).toEqual({
      kind: "blocker-opened",
      sessionID: "global",
      blockerID: "frm_2",
    })
    expect(normalizeEvent({ type: "session.deleted", properties: { info: { id: "ses_2" } } })).toEqual({
      kind: "deleted",
      sessionID: "ses_2",
    })
  })

  test("normalizes current V2 execution and form event shapes", () => {
    expect(normalizeEvent({ type: "session.execution.started", data: { sessionID: "ses_v2" } })).toEqual({
      kind: "busy",
      sessionID: "ses_v2",
    })
    expect(normalizeEvent({ type: "session.execution.succeeded", data: { sessionID: "ses_v2" } })).toEqual({
      kind: "idle",
      sessionID: "ses_v2",
    })
    expect(
      normalizeEvent({
        type: "session.execution.failed",
        data: { sessionID: "ses_v2", error: { message: "PRIVATE_ERROR_SENTINEL" } },
      }),
    ).toEqual({ kind: "error", sessionID: "ses_v2" })
    expect(
      normalizeEvent({
        type: "form.created",
        data: { form: { id: "frm_v2", sessionID: "ses_v2", title: "PRIVATE_FORM_SENTINEL", fields: [] } },
      }),
    ).toEqual({ kind: "blocker-opened", sessionID: "ses_v2", blockerID: "frm_v2" })
  })

  test("ignores unknown or incomplete events", () => {
    expect(normalizeEvent({ type: "message.updated", properties: { sessionID: "ses_1" } })).toBeUndefined()
    expect(normalizeEvent({ type: "permission.asked", properties: { sessionID: "ses_1" } })).toBeUndefined()
    expect(normalizeEvent(null)).toBeUndefined()
  })
})
