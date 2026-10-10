import { expect, mock, test } from 'claude-code/testing'

const BAND = {
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 100, scroll: { offset: 0, bodyRows: 10 }, view: {} },
} as const

test('the band draws a row per limit window on terminal and desktop', async ($, on) => {
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

  const now = clock.now()
  await $.session.measure({
    context: { window: 200_000 },
    rateLimits: [
      { kind: 'five_hour', percentUsed: 60, resetsAt: new Date(now + 2.5 * 3_600_000).toISOString() },
      { kind: 'seven_day', percentUsed: 20, resetsAt: new Date(now + 3.5 * 86_400_000).toISOString() },
    ],
    changed: ['rateLimits'],
  })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'usage-meter', surface, ...BAND })
    expect(await ui.find({ type: 'Text', text: /on pace to hit limit/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Week/ })).toBeDefined()
    await ui.unmount()
  }
  expect(shown.at(-1)).toMatch(/%/)
})
