import type { Config, PartialConfig } from "./types.ts"

export function mergeConfig(base: Readonly<Config>, layer: PartialConfig): Config {
  return {
    system_notification: {
      enabled: layer.system_notification?.enabled ?? base.system_notification.enabled,
    },
    ntfy: {
      enabled: layer.ntfy?.enabled ?? base.ntfy.enabled,
      topic: layer.ntfy?.topic ?? base.ntfy.topic,
      server: layer.ntfy?.server ?? base.ntfy.server,
    },
    sound: {
      enabled: layer.sound?.enabled ?? base.sound.enabled,
      on_finished: layer.sound?.on_finished ?? base.sound.on_finished,
      on_needs_input: layer.sound?.on_needs_input ?? base.sound.on_needs_input,
      on_error: layer.sound?.on_error ?? base.sound.on_error,
    },
    custom_script: {
      enabled: layer.custom_script?.enabled ?? base.custom_script.enabled,
      on_finished: layer.custom_script?.on_finished ?? base.custom_script.on_finished,
      on_needs_input: layer.custom_script?.on_needs_input ?? base.custom_script.on_needs_input,
      on_error: layer.custom_script?.on_error ?? base.custom_script.on_error,
    },
  }
}
