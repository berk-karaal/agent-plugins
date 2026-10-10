import type { Config } from "./types.ts"

export const DEFAULT_CONFIG: Readonly<Config> = Object.freeze({
  system_notification: Object.freeze({ enabled: false }),
  ntfy: Object.freeze({ enabled: false, topic: "", server: "https://ntfy.sh" }),
  sound: Object.freeze({ enabled: false, on_finished: "", on_needs_input: "", on_error: "" }),
  custom_script: Object.freeze({ enabled: false, on_finished: "", on_needs_input: "", on_error: "" }),
})
