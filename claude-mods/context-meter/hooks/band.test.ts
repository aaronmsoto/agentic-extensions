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
