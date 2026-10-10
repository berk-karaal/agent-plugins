import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import type { SkillDomain } from "@opencode/plugin/promise/skill"

const id = "configuring-opencode-notification"
const name = "Configuring OpenCode Notification"
const description =
  "Use when configuring OpenCode notifications, enabling or disabling notification backends, changing ntfy settings, or setting event-specific sounds and scripts."
const url = new URL(`../../skills/${id}/SKILL.md`, import.meta.url)

function stripFrontmatter(source: string) {
  return source.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "")
}

export async function registerConfigurationSkill(skill: Pick<SkillDomain, "transform">) {
  const path = fileURLToPath(url)
  const content = stripFrontmatter(await readFile(path, "utf8"))
  await skill.transform((editor) => {
    const info = { id, name, description, path, content } as unknown as Parameters<typeof editor.add>[0]
    editor.add(info)
  })
}
