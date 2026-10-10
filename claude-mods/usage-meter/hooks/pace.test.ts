import { expect, test } from 'claude-code/testing'

import { bar, pace } from './pace'

const HOUR = 3_600_000
const now = Date.parse('2026-10-10T12:00:00Z')
const fiveHour = (percentUsed: number, hoursLeft: number) => ({
  kind: 'five_hour',
  percentUsed,
  resetsAt: new Date(now + hoursLeft * HOUR).toISOString(),
})

test('half way through the window at 30% used is green', async () => {
  const p = pace(fiveHour(30, 2.5), now)
  expect(p.elapsed).toBe(0.5)
  expect(p.projected).toBe(60)
  expect(p.level).toBe('green')
})

test('near proportional pace is yellow', async () => {
  expect(pace(fiveHour(45, 2.5), now).level).toBe('yellow')
})

test('ahead of pace to hit the limit before reset is orange', async () => {
  expect(pace(fiveHour(60, 2.5), now).level).toBe('orange')
})

test('95% or more is red, blocked included', async () => {
  expect(pace(fiveHour(95, 0.2), now).level).toBe('red')
  expect(pace(fiveHour(100, 1), now).level).toBe('red')
})

test('a window with no reset time is judged on use alone', async () => {
  expect(pace({ kind: 'seven_day', percentUsed: 40 }, now).level).toBe('green')
})

test('the bar marks where in the window you are', async () => {
  const cells = bar(pace(fiveHour(30, 2.5), now), 20)
  expect(cells.map(c => c.tone)).toEqual(['fill', 'empty', 'mark', 'empty'])
  expect(cells.map(c => c.text).join('').length).toBe(20)
})
