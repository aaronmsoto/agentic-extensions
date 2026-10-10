import { expect, mock, test } from 'claude-code/testing'

const BAND = {
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 100, scroll: { offset: 0, bodyRows: 10 }, view: {} },
} as const

test('the band draws the fill on terminal and desktop', async ($, on) => {
  const clock = mock.clock(on, { now: Date.parse('2026-10-10T12:00:00Z') })
  const shown: (string | undefined)[] = []
  on('ui.status', (_$, e) => {
    shown.push(e.text)

    return { value: undefined }
  })
  on('ui.toast', () => ({ value: undefined }))
  // The engine's own band: empty, as when nothing else draws there.
  on('ui.render', { component: 'AbovePrompt' }, () => h('Box', {}))
  on('session.measure', (_$, e) => ({ changed: e.changed }))

  await $.session.measure({
    context: { tokens: 84_000, window: 200_000, percent: 42 },
    rateLimits: [],
    changed: ['context'],
  })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'context-meter', surface, ...BAND })
    expect(await ui.find({ type: 'Text', text: /42% · 84k of 200k tokens/ })).toBeDefined()
    await ui.unmount()
  }
  // No status line: the band is the only display.
  expect(shown.at(-1)).toBe(undefined)
})

test('the band shows where the input came from once a response reported it', async ($, on) => {
  mock.clock(on, { now: Date.parse('2026-10-10T12:00:00Z') })
  on('ui.status', () => ({ value: undefined }))
  on('ui.toast', () => ({ value: undefined }))
  on('ui.render', { component: 'AbovePrompt' }, () => h('Box', {}))
  on('session.measure', (_$, e) => ({ changed: e.changed }))
  on('turn.step', async function* (_$, e) {
    return {
      turnId: e.turnId,
      index: e.index,
      answer: '',
      toolUses: [],
      stopReason: 'end_turn',
      usage: { model: 'claude-opus-5-5', input_tokens: 2_000, output_tokens: 500, cache_read_input_tokens: 171_000, cache_creation_input_tokens: 5_000 },
    }
  })

  await $.session.measure({ context: { tokens: 178_000, window: 1_000_000, percent: 18 }, rateLimits: [], changed: ['context'] })
  const stream = $.turn.step({ turnId: 't1', index: 0, model: 'claude-opus-5-5', messageCount: 1 })
  for await (const _chunk of stream) {
    // drain
  }

  const ui = await $.ui.mount({ plugin: 'context-meter', surface: 'desktop', ...BAND })
  expect(await ui.find({ type: 'Text', text: /cached 171k {2}▓ written 5k {2}▒ new 2k/ })).toBeDefined()
  await ui.unmount()
})

test('the bar stretches so the row spans the band', async ($, on) => {
  on('ui.status', () => ({ value: undefined }))
  on('ui.toast', () => ({ value: undefined }))
  on('ui.render', { component: 'AbovePrompt' }, () => h('Box', {}))
  on('session.measure', (_$, e) => ({ changed: e.changed }))
  await $.session.measure({ context: { tokens: 84_000, window: 200_000, percent: 42 }, rateLimits: [], changed: ['context'] })

  for (const columns of [80, 140]) {
    const ui = await $.ui.mount({ plugin: 'context-meter', surface: 'desktop', ...BAND, props: { ...BAND.props, bodyColumns: columns } })
    expect((await ui.find({ key: 'context-meter' }))?.text.length).toBe(columns)
    await ui.unmount()
  }
})
