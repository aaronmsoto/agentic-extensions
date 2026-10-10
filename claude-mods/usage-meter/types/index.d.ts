export type Reading = {
  rateLimits: { kind: string; percentUsed: number; resetsAt?: string }[]
  cost?: { usd: number }
}

declare module 'claude-code' {
  interface PluginState {
    'usage-meter': { reading: Reading | null; now: number }
  }
}
