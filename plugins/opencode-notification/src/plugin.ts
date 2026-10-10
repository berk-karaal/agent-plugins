import { homedir, hostname } from "node:os"
import { Plugin } from "@opencode/plugin"
import { createCustomScriptBackend } from "./backends/custom-script.ts"
import { createNtfyBackend } from "./backends/ntfy.ts"
import { createSoundBackend } from "./backends/sound.ts"
import { createSystemBackend } from "./backends/system.ts"
import { loadConfig } from "./config/load.ts"
import type { Config } from "./config/types.ts"
import { normalizeEvent } from "./events/normalize.ts"
import { SessionScopeResolver } from "./events/session-scope.ts"
import { NotificationStateMachine } from "./events/state-machine.ts"
import { createDispatcher } from "./notifications/dispatcher.ts"
import { NotificationQueue } from "./notifications/queue.ts"
import type { NotificationAction } from "./notifications/types.ts"
import { registerConfigurationSkill } from "./skill/register.ts"

export interface PluginDependencies {
  dispatchAction?: (action: NotificationAction, signal: AbortSignal) => Promise<void>
  registerSkill?: typeof registerConfigurationSkill
}

function createBackends(config: Config) {
  return [
    ...(config.system_notification.enabled ? [createSystemBackend()] : []),
    ...(config.ntfy.enabled ? [createNtfyBackend(config.ntfy)] : []),
    ...(config.sound.enabled ? [createSoundBackend(config.sound)] : []),
    ...(config.custom_script.enabled ? [createCustomScriptBackend(config.custom_script)] : []),
  ]
}

export const createPlugin = (dependencies: PluginDependencies = {}) =>
  Plugin.define({
    id: "opencode-notification",
    async setup(ctx) {
      try {
        await (dependencies.registerSkill ?? registerConfigurationSkill)(ctx.skill)
      } catch {
        console.error("[opencode-notification] configuration skill registration failed")
      }

      const projectRoot = ctx.location.project.canonical
      const resolver = new SessionScopeResolver(async (sessionID) => ctx.session.get({ sessionID }))
      const state = new NotificationStateMachine({
        projectRoot,
        resolver,
        onScopeError: () => console.error("[opencode-notification] session scope lookup failed"),
      })
      const dispatcher = createDispatcher({
        hostname,
        loadConfig: (root) => loadConfig({ home: homedir(), projectRoot: root }),
        createBackends,
        onError: ({ backend, category }) =>
          console.error(`[opencode-notification] backend=${backend} category=${category}`),
      })
      const dispatchAction = dependencies.dispatchAction ?? ((action, signal) => dispatcher.dispatch(action, signal))
      const queue = new NotificationQueue<NotificationAction>({
        capacity: 100,
        worker: dispatchAction,
        onError: () => console.error("[opencode-notification] queue worker failed"),
        onOverflow: () => console.warn("[opencode-notification] notification queue full; newest item dropped"),
      })
      const controller = new AbortController()
      const subscription = (async () => {
        try {
          for await (const raw of ctx.event.subscribe({ signal: controller.signal })) {
            const event = normalizeEvent(raw)
            if (!event) continue
            for (const action of await state.handle(event)) queue.enqueue(action)
          }
        } catch {
          if (!controller.signal.aborted) console.error("[opencode-notification] event stream failed")
        }
      })()

      return async () => {
        controller.abort()
        state.clear()
        await queue.close()
        await subscription
      }
    },
  })

export default createPlugin()
