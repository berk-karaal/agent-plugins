import { existsSync, readdirSync, readFileSync } from "node:fs"
import { basename, join, resolve } from "node:path"
import { pathToFileURL } from "node:url"

const pluginDirs =
  process.argv.length > 2
    ? process.argv.slice(2)
    : readdirSync("plugins")
        .map((name) => join("plugins", name))
        .filter((dir) => existsSync(join(dir, "package.json")))

function stubContext(directory, registered) {
  const domain = (name) => ({
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
  })
  return new Proxy({ location: { directory }, options: {} }, { get: (ctx, key) => (key in ctx ? ctx[key] : domain(key)) })
}

function listNames(dir, pick) {
  return existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).flatMap(pick).sort() : []
}

function sameList(label, expected, actual, errors) {
  if (JSON.stringify(expected) !== JSON.stringify(actual))
    errors.push(`${label}: expected [${expected.join(", ")}], registered [${actual.join(", ")}]`)
}

function undeclaredImports(root) {
  const source = readFileSync(join(root, "index.ts"), "utf8")
  const declared = Object.keys(JSON.parse(readFileSync(join(root, "package.json"), "utf8")).dependencies ?? {})
  const packages = [...source.matchAll(/\bfrom\s+["']([^"'.][^"']*)["']|\bimport\(\s*["']([^"'.][^"']*)["']/g)]
    .map((match) => match[1] ?? match[2])
    .filter((specifier) => !specifier.startsWith("node:"))
    .map((specifier) => specifier.split("/").slice(0, specifier.startsWith("@") ? 2 : 1).join("/"))
  return [...new Set(packages)].filter((name) => !declared.includes(name))
}

async function check(dir) {
  const root = resolve(dir)
  const errors = []
  for (const name of undeclaredImports(root))
    errors.push(`index.ts imports "${name}" but package.json does not list it in dependencies`)
  const plugin = (await import(pathToFileURL(join(root, "index.ts")).href)).default
  if (typeof plugin?.id !== "string" || typeof plugin?.setup !== "function")
    return ["default export is not Plugin.define({ id, setup })"]

  const registered = {}
  try {
    await plugin.setup(stubContext(root, registered))
  } catch (error) {
    return [`setup() threw: ${error?.stack ?? error}`]
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
