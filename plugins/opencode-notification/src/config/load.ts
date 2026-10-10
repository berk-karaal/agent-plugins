import { readFile as nodeReadFile } from "node:fs/promises"
import { join } from "node:path"
import { DEFAULT_CONFIG } from "./defaults.ts"
import { mergeConfig } from "./merge.ts"
import type { Config } from "./types.ts"
import { validateConfigLayer, validateResolvedConfig } from "./validate.ts"

export interface LoadConfigInput {
  home: string
  projectRoot: string
  readFile?: (path: string) => Promise<string>
}

async function readLayer(path: string, label: string, readFile: (path: string) => Promise<string>) {
  let source: string
  try {
    source = await readFile(path)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined
    throw new Error(`${label} config could not be read: ${path}`, { cause: error })
  }

  try {
    return validateConfigLayer(JSON.parse(source))
  } catch (error) {
    throw new Error(`${label} config is invalid: ${path}: ${(error as Error).message}`, { cause: error })
  }
}

export async function loadConfig(input: LoadConfigInput): Promise<Config> {
  const readFile = input.readFile ?? ((path: string) => nodeReadFile(path, "utf8"))
  const globalPath = join(input.home, ".config", "opencode-notification", "config.json")
  const projectPath = join(input.projectRoot, ".opencode-notification.json")
  let config = mergeConfig(DEFAULT_CONFIG, {})

  const global = await readLayer(globalPath, "global", readFile)
  if (global) config = mergeConfig(config, global)

  const project = await readLayer(projectPath, "project", readFile)
  if (project) config = mergeConfig(config, project)

  return validateResolvedConfig(config)
}
