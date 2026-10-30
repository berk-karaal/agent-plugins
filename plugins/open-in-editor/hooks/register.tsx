import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

const SHOWN = 3
const files = atom({ plugin: 'open-in-editor', key: 'files' } as const, [], {
  shape: 'files-1',
})
const EDITORS = [
  { label: 'Zed', app: 'Zed' },
  { label: 'VS Code', app: 'Visual Studio Code' },
]

export const register: Register = on => {
  on('tool.call', { tool: ['Write', 'Edit', 'NotebookEdit'] }, async ($, e, next) => {
    const ran = await next(e)
    if (ran.deny !== undefined || ran.isError === true) return ran

    const path = 'notebook_path' in e ? e.notebook_path : e.file_path
    await update($, files, list => [path, ...list.filter(one => one !== path)].slice(0, SHOWN))

    return ran
  }).catch(($, e, next) => (next.called ? undefined : next(e)))

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const list = await read($, files)
    if (e.props.hasSurvey || list.length === 0) return next(e)
    // Other mods share this slot: draw theirs below ours instead of replacing it.
    const below = await next(e).catch(() => undefined)

    const { Box, Text, Button } = $.ui.resolve(e)
    const width = e.surface === 'terminal' ? e.props.bodyColumns : undefined
    const mine = (
      <Box flexDirection="column" width={width}>
        {list.map(path => (
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
            {EDITORS.map(editor => (
              <Button
                key={`${editor.label}:${path}`}
                plain
                label={editor.label}
                onPress={() => void $.process.run(['open', '-a', editor.app, path])}
              />
            ))}
            <Button
              key={`forget:${path}`}
              plain
              dimColor
              label="×"
              onPress={() => update($, files, all => all.filter(one => one !== path))}
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
