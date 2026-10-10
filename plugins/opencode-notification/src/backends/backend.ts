import type { NotificationPayload } from "../notifications/types.ts"

export interface Backend {
  readonly id: string
  send(payload: NotificationPayload, signal: AbortSignal): Promise<void>
}
