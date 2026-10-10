import { describe, expect, test } from "bun:test"
import { registerConfigurationSkill } from "../src/skill/register"

describe("configuration skill", () => {
  test("registers a complete native OpenCode skill", async () => {
    const added: Array<Record<string, unknown>> = []
    await registerConfigurationSkill({
      transform: async (callback: (editor: { add(skill: Record<string, unknown>): void }) => void) => {
        callback({ add: (skill) => added.push(skill) })
        return { dispose: async () => undefined }
      },
    } as never)
    expect(added).toHaveLength(1)
    expect(added[0]).toMatchObject({
      id: "configuring-opencode-notification",
      name: "Configuring OpenCode Notification",
    })
    expect(String(added[0]?.description)).toStartWith("Use when")
    expect(String(added[0]?.path)).toEndWith("skills/configuring-opencode-notification/SKILL.md")
    const content = String(added[0]?.content)
    expect(content).toContain("~/.config/opencode-notification/config.json")
    expect(content).toContain(".opencode-notification.json")
    expect(content).toContain("schema/config.schema.json")
    expect(content).toContain("ntfy")
    expect(content).toContain("system notification")
    expect(content).toContain("sound")
    expect(content).toContain("custom script")
    expect(content).toContain("Treat the ntfy topic as a secret")
    expect(content).toContain("approval before sending a test notification")
  })
})
