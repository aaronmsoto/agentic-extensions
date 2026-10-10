import type { ContextReading as SessionContextUsage } from '../types'

export type Level = 'green' | 'yellow' | 'orange' | 'red'

export const COLORS: Record<Level, string> = {
  green: '#3fb950',
  yellow: '#d29922',
  orange: '#f0883e',
  red: '#f85149',
}

export const DOTS: Record<Level, string> = { green: '🟢', yellow: '🟡', orange: '🟠', red: '🔴' }

/** Percent full from which each level starts. */
export const YELLOW_FROM = 60
export const ORANGE_FROM = 80
export const RED_FROM = 95

export const compact = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}k` : `${n}`

export const percentOf = (context: SessionContextUsage) =>
  context.tokens === undefined
    ? undefined
    : context.percent ?? Math.round((context.tokens / context.window) * 100)

export const levelOf = (percent: number): Level =>
  percent >= RED_FROM ? 'red' : percent >= ORANGE_FROM ? 'orange' : percent >= YELLOW_FROM ? 'yellow' : 'green'

export const detail = (context: SessionContextUsage, percent: number) =>
  `${percent}% · ${compact(context.tokens ?? 0)} of ${compact(context.window)} tokens`

export const filledOf = (percent: number, width: number) => Math.round((Math.min(percent, 100) / 100) * width)
