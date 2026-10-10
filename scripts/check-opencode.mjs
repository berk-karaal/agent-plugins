import { existsSync, readdirSync, readFileSync } from "node:fs"
import { basename, join, resolve } from "node:path"
import { pathToFileURL } from "node:url"

const pluginDirs =
  process.argv.length > 2
    ? process.argv.slice(2)
    : readdirSync("plugins")
        .map((name) => join("plugins", name))
        .filter((dir) => existsSync(join(dir, "package.json")))

const CLEANUP_TIMEOUT_MS = 5000

function idleStream(signal) {
  return {
    async *[Symbol.asyncIterator]() {
      if (signal && !signal.aborted) await new Promise((done) => signal.addEventListener("abort", done, { once: true }))
    },
  }
}

function stubContext(directory, registered) {
  const domain = (name) => {
    const known = {
      transform: async (edit) =>
        edit({
          add: (item) => (registered[name] ??= []).push(item),
          list: () => registered[name] ?? [],
          get: () => undefined,
          update: () => {},
          remove: () => {},
        }),
      hook: async () => {},
      reload: async () => {},
      subscribe: (input) => idleStream(input?.signal),
    }
    return new Proxy(known, { get: (methods, key) => (key in methods ? methods[key] : async () => undefined) })
  }
  const ctx = { location: { directory, project: { id: "load-check", directory, canonical: directory } }, options: {} }
  return new Proxy(ctx, { get: (target, key) => (key in target ? target[key] : domain(key)) })
}

async function runCleanup(cleanup) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`did not finish within ${CLEANUP_TIMEOUT_MS / 1000}s`)), CLEANUP_TIMEOUT_MS)
  })
  try {
    await Promise.race([cleanup(), timeout])
  } finally {
    clearTimeout(timer)
  }
}

function listNames(dir, pick) {
  return existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).flatMap(pick).sort() : []
}

function sameList(label, expected, actual, errors) {
  if (JSON.stringify(expected) !== JSON.stringify(actual))
    errors.push(`${label}: expected [${expected.join(", ")}], registered [${actual.join(", ")}]`)
}

function runtimeSources(root) {
  return readdirSync(root, { recursive: true })
    .map(String)
    .filter((path) => /\.(ts|mjs|js)$/.test(path) && !path.split(/[\\/]/).some((part) => part === "node_modules" || part === "test"))
    .map((path) => readFileSync(join(root, path), "utf8"))
}

function undeclaredImports(root) {
  const declared = Object.keys(JSON.parse(readFileSync(join(root, "package.json"), "utf8")).dependencies ?? {})
  const packages = runtimeSources(root)
    .flatMap((source) => [...source.matchAll(/\bfrom\s+["']([^"'.][^"']*)["']|\bimport\(\s*["']([^"'.][^"']*)["']/g)])
    .map((match) => match[1] ?? match[2])
    .filter((specifier) => !/^(node|bun):/.test(specifier))
    .map((specifier) => specifier.split("/").slice(0, specifier.startsWith("@") ? 2 : 1).join("/"))
  return [...new Set(packages)].filter((name) => !declared.includes(name))
}

async function check(dir) {
  const root = resolve(dir)
  const errors = []
  for (const name of undeclaredImports(root))
    errors.push(`plugin code imports "${name}" but package.json does not list it in dependencies`)
  const plugin = (await import(pathToFileURL(join(root, "index.ts")).href)).default
  if (typeof plugin?.id !== "string" || typeof plugin?.setup !== "function")
    return ["default export is not Plugin.define({ id, setup })"]

  const registered = {}
  let cleanup
  try {
    cleanup = await plugin.setup(stubContext(root, registered))
  } catch (error) {
    return [`setup() threw: ${error?.stack ?? error}`]
  }
  if (typeof cleanup === "function") {
    try {
      await runCleanup(cleanup)
    } catch (error) {
      errors.push(`cleanup returned by setup() failed: ${error?.message ?? error}`)
    }
  }

  const skills = registered.skill ?? []
  sameList(
    "skills",
    listNames(join(root, "skills"), (entry) =>
      entry.isDirectory() && existsSync(join(root, "skills", entry.name, "SKILL.md")) ? [entry.name] : [],
    ),
    skills.map((skill) => String(skill.id)).sort(),
    errors,
  )
  for (const skill of skills) {
    if (!existsSync(String(skill.path))) errors.push(`skill ${skill.id}: path does not exist: ${skill.path}`)
    if (!String(skill.content ?? "").trim()) errors.push(`skill ${skill.id}: empty content`)
    if (!String(skill.description ?? "").trim()) errors.push(`skill ${skill.id}: empty description`)
  }

  sameList(
    "commands",
    listNames(join(root, "commands"), (entry) =>
      entry.isFile() && entry.name.endsWith(".md") ? [`${plugin.id}:${basename(entry.name, ".md")}`] : [],
    ),
    (registered.command ?? []).map((command) => command.name).sort(),
    errors,
  )
  return errors
}

let failed = false
for (const dir of pluginDirs) {
  const errors = await check(dir)
  failed ||= errors.length > 0
  console.log(errors.length ? `FAIL ${dir}\n${errors.map((e) => `  - ${e}`).join("\n")}` : `ok   ${dir}`)
}
process.exit(failed ? 1 : 0)
