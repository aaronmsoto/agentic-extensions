import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Reading } from '../types'
import { bar, COLORS, detail, duration, pace, summary, type Level, type Pace } from './pace'

const reading = atom({ plugin: 'usage-meter', key: 'reading' } as const, null)
const clock = atom({ plugin: 'usage-meter', key: 'now' } as const, 0)

const BAR_WIDTH = 20
const RANK: Record<Level, number> = { green: 0, yellow: 1, orange: 2, red: 3 }

const alerted = new Map<string, Level>()

async function record($: EngineInterface, next: Reading) {
  const now = await $.clock.now()
  await update($, reading, () => next)
  await update($, clock, () => now)

  const paces = next.rateLimits.map(limit => pace(limit, now))
  $.ui.status(paces.length > 0 ? summary(paces) : undefined)

  // One toast each time a window climbs into orange or red; quiet as it falls back.
  for (const p of paces) {
    const before = alerted.get(p.kind) ?? 'green'
    if (RANK[p.level] > RANK[before] && RANK[p.level] >= RANK.orange) {
      $.ui.toast(
        p.level === 'red'
          ? `${p.name} limit ${Math.round(p.used)}% used${p.resetsInMs === undefined ? '' : ` — resets in ${duration(p.resetsInMs)}`}`
          : `${p.name} usage is on pace to hit the limit before it resets`,
      )
    }
    alerted.set(p.kind, p.level)
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    await $.command.register({
      name: 'usage-meter',
      description: 'Show your 5-hour and weekly limits against where you are in each window',
    })
    const usage = await $.session.usage()
    await record($, { rateLimits: usage.rateLimits, cost: usage.cost })
    // Keep the window position and reset countdown moving between turns.
    $.clock.every(60_000, () => {
      void $.clock.now().then(now => update($, clock, () => now))
    })

    return result
  })

  on('session.measure', async ($, e, next) => {
    await record($, { rateLimits: e.rateLimits, cost: e.cost })

    return next(e)
  })

  on('command.run', { command: 'usage-meter' }, async $ => {
    const now = await $.clock.now()
    const latest = await read($, reading)
    const paces = (latest?.rateLimits ?? []).map(limit => pace(limit, now))
    if (paces.length === 0) {
      return { text: 'No limit readings yet: they arrive with the first reply in a session on a Claude subscription.' }
    }
    const cost = latest?.cost === undefined ? '' : `\nThis session: $${latest.cost.usd.toFixed(2)}`

    return { text: paces.map(p => `${p.level.toUpperCase().padEnd(6)} ${p.name}: ${detail(p)}`).join('\n') + cost }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const below = await next(e)
    if (e.props.hasSurvey) return below

    const latest = await read($, reading)
    const now = await read($, clock)
    const paces = (latest?.rateLimits ?? []).map(limit => pace(limit, now))
    if (paces.length === 0) return below

    const { Box, Text } = $.ui.resolve(e)
    const row = (p: Pace) => (
      <Box key={`usage-${p.kind}`} flexDirection="row">
        <Text color={COLORS[p.level]} bold>
          {p.name.padEnd(5)}
        </Text>
        {bar(p, BAR_WIDTH).map(cell =>
          cell.tone === 'empty' ? (
            <Text dimColor>{cell.text}</Text>
          ) : (
            <Text color={cell.tone === 'mark' ? 'text' : COLORS[p.level]}>{cell.text}</Text>
          ),
        )}
        <Text dimColor> {detail(p)}</Text>
      </Box>
    )
    const mine = <Box flexDirection="column">{paces.map(row)}</Box>

    return below ? (
      <Box flexDirection="column">
        {mine}
        {below}
      </Box>
    ) : (
      mine
    )
  })
}
