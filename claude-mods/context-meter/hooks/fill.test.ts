import { expect, test } from 'claude-code/testing'

import { detail, filledOf, levelOf, percentOf, segments, splitDetail } from './fill'

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

test('the fill splits into cache read, cache written and new input', async () => {
  const split = { cacheRead: 160_000, cacheWrite: 20_000, uncached: 20_000 }
  const cells = segments(50, split, 20)
  expect(cells.map(c => [c.tone, c.text.length])).toEqual([
    ['read', 8],
    ['write', 1],
    ['new', 1],
    ['empty', 10],
  ])
  expect(splitDetail(split)).toBe('█ cached 160k  ▓ written 20k  ▒ new 20k')
})

test('with no split yet, the fill is one part', async () => {
  expect(segments(42, null, 20).map(c => c.tone)).toEqual(['read', 'empty'])
})
