import type { EngineInterface, Register, SessionCost, SessionRateLimit } from 'claude-code'

const WARN_AT = 90
const NAMES: Record<string, string> = { five_hour: '5h', seven_day: '7d', spend_limit: 'spend' }

const until = (resetsAt: string | undefined, now: number) => {
  if (resetsAt === undefined) {
    return ''
  }

  const minutes = Math.max(0, Math.round((Date.parse(resetsAt) - now) / 60_000))
  if (Number.isNaN(minutes)) {
    return ''
  }

  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)

  return ` ↻${days > 0 ? `${days}d${hours}h` : hours > 0 ? `${hours}h${minutes % 60}m` : `${minutes}m`}`
}

export const label = (rateLimits: SessionRateLimit[], cost: SessionCost | undefined, now: number) => {
  const parts = rateLimits.map(
    limit => `${NAMES[limit.kind] ?? limit.kind} ${Math.round(limit.percentUsed)}%${until(limit.resetsAt, now)}`,
  )
  if (cost !== undefined && cost.usd > 0) {
    parts.push(`$${cost.usd.toFixed(2)}`)
  }

  return parts.length > 0 ? `usage ${parts.join(' · ')}` : undefined
}

export const register: Register = on => {
  const warned = new Set<string>()

  const show = async (
    $: EngineInterface,
    rateLimits: SessionRateLimit[],
    cost: SessionCost | undefined,
  ) => {
    $.ui.status(label(rateLimits, cost, await $.clock.now()))

    for (const limit of rateLimits) {
      if (limit.percentUsed >= WARN_AT && !warned.has(limit.kind)) {
        warned.add(limit.kind)
        $.ui.toast(`${NAMES[limit.kind] ?? limit.kind} limit ${Math.round(limit.percentUsed)}% used`)
      }
      if (limit.percentUsed < WARN_AT) {
        warned.delete(limit.kind)
      }
    }
  }

  on('session.start', async ($, e, next) => {
    const result = await next(e)
    const usage = await $.session.usage()
    await show($, usage.rateLimits, usage.cost)

    return result
  })

  on('session.measure', async ($, e, next) => {
    await show($, e.rateLimits, e.cost)

    return next(e)
  })
}
