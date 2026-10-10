import { expect, test } from 'claude-code/testing'

import { pace } from './pace'
import { fromAppUsage } from './source'

const CARD = JSON.stringify({
  plan: {
    status: 'ok',
    plan: 'Max',
    windows: [
      { label: '5-hour limit', percentUsed: 1, resetsAt: '2026-10-10T23:00:00.827Z' },
      { label: 'Weekly · all models', percentUsed: 53, resetsAt: '2026-10-12T04:00:00.827Z' },
      { label: 'Weekly · Fable', percentUsed: 100, resetsAt: '2026-10-12T03:59:59.827Z' },
    ],
  },
})

test("reads the app's usage card into limit windows", async () => {
  expect(fromAppUsage(CARD).map(l => l.kind)).toEqual(['five_hour', 'seven_day', 'seven_day:Fable'])
})

test('a per-model weekly window is paced over a week and named by its model', async () => {
  const now = Date.parse('2026-10-10T18:05:00Z')
  const [fiveHour, week, model] = fromAppUsage(CARD).map(l => pace(l, now))
  expect(fiveHour?.name).toBe('5h')
  expect(week?.name).toBe('Wk')
  expect(week?.level).toBe('green')
  expect(model?.name).toBe('Fable')
  expect(model?.level).toBe('red')
})

test('no plan, or text that is not JSON, gives no windows', async () => {
  expect(fromAppUsage(JSON.stringify({ plan: { status: 'not_applicable' } }))).toEqual([])
  expect(fromAppUsage('nope')).toEqual([])
})
