import type { EngineInterface, Register, SessionContextUsage } from 'claude-code'

const WARN_AT = 80

const compact = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}k` : `${n}`

export const label = (context: SessionContextUsage) => {
  if (context.tokens === undefined) {
    return `ctx – / ${compact(context.window)}`
  }

  const percent = context.percent ?? Math.round((context.tokens / context.window) * 100)

  return `ctx ${percent}% · ${compact(context.tokens)}/${compact(context.window)}`
}

export const register: Register = on => {
  let hasWarned = false

  const show = ($: EngineInterface, context: SessionContextUsage) => {
    $.ui.status(label(context))

    const percent = context.percent ?? 0
    if (percent >= WARN_AT && !hasWarned) {
      hasWarned = true
      $.ui.toast(`Context ${percent}% full — consider /compact`)
    }
    if (percent < WARN_AT) {
      hasWarned = false
    }
  }

  on('session.start', async ($, e, next) => {
    const result = await next(e)
    show($, (await $.session.usage()).context)

    return result
  })

  on('session.measure', ($, e, next) => {
    if (e.changed.includes('context')) {
      show($, e.context)
    }

    return next(e)
  })
}
