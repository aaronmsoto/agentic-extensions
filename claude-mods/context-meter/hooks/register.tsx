import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { ContextReading } from '../types'

import { COLORS, detail, filledOf, levelOf, ORANGE_FROM, percentOf } from './fill'

const live = atom({ plugin: 'context-meter', key: 'context' } as const, null)

const BAR_WIDTH = 20

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

  on('command.run', { command: 'context-meter' }, async $ => {
    const context = await read($, live)
    const percent = context === null ? undefined : percentOf(context)

    return {
      text:
        context === null || percent === undefined
          ? 'No context reading yet: it arrives with the first reply in a session.'
          : `${levelOf(percent).toUpperCase()} Context: ${detail(context, percent)}`,
    }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const below = await next(e)
    if (e.props.hasSurvey) return below

    const context = await read($, live)
    const percent = context === null ? undefined : percentOf(context)
    if (context === null || percent === undefined) return below

    const { Box, Text } = $.ui.resolve(e)
    const color = COLORS[levelOf(percent)]
    const filled = filledOf(percent, BAR_WIDTH)
    const mine = (
      <Box key="context-meter" flexDirection="row">
        <Text color={color} bold>
          {'Ctx'.padEnd(5)}
        </Text>
        <Text color={color}>{'█'.repeat(filled)}</Text>
        <Text dimColor>{'░'.repeat(BAR_WIDTH - filled)}</Text>
        <Text dimColor> {detail(context, percent)}</Text>
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
