export type ContextReading = { tokens?: number; window: number; percent?: number }

/** The last main-loop response's input, by where it came from. */
export type InputSplit = { cacheRead: number; cacheWrite: number; uncached: number }

declare module 'claude-code' {
  interface PluginState {
    'context-meter': { context: ContextReading | null; split: InputSplit | null }
  }
}
