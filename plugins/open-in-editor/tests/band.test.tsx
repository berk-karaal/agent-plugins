import { expect, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

type Harness = Parameters<TestBody>

const REPORT = '/home/me/notes/report.md'
const BAND = {
  plugin: 'open-in-editor',
  component: 'AbovePrompt',
  surface: 'terminal',
  props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 100, scroll: { offset: 0, bodyRows: 10 }, view: {} },
} as const

// Writes `written`, then presses `keys` on a machine whose `uname` says `os` and where only `installed` commands exist.
async function press([$, on]: Harness, os: string, installed: string[], written: string[], keys: string[]) {
  const runs: string[][] = []
  const toasts: string[] = []
  on('tool.call', () => ({ result: {} }))
  on('ui.toast', (_, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('process.run', (_, e) => {
    runs.push([...e.argv])
    const done = { exitCode: 0, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false }
    if (e.argv[0] === 'uname') return { value: { ...done, stdout: `${os}\n` } }
    if (!installed.includes(e.argv[0] ?? '')) return { deny: 'command not found' }
    return { value: done }
  })
  for (const file_path of written) await $.tool.call({ tool: 'Write', file_path, content: '' })
  const ui = await $.ui.mount(BAND)
  for (const key of keys) await ui.press({ key })
  const texts = async (pattern: RegExp) => (await ui.find({ type: 'Text', text: pattern }))?.text
  return { runs, toasts, ui, texts }
}

test('macOS opens the app bundle', async (...h) => {
  const { runs, ui } = await press(h, 'Darwin', ['open'], [REPORT], [`VS Code:${REPORT}`])
  expect(runs).toEqual([['uname'], ['open', '-a', 'Visual Studio Code', REPORT]])
  await ui.unmount()
})

test('Linux runs the editor CLI, falling back to zeditor', async (...h) => {
  const { runs, toasts, ui } = await press(h, 'Linux', ['zeditor'], [REPORT], [`Zed:${REPORT}`])
  expect(runs).toEqual([['uname'], ['zed', REPORT], ['zeditor', REPORT]])
  expect(toasts).toEqual([])
  await ui.unmount()
})

test('a missing editor says so', async (...h) => {
  const { toasts, ui } = await press(h, 'Linux', [], [REPORT], [`VS Code:${REPORT}`])
  expect(toasts).toEqual([`Could not open ${REPORT} in VS Code`])
  await ui.unmount()
})

test('html and pdf open with the system default app', async (...h) => {
  const page = '/home/me/out/index.html'
  const mac = await press(h, 'Darwin', ['open'], [page], [`Open:${page}`])
  expect(mac.runs).toEqual([['uname'], ['open', page]])
  expect(await mac.ui.find({ key: `Zed:${page}` })).toBeUndefined()
  await mac.ui.unmount()
})

test('pdf on Linux opens with xdg-open', async (...h) => {
  const pdf = '/home/me/out/report.pdf'
  const { runs, ui } = await press(h, 'Linux', ['xdg-open'], [pdf], [`Open:${pdf}`])
  expect(runs).toEqual([['uname'], ['xdg-open', pdf]])
  await ui.unmount()
})

test('code files wait behind the Code toggle, docs keep 3 and code keeps 5', async (...h) => {
  const docs = ['a.md', 'b.txt', 'c.csv', 'd.md'].map(name => `/r/${name}`)
  const code = ['1.ts', '2.go', '3.py', '4.json', '5.sh', '6.rs'].map(name => `/r/src/${name}`)
  const { ui, texts } = await press(h, 'Darwin', ['open'], [...docs, ...code], [])
  expect(await texts(/^d\.md$/)).toBe('d.md')
  expect(await texts(/^a\.md$/)).toBeUndefined()
  expect(await texts(/^6\.rs$/)).toBeUndefined()

  await ui.press({ key: 'view:code' })
  expect(await texts(/^6\.rs$/)).toBe('6.rs')
  expect(await texts(/^2\.go$/)).toBe('2.go')
  expect(await texts(/^1\.ts$/)).toBeUndefined()
  expect(await texts(/^d\.md$/)).toBeUndefined()
  await ui.unmount()
})
