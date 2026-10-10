import { isAbsolute } from "node:path"
import { DEFAULT_CONFIG } from "./defaults.ts"
import { mergeConfig } from "./merge.ts"
import type { Config, PartialConfig } from "./types.ts"

const ROOT_FIELDS = new Set(["$schema", "system_notification", "ntfy", "sound", "custom_script"])
const BACKEND_FIELDS = {
  system_notification: new Set(["enabled"]),
  ntfy: new Set(["enabled", "topic", "server"]),
  sound: new Set(["enabled", "on_finished", "on_needs_input", "on_error"]),
  custom_script: new Set(["enabled", "on_finished", "on_needs_input", "on_error"]),
} as const

function record(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${field} must be an object`)
  }
  return value as Record<string, unknown>
}

function validateKnownFields(value: Record<string, unknown>, allowed: ReadonlySet<string>, prefix: string) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new Error(`unknown field: ${prefix}${key}`)
  }
}

function boolean(value: unknown, field: string) {
  if (typeof value !== "boolean") throw new Error(`${field} must be a boolean`)
}

function string(value: unknown, field: string) {
  if (typeof value !== "string") throw new Error(`${field} must be a string`)
}

export function validateConfigLayer(value: unknown): PartialConfig {
  const root = record(value, "config")
  validateKnownFields(root, ROOT_FIELDS, "")
  if (root.$schema !== undefined) string(root.$schema, "$schema")

  for (const backend of Object.keys(BACKEND_FIELDS) as Array<keyof typeof BACKEND_FIELDS>) {
    const raw = root[backend]
    if (raw === undefined) continue
    const section = record(raw, backend)
    validateKnownFields(section, BACKEND_FIELDS[backend], `${backend}.`)
    if (section.enabled !== undefined) boolean(section.enabled, `${backend}.enabled`)
    for (const [key, item] of Object.entries(section)) {
      if (key !== "enabled") string(item, `${backend}.${key}`)
    }
  }

  return root as PartialConfig
}

export function validateResolvedConfig(config: Config): Config {
  if (config.ntfy.enabled && config.ntfy.topic.trim() === "") throw new Error("ntfy.topic is required when enabled")
  let url: URL
  try {
    url = new URL(config.ntfy.server)
  } catch {
    throw new Error("ntfy.server must be an HTTP or HTTPS URL")
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("ntfy.server must be an HTTP or HTTPS URL")
  }

  for (const [key, path] of Object.entries(config.custom_script)) {
    if (key === "enabled" || path === "") continue
    if (typeof path !== "string" || !isAbsolute(path)) {
      throw new Error(`custom_script.${key} must be an absolute path`)
    }
  }
  return config
}

export function validateConfig(value: unknown): Config {
  return validateResolvedConfig(mergeConfig(DEFAULT_CONFIG, validateConfigLayer(value)))
}
