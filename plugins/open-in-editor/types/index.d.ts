export type FilePath = string

declare module 'claude-code' {
  interface PluginState {
    'open-in-editor': { files: Shaped<FilePath[]> }
  }
}
