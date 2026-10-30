export type FilePath = string
export type View = 'docs' | 'code'

declare module 'claude-code' {
  interface PluginState {
    'open-in-editor': { docs: Shaped<FilePath[]>; code: Shaped<FilePath[]>; view: View }
  }
}
