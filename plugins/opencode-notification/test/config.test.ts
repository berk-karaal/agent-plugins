import { afterEach, describe, expect, test } from "bun:test"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { DEFAULT_CONFIG } from "../src/config/defaults"
import { loadConfig } from "../src/config/load"
import { mergeConfig } from "../src/config/merge"
import { validateConfig } from "../src/config/validate"

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "opencode-notification-config-"))
  roots.push(root)
  const home = join(root, "home")
  const projectRoot = join(root, "project")
  await mkdir(join(home, ".config", "opencode-notification"), { recursive: true })
  await mkdir(projectRoot, { recursive: true })
  return {
    home,
    projectRoot,
    globalPath: join(home, ".config", "opencode-notification", "config.json"),
    projectPath: join(projectRoot, ".opencode-notification.json"),
  }
}

describe("notification configuration", () => {
  test("defaults disable every backend", () => {
    expect(DEFAULT_CONFIG.system_notification.enabled).toBe(false)
    expect(DEFAULT_CONFIG.ntfy.enabled).toBe(false)
    expect(DEFAULT_CONFIG.sound.enabled).toBe(false)
    expect(DEFAULT_CONFIG.custom_script.enabled).toBe(false)
  })

  test("project fields merge over global fields without erasing siblings", () => {
    const result = mergeConfig(
      mergeConfig(DEFAULT_CONFIG, { ntfy: { enabled: true, topic: "private", server: "https://ntfy.sh" } }),
      { ntfy: { enabled: false } },
    )
    expect(result.ntfy).toEqual({ enabled: false, topic: "private", server: "https://ntfy.sh" })
  })

  test("loads global then project configuration", async () => {
    const paths = await fixture()
    await writeFile(paths.globalPath, JSON.stringify({ ntfy: { enabled: true, topic: "secret" } }))
    await writeFile(paths.projectPath, JSON.stringify({ ntfy: { enabled: false }, sound: { enabled: true } }))

    const config = await loadConfig(paths)

    expect(config.ntfy).toEqual({ enabled: false, topic: "secret", server: "https://ntfy.sh" })
    expect(config.sound.enabled).toBe(true)
  })

  test("validates semantic requirements after all layers are merged", async () => {
    const paths = await fixture()
    await writeFile(paths.globalPath, JSON.stringify({ ntfy: { enabled: true } }))
    await writeFile(paths.projectPath, JSON.stringify({ ntfy: { topic: "project-private-topic" } }))

    const config = await loadConfig(paths)

    expect(config.ntfy).toEqual({ enabled: true, topic: "project-private-topic", server: "https://ntfy.sh" })
  })

  test("returns defaults when both files are absent", async () => {
    const paths = await fixture()
    expect(await loadConfig(paths)).toEqual(DEFAULT_CONFIG)
  })

  test("rejects a malformed project layer instead of falling back to global", async () => {
    const paths = await fixture()
    await writeFile(paths.globalPath, JSON.stringify({ ntfy: { enabled: true, topic: "do-not-log-this" } }))
    await writeFile(paths.projectPath, "{")

    await expect(loadConfig(paths)).rejects.toThrow("project config")
    try {
      await loadConfig(paths)
    } catch (error) {
      expect(String(error)).not.toContain("do-not-log-this")
    }
  })

  test("rejects unknown fields", () => {
    expect(() => validateConfig({ mystery: true })).toThrow("unknown field: mystery")
    expect(() => validateConfig({ ntfy: { enabled: false, token: "secret" } })).toThrow("unknown field: ntfy.token")
  })

  test("rejects invalid enabled values and paths", () => {
    expect(() => validateConfig({ sound: { enabled: "yes" } })).toThrow("sound.enabled")
    expect(() => validateConfig({ sound: { on_finished: 42 } })).toThrow("sound.on_finished")
    expect(() => validateConfig({ custom_script: { on_finished: "relative.sh" } })).toThrow("custom_script.on_finished")
  })

  test("requires a private topic and HTTP server for enabled ntfy", () => {
    expect(() => validateConfig({ ntfy: { enabled: true } })).toThrow("ntfy.topic")
    expect(() => validateConfig({ ntfy: { server: "file:///tmp/ntfy" } })).toThrow("ntfy.server")
  })
})
