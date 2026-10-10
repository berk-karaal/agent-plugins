import type { NotificationEvent } from "../config/types.ts"

export interface NotificationAction {
  event: NotificationEvent
  projectRoot: string
}

export interface NotificationPayload {
  event: NotificationEvent
  title: "OpenCode Finished" | "OpenCode Needs Input" | "OpenCode Error"
  body: string
  hostname: string
  project: string
}
