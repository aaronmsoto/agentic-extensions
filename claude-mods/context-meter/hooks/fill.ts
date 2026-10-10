import type { ContextReading as SessionContextUsage, InputSplit } from '../types'

export type Level = 'green' | 'yellow' | 'orange' | 'red'

export const COLORS: Record<Level, string> = {
  green: '#3fb950',
  yellow: '#d29922',
  orange: '#f0883e',
  red: '#f85149',
}


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

export type Cell = { text: string; tone: 'read' | 'write' | 'new' | 'empty' }

export const GLYPHS = { read: '█', write: '▓', new: '▒', empty: '░' } as const

/**
 * The fill split by where the input came from: cache read, cache written,
 * uncached. Each part's cells are its share of the fill, rounded.
 */
export const segments = (percent: number, split: InputSplit | null, width: number): Cell[] => {
  const filled = filledOf(percent, width)
  const total = split === null ? 0 : split.cacheRead + split.cacheWrite + split.uncached
  const parts: Cell[] = []

  if (total === 0 || split === null) {
    parts.push({ text: GLYPHS.read.repeat(filled), tone: 'read' })
  } else {
    const read = Math.round((split.cacheRead / total) * filled)
    const write = Math.min(filled - read, Math.round((split.cacheWrite / total) * filled))
    parts.push(
      { text: GLYPHS.read.repeat(read), tone: 'read' },
      { text: GLYPHS.write.repeat(write), tone: 'write' },
      { text: GLYPHS.new.repeat(filled - read - write), tone: 'new' },
    )
  }
  parts.push({ text: GLYPHS.empty.repeat(width - filled), tone: 'empty' })

  return parts.filter(part => part.text.length > 0)
}

/** `cached 171k · written 5k · new 2k`, each with the glyph it fills the bar with. */
export const splitDetail = (split: InputSplit) =>
  `${GLYPHS.read} cached ${compact(split.cacheRead)}  ${GLYPHS.write} written ${compact(split.cacheWrite)}  ${GLYPHS.new} new ${compact(split.uncached)}`
