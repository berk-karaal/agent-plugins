import { readdir, readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { Plugin, Skill } from "@opencode/plugin"

const skillsDir = new URL("./skills/", import.meta.url)

export function parseSkill(markdown: string) {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/)
  const fields: Record<string, string> = {}
  for (const line of (match?.[1] ?? "").split(/\r?\n/)) {
    const field = line.match(/^([\w-]+):\s*(.*)$/)
    if (field) fields[field[1]] = field[2].trim().replace(/^(["'])(.*)\1$/, "$2")
  }
  return { fields, body: markdown.slice(match?.[0].length ?? 0).trim() }
}

export default Plugin.define({
  id: "brk-pr",
  async setup(ctx) {
    const dirs = (await readdir(skillsDir, { withFileTypes: true })).filter((entry) => entry.isDirectory())
    const skills = await Promise.all(
      dirs.map(async ({ name }) => {
        const location = fileURLToPath(new URL(`${name}/SKILL.md`, skillsDir))
        const { fields, body } = parseSkill(await readFile(location, "utf8"))
        return Skill.Info.make({
          id: Skill.ID.make(name),
          name: Skill.Name.make(fields.name ?? name),
          description: fields.description ?? "",
          path: location as typeof ctx.location.directory,
          content: body,
        })
      }),
    )
    await ctx.skill.transform((editor) => {
      for (const skill of skills) editor.add(skill)
    })
  },
})
