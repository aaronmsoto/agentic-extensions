import { expect, test } from 'claude-code/testing'

import { detail, filledOf, levelOf, percentOf } from './fill'

test('levels follow how full the window is', async () => {
  expect(levelOf(30)).toBe('green')
  expect(levelOf(65)).toBe('yellow')
  expect(levelOf(85)).toBe('orange')
  expect(levelOf(97)).toBe('red')
})

test('no reading before the first reply', async () => {
  expect(percentOf({ window: 200_000 })).toBe(undefined)
})

test('detail and bar read the fill', async () => {
  expect(detail({ tokens: 84_000, window: 200_000, percent: 42 }, 42)).toBe('42% · 84k of 200k tokens')
  expect(filledOf(42, 20)).toBe(8)
})
