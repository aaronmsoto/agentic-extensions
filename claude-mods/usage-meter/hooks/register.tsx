import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Reading } from '../types'
import { bar, brief, COLORS, detail, duration, isMain, pace, summary, type Level, type Pace } from './pace'
import { fromAppUsage } from './source'

const reading = atom({ plugin: 'usage-meter', key: 'reading' } as const, null)
const clock = atom({ plugin: 'usage-meter', key: 'now' } as const, 0)

const BAR_WIDTH = 12
const POLL_MS = 5 * 60_000
const MIN_FETCH_MS = 60_000
const RANK: Record<Level, number> = { green: 0, yellow: 1, orange: 2, red: 3 }

const alerted = new Map<string, Level>()
let fetchedAt = 0

/**
 * The desktop app's usage card (5-hour, weekly, per-model weekly) through its
 * own tool; none where that server is absent (terminal, cloud) or says nothing.
 */
async function appLimits($: EngineInterface) {
  try {
    const result = await $.mcp.call('ccd_session_mgmt', 'get_usage', {})
    if (result.isError) return []
    const text = result.content.find(one => one.type === 'text')?.text

    return text === undefined ? [] : fromAppUsage(text)
  } catch {
    return []
  }
}

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

/** Reads the app's card (at most once a minute), else the session's own readings. */
async function refresh($: EngineInterface, session: Reading) {
  const now = await $.clock.now()
  if (now - fetchedAt < MIN_FETCH_MS) {
    const kept = await read($, reading)
    await record($, { rateLimits: kept?.rateLimits ?? session.rateLimits, cost: session.cost })

    return
  }
  fetchedAt = now
  const fromApp = await appLimits($)
  await record($, { rateLimits: fromApp.length > 0 ? fromApp : session.rateLimits, cost: session.cost })
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    await $.command.register({
      name: 'usage-meter',
      description: 'Show your 5-hour and weekly limits against where you are in each window',
    })
    const usage = await $.session.usage()
    await refresh($, { rateLimits: usage.rateLimits, cost: usage.cost })
    // Keep the pace marks and reset countdowns moving, and re-read the card, between turns.
    $.clock.every(60_000, () => {
      void $.clock.now().then(now => update($, clock, () => now))
    })
    $.clock.every(POLL_MS, () => {
      void $.session.usage().then(usage => refresh($, { rateLimits: usage.rateLimits, cost: usage.cost }))
    })

    return result
  })

  on('session.measure', async ($, e, next) => {
    await refresh($, { rateLimits: e.rateLimits, cost: e.cost })

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
    const paces = (latest?.rateLimits ?? [])
      .map(limit => pace(limit, now))
      .filter(p => isMain(p) || p.level !== 'green')
    if (paces.length === 0) return below

    const { Box, Text } = $.ui.resolve(e)
    // A window's segment: its name, a bar filled to the use with ┃ at how far into
    // the window you are, then used→projected at reset and the time to reset.
    const segment = (p: Pace) => (
      <Box key={`usage-${p.kind}`} flexDirection="row" marginRight={2}>
        <Text color={COLORS[p.level]} bold>
          {p.name}{' '}
        </Text>
        {isMain(p) &&
          bar(p, BAR_WIDTH).map(cell =>
            cell.tone === 'empty' ? (
              <Text dimColor>{cell.text}</Text>
            ) : (
              <Text color={cell.tone === 'mark' ? 'text' : COLORS[p.level]}>{cell.text}</Text>
            ),
          )}
        <Text color={COLORS[p.level]}> {brief(p)}</Text>
      </Box>
    )
    const mine = (
      <Box key="usage-meter" flexDirection="row" flexWrap="wrap">
        <Text dimColor>{'Usg'.padEnd(5)}</Text>
        {paces.map(segment)}
      </Box>
    )

    // Drawn under whatever else the band holds (the Ctx row).
    return below ? (
      <Box flexDirection="column">
        {below}
        {mine}
      </Box>
    ) : (
      mine
    )
  })
}
