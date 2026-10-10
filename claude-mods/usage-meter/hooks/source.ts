import type { Reading } from '../types'

type Limit = Reading['rateLimits'][number]

/**
 * The desktop app's usage card, as its `get_usage` tool returns it: windows
 * labelled `5-hour limit`, `Weekly · all models`, `Weekly · <model>`.
 */
type AppPlan = {
  status?: string
  windows?: { label?: string; percentUsed?: number; resetsAt?: string }[]
}

const kindOf = (label: string) => {
  if (/^5-hour/i.test(label)) return 'five_hour'
  const weekly = /^weekly\s*·\s*(.+)$/i.exec(label)
  if (weekly === null) return undefined
  const scope = weekly[1]?.trim() ?? ''

  return /^all models$/i.test(scope) ? 'seven_day' : `seven_day:${scope}`
}

/** The limit windows in a `get_usage` result's JSON text; none when it has no plan. */
export const fromAppUsage = (text: string): Limit[] => {
  let plan: AppPlan | undefined
  try {
    plan = (JSON.parse(text) as { plan?: AppPlan }).plan
  } catch {
    return []
  }
  if (plan?.status !== 'ok') return []

  const limits: Limit[] = []
  for (const window of plan.windows ?? []) {
    const kind = window.label === undefined ? undefined : kindOf(window.label)
    if (kind === undefined || typeof window.percentUsed !== 'number') continue
    limits.push({ kind, percentUsed: window.percentUsed, resetsAt: window.resetsAt })
  }

  return limits
}
