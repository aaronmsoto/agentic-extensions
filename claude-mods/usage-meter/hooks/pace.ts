import type { Reading } from '../types'

type SessionRateLimit = Reading['rateLimits'][number]

export type Level = 'green' | 'yellow' | 'orange' | 'red'

export type Pace = {
  kind: string
  name: string
  /** Percent of the limit used, 0 to 100 (past 100 when blocked on spend). */
  used: number
  /** How far into the window you are, 0 to 1; absent without a reset time. */
  elapsed?: number
  /** Percent of the limit you will have used at reset, at the pace so far. */
  projected?: number
  resetsInMs?: number
  level: Level
}

export const COLORS: Record<Level, string> = {
  green: '#3fb950',
  yellow: '#d29922',
  orange: '#f0883e',
  red: '#f85149',
}


const NAMES: Record<string, string> = { five_hour: '5h', seven_day: 'Wk', spend_limit: 'Spend' }

/** `seven_day:<model>` is a per-model weekly window, named by its model. */
const baseOf = (kind: string) => kind.split(':')[0] ?? kind
const nameOf = (kind: string) => NAMES[kind] ?? (kind.includes(':') ? kind.slice(kind.indexOf(':') + 1) : kind)
const WINDOW_MS: Record<string, number> = { five_hour: 5 * 3_600_000, seven_day: 7 * 86_400_000 }

/** At or above this percent used, the window is red whatever the pace. */
export const RED_FROM = 95
/** Projected use at reset from which the pace counts as near the limit. */
export const YELLOW_FROM = 85
/** Projections from the first 5% of a window are too noisy; treat it as 5% in. */
const MIN_ELAPSED = 0.05

const levelOf = (used: number, projected: number | undefined): Level => {
  if (used >= RED_FROM) return 'red'
  // With no window to measure against, judge on use alone.
  const measure = projected ?? used
  if (measure > 100) return 'orange'
  if (measure >= YELLOW_FROM) return 'yellow'

  return 'green'
}

export const pace = (limit: SessionRateLimit, now: number): Pace => {
  const used = limit.percentUsed
  const resetsAt = limit.resetsAt === undefined ? Number.NaN : Date.parse(limit.resetsAt)
  const length = WINDOW_MS[baseOf(limit.kind)]
  let elapsed: number | undefined
  let projected: number | undefined
  let resetsInMs: number | undefined

  if (!Number.isNaN(resetsAt)) {
    resetsInMs = Math.max(0, resetsAt - now)
    if (length !== undefined) {
      elapsed = Math.min(1, Math.max(0, 1 - resetsInMs / length))
      projected = used / Math.max(elapsed, MIN_ELAPSED)
    }
  }

  return {
    kind: limit.kind,
    name: nameOf(limit.kind),
    used,
    elapsed,
    projected,
    resetsInMs,
    level: levelOf(used, projected),
  }
}

export const duration = (ms: number) => {
  const minutes = Math.round(ms / 60_000)
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)

  return days > 0 ? `${days}d${hours}h` : hours > 0 ? `${hours}h${minutes % 60}m` : `${minutes}m`
}

/** The windows the row always shows; any other (a model's weekly) shows once it leaves green. */
export const isMain = (p: Pace) => p.kind === 'five_hour' || p.kind === 'seven_day'

/** `used→projected` and the time to reset, as the row prints beside a bar. */
export const brief = (p: Pace) => {
  const projected = p.projected === undefined || p.level === 'red' ? '' : `→${Math.round(p.projected)}%`
  const reset = p.resetsInMs === undefined ? '' : ` ↻${duration(p.resetsInMs)}`

  return `${Math.round(p.used)}%${projected}${reset}`
}

export type Cell = { text: string; tone: 'fill' | 'empty' | 'mark' }

/**
 * A bar of `width` cells: filled to the percent used, with a mark at how far
 * into the window you are. Fill left of the mark is on pace; fill past it is ahead.
 */
export const bar = (p: Pace, width: number): Cell[] => {
  const filled = Math.round((Math.min(p.used, 100) / 100) * width)
  const mark = p.elapsed === undefined ? -1 : Math.min(width - 1, Math.floor(p.elapsed * width))
  const cells: Cell[] = []

  for (let i = 0; i < width; i += 1) {
    const tone = i === mark ? 'mark' : i < filled ? 'fill' : 'empty'
    const text = tone === 'mark' ? '┃' : tone === 'fill' ? '█' : '░'
    const last = cells[cells.length - 1]
    if (last !== undefined && last.tone === tone) {
      last.text += text
    } else {
      cells.push({ text, tone })
    }
  }

  return cells
}

export const detail = (p: Pace) => {
  const parts = [`${Math.round(p.used)}% used`]
  if (p.elapsed !== undefined) parts.push(`${Math.round(p.elapsed * 100)}% through window`)
  if (p.projected !== undefined) {
    parts.push(p.projected > 100 ? `on pace to hit limit` : `→ ${Math.round(p.projected)}% at reset`)
  }
  if (p.resetsInMs !== undefined) parts.push(`resets in ${duration(p.resetsInMs)}`)

  return parts.join(' · ')
}
