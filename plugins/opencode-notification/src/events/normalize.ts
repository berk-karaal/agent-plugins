import type { NormalizedEvent } from "./types.ts"

function object(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

function text(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined
}

export function normalizeEvent(raw: unknown): NormalizedEvent | undefined {
  const event = object(raw)
  if (!event) return undefined
  const type = text(event.type)
  if (!type) return undefined
  const outer = object(event.properties) ?? object(event.data)
  if (!outer) return undefined
  const info = object(outer.info) ?? object(outer.form)
  const sessionID =
    text(outer.sessionID) ?? text(info?.sessionID) ?? (type === "session.deleted" ? text(info?.id) : undefined)
  if (!sessionID) return undefined

  if (type === "session.status") {
    const status = text(object(outer.status)?.type) ?? text(outer.status)
    if (status === "busy") return { kind: "busy", sessionID }
    if (status === "idle") return { kind: "idle", sessionID }
    return undefined
  }
  if (type === "session.idle") return { kind: "idle", sessionID }
  if (type === "session.execution.started") return { kind: "busy", sessionID }
  if (type === "session.execution.succeeded") return { kind: "idle", sessionID }
  if (type === "session.error" || type === "session.execution.failed") return { kind: "error", sessionID }
  if (type === "session.deleted") return { kind: "deleted", sessionID }

  const blockerID =
    text(outer.id) ??
    text(outer.requestID) ??
    text(outer.formID) ??
    text(info?.id) ??
    text(info?.requestID) ??
    text(info?.formID)
  if (!blockerID) return undefined

  if (type === "permission.asked" || type === "form.created" || type === "question.asked") {
    return { kind: "blocker-opened", sessionID, blockerID }
  }
  if (
    type === "permission.replied" ||
    type === "form.replied" ||
    type === "form.cancelled" ||
    type === "question.replied" ||
    type === "question.rejected"
  ) {
    return { kind: "blocker-closed", sessionID, blockerID }
  }
  return undefined
}
