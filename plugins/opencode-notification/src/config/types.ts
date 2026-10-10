export type NotificationEvent = "finished" | "needs-input" | "error"

export interface Config {
  system_notification: { enabled: boolean }
  ntfy: { enabled: boolean; topic: string; server: string }
  sound: { enabled: boolean; on_finished: string; on_needs_input: string; on_error: string }
  custom_script: { enabled: boolean; on_finished: string; on_needs_input: string; on_error: string }
}

export type PartialConfig = {
  [K in keyof Config]?: Partial<Config[K]>
} & { $schema?: string }
