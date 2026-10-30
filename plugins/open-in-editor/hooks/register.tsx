import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { View } from '../types'

const DOC = /\.(md|mdx|markdown|txt|rst|adoc|org|html?|pdf|csv)$/i
const SYSTEM_OPENED = /\.(html?|pdf)$/i
const docs = atom({ plugin: 'open-in-editor', key: 'docs' } as const, [], { shape: 'paths-1' })
const code = atom({ plugin: 'open-in-editor', key: 'code' } as const, [], { shape: 'paths-1' })
const LABELS = { docs: 'Docs', code: 'Code' }
const newest = (path: string, size: number) => (paths: string[]) => [path, ...paths.filter(one => one !== path)].slice(0, size)
const without = (path: string) => (paths: string[]) => paths.filter(one => one !== path)
const view = atom({ plugin: 'open-in-editor', key: 'view' } as const, 'docs')

type Opener = { label: string; name: string; mac: string[]; linux: string[][] }
// macOS opens the app bundle, so no CLI is needed on PATH; Linux runs the CLI (`zeditor` is Zed's name on some distros).
const EDITORS: Opener[] = [
  { label: 'Zed', name: 'Zed', mac: ['open', '-a', 'Zed'], linux: [['zed'], ['zeditor']] },
  { label: 'VS Code', name: 'VS Code', mac: ['open', '-a', 'Visual Studio Code'], linux: [['code']] },
]
const SYSTEM: Opener = { label: 'Open', name: 'the default app', mac: ['open'], linux: [['xdg-open']] }

async function openIn($: EngineInterface, opener: Opener, path: string) {
  const isMac = (await $.process.run(['uname'])).stdout.trim() === 'Darwin'
  const commands = isMac ? [[...opener.mac, path]] : opener.linux.map(command => [...command, path])
  for (const argv of commands) {
    const ran = await $.process.run(argv).catch(() => undefined)
    if (ran?.exitCode === 0) return
  }
  $.ui.toast(`Could not open ${path} in ${opener.name}`)
}

export const register: Register = on => {
  on('tool.call', { tool: ['Write', 'Edit', 'NotebookEdit'] }, async ($, e, next) => {
    const ran = await next(e)
    if (ran.deny !== undefined || ran.isError === true) return ran

    const path = 'notebook_path' in e ? e.notebook_path : e.file_path
    if (DOC.test(path)) await update($, docs, newest(path, 3))
    else await update($, code, newest(path, 5))

    return ran
  }).catch(($, e, next) => (next.called ? undefined : next(e)))

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const docPaths = await read($, docs)
    const codePaths = await read($, code)
    if (e.props.hasSurvey || docPaths.length + codePaths.length === 0) return next(e)
    // Other mods share this slot: draw theirs below ours instead of replacing it.
    const below = await next(e).catch(() => undefined)

    const shown: View = await read($, view)
    const paths = shown === 'docs' ? docPaths : codePaths
    const { Box, Text, Button } = $.ui.resolve(e)
    const width = e.surface === 'terminal' ? e.props.bodyColumns : undefined
    const mine = (
      <Box flexDirection="column" width={width}>
        <Box flexDirection="row" gap={1}>
          {(['docs', 'code'] as const).map(name => (
            <Button
              key={`view:${name}`}
              label={LABELS[name]}
              {...(name === shown ? { variant: 'primary' as const } : { plain: true as const, dimColor: true })}
              onPress={() => update($, view, () => name)}
            />
          ))}
        </Box>
        {paths.length === 0 && <Text dimColor>No {LABELS[shown].toLowerCase()} files yet.</Text>}
        {paths.map(path => (
          <Box key={path} flexDirection="row" gap={2}>
            <Text>{path.split('/').pop()}</Text>
            <Box flexGrow={1} flexShrink={1}>
              <Text dimColor wrap="truncate-start">
                {path.split('/').slice(0, -1).join('/')}
              </Text>
            </Box>
            <Button
              key={`copy:${path}`}
              plain
              label="Copy"
              onPress={async press => {
                const done = await $.ui.copy({ text: path, surface: press.surface })
                $.ui.toast(done.isCopied ? `Copied ${path}` : `Copy failed: ${done.reason}`)
              }}
            />
            {(SYSTEM_OPENED.test(path) ? [SYSTEM] : EDITORS).map(opener => (
              <Button
                key={`${opener.label}:${path}`}
                plain
                label={opener.label}
                onPress={() => openIn($, opener, path)}
              />
            ))}
            <Button
              key={`forget:${path}`}
              plain
              dimColor
              label="×"
              onPress={() => (shown === 'docs' ? update($, docs, without(path)) : update($, code, without(path)))}
            />
          </Box>
        ))}
      </Box>
    )

    return below ? (
      <Box flexDirection="column">
        {mine}
        {below}
      </Box>
    ) : (
      mine
    )
  }).catch(($, e, next) => next(e))
}
