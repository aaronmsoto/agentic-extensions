export type ContextReading = { tokens?: number; window: number; percent?: number }

declare module 'claude-code' {
  interface PluginState {
    'context-meter': { context: ContextReading | null }
  }
}
