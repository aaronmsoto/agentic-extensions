import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { ContextReading, InputSplit } from '../types'

import { COLORS, detail, levelOf, ORANGE_FROM, percentOf, segments, splitDetail } from './fill'

const live = atom({ plugin: 'context-meter', key: 'context' } as const, null)
const inputSplit = atom({ plugin: 'context-meter', key: 'split' } as const, null)

const LABEL = 5
/** Columns left free at the row's end, so a surface that measures a little narrower still fits it. */
const RESERVE = 2
/** The bar never shrinks below this; on a narrow band the text wraps instead. */
const MIN_BAR = 10

let hasWarned = false

async function record($: EngineInterface, context: ContextReading) {
  await update($, live, () => context)

  // The band above the prompt is the one display; clear any line an older version pinned.
  $.ui.status(undefined)

  const percent = percentOf(context)
  if (percent === undefined) {
    return
  }

  if (percent >= ORANGE_FROM && !hasWarned) {
    hasWarned = true
    $.ui.toast(`Context ${percent}% full — consider /compact`)
  }
  if (percent < ORANGE_FROM) {
    hasWarned = false
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    await $.command.register({ name: 'context-meter', description: 'Show how full the context window is' })
    await record($, (await $.session.usage()).context)

    return result
  })

  on('session.measure', async ($, e, next) => {
    if (e.changed.includes('context')) {
      await record($, e.context)
    }

    return next(e)
  })

  // Each main-loop response reports its input by source; the last one is the context's make-up.
  on('turn.step', async function* ($, e, next) {
    const response = yield* next(e)
    if (e.agentId === undefined && response.usage !== null) {
      const split: InputSplit = {
        cacheRead: response.usage.cache_read_input_tokens,
        cacheWrite: response.usage.cache_creation_input_tokens,
        uncached: response.usage.input_tokens,
      }
      await update($, inputSplit, () => split)
    }

    return response
  })

  on('command.run', { command: 'context-meter' }, async $ => {
    const context = await read($, live)
    const split = await read($, inputSplit)
    const percent = context === null ? undefined : percentOf(context)

    return {
      text:
        context === null || percent === undefined
          ? 'No context reading yet: it arrives with the first reply in a session.'
          : `${levelOf(percent).toUpperCase()} Context: ${detail(context, percent)}${split === null ? '' : `\n${splitDetail(split)}`}`,
    }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const below = await next(e)
    if (e.props.hasSurvey) return below

    const context = await read($, live)
    const percent = context === null ? undefined : percentOf(context)
    if (context === null || percent === undefined) return below

    const { Box, Text } = $.ui.resolve(e)
    const split = await read($, inputSplit)
    const color = COLORS[levelOf(percent)]
    // The bar takes every column the label and the text leave, so the row spans the band.
    const text = ` ${detail(context, percent)}${split === null ? '' : `  ${splitDetail(split)}`}`
    const width = Math.max(MIN_BAR, e.props.bodyColumns - LABEL - text.length - RESERVE)
    // One line, never wrapped: label and figures keep their width, and the bar,
    // in a box clipped to one row, gives up columns first where the band is narrower.
    const mine = (
      <Box key="context-meter" flexDirection="row" flexWrap="nowrap">
        <Box flexShrink={0}>
          <Text color={color} bold>
            {'Ctx'.padEnd(LABEL)}
          </Text>
        </Box>
        <Box flexGrow={1} flexShrink={1} minWidth={0} height={1} overflow="hidden">
          <Text>
            {segments(percent, split, width).map(cell =>
              cell.tone === 'empty' ? <Text dimColor>{cell.text}</Text> : <Text color={color}>{cell.text}</Text>,
            )}
          </Text>
        </Box>
        <Box flexShrink={0}>
          <Text dimColor>{text}</Text>
        </Box>
      </Box>
    )

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
