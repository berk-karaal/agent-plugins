import { basename } from "node:path"
import type { NotificationEvent } from "../config/types.ts"
import type { NotificationPayload } from "./types.ts"

const titles = {
  finished: "OpenCode Finished",
  "needs-input": "OpenCode Needs Input",
  error: "OpenCode Error",
} as const

export function buildPayload(event: NotificationEvent, projectRoot: string, hostname: string): NotificationPayload {
  const project = basename(projectRoot)
  return Object.freeze({
    event,
    title: titles[event],
    body: `[${hostname}] Project: ${project}`,
    hostname,
    project,
  })
}
