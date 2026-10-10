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
  on('mcp.call', () => ({ deny: 'no app here' }))
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
    expect(await ui.find({ type: 'Text', text: /60%→120%/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Wk/ })).toBeDefined()
    await ui.unmount()
  }
  // No status line: the band is the only display.
  expect(shown.at(-1)).toBe(undefined)
})

test("the row reads the desktop app's usage card, a model's weekly window once it leaves green", async ($, on) => {
  mock.clock(on, { now: Date.parse('2026-10-10T18:05:00Z') })
  on('ui.status', () => ({ value: undefined }))
  on('ui.toast', () => ({ value: undefined }))
  on('ui.render', { component: 'AbovePrompt' }, () => h('Box', {}))
  on('session.measure', (_$, e) => ({ changed: e.changed }))
  const card = {
    plan: {
      status: 'ok',
      windows: [
        { label: '5-hour limit', percentUsed: 1, resetsAt: '2026-10-10T23:00:00.827Z' },
        { label: 'Weekly · all models', percentUsed: 53, resetsAt: '2026-10-12T04:00:00.827Z' },
        { label: 'Weekly · Fable', percentUsed: 100, resetsAt: '2026-10-12T03:59:59.827Z' },
      ],
    },
  }
  on('mcp.call', () => ({ value: { content: [{ type: 'text', text: JSON.stringify(card) }], isError: false } }))

  await $.session.measure({ context: { window: 200_000 }, rateLimits: [], changed: ['context'] })

  const ui = await $.ui.mount({ plugin: 'usage-meter', surface: 'desktop', ...BAND })
  expect(await ui.find({ type: 'Text', text: /53%→66%/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Fable/ })).toBeDefined()
  await ui.unmount()
})

test('the Usg label takes the color of the worst window', async ($, on) => {
  const clock = mock.clock(on, { now: Date.parse('2026-10-10T12:00:00Z') })
  on('ui.status', () => ({ value: undefined }))
  on('ui.toast', () => ({ value: undefined }))
  on('mcp.call', () => ({ deny: 'no app here' }))
  on('ui.render', { component: 'AbovePrompt' }, () => h('Box', {}))
  on('session.measure', (_$, e) => ({ changed: e.changed }))
  const now = clock.now()
  await $.session.measure({
    context: { window: 200_000 },
    rateLimits: [
      { kind: 'five_hour', percentUsed: 10, resetsAt: new Date(now + 2.5 * 3_600_000).toISOString() },
      { kind: 'seven_day', percentUsed: 70, resetsAt: new Date(now + 3.5 * 86_400_000).toISOString() },
    ],
    changed: ['rateLimits'],
  })

  const ui = await $.ui.mount({ plugin: 'usage-meter', surface: 'desktop', ...BAND })
  const label = await ui.find({ type: 'Text', text: /^Usg/ })
  expect(label?.props.color).toBe('#f0883e')
  await ui.unmount()
})

test('the status line is pinned only while the mobile app is attached', async ($, on) => {
  const clock = mock.clock(on, { now: Date.parse('2026-10-10T12:00:00Z') })
  const shown: (string | undefined)[] = []
  on('ui.status', (_$, e) => {
    shown.push(e.text)

    return { value: undefined }
  })
  on('ui.toast', () => ({ value: undefined }))
  on('mcp.call', () => ({ deny: 'no app here' }))
  on('session.measure', (_$, e) => ({ changed: e.changed }))
  on('session.attach', (_$, e) => ({ clientId: e.clientId }))
  let surfaces: ('desktop' | 'mobile')[] = ['desktop']
  on('session.surfaces', () => ({ value: surfaces }))

  const now = clock.now()
  await $.session.measure({
    context: { window: 200_000 },
    rateLimits: [{ kind: 'five_hour', percentUsed: 30, resetsAt: new Date(now + 2.5 * 3_600_000).toISOString() }],
    changed: ['rateLimits'],
  })
  expect(shown.at(-1)).toBe(undefined)

  surfaces = ['desktop', 'mobile']
  await $.session.attach({ surface: 'mobile', clientId: 'mobile:default' })
  expect(shown.at(-1)).toBe('Usg  🟢 5h 30%→60% ↻2h30m')
})
