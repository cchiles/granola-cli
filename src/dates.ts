export const DATE_SHORTCUTS: Record<string, () => { after: string; before: string }> = {
  today: () => {
    const d = new Date()
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate())
    const end = new Date(start.getTime() + 86400000)
    return { after: start.toISOString(), before: end.toISOString() }
  },
  yesterday: () => {
    const d = new Date()
    const end = new Date(d.getFullYear(), d.getMonth(), d.getDate())
    const start = new Date(end.getTime() - 86400000)
    return { after: start.toISOString(), before: end.toISOString() }
  },
  this_week: () => {
    const d = new Date()
    const day = d.getDay()
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day)
    const end = new Date(start.getTime() + 7 * 86400000)
    return { after: start.toISOString(), before: end.toISOString() }
  },
  last_week: () => {
    const d = new Date()
    const day = d.getDay()
    const thisWeekStart = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day)
    const start = new Date(thisWeekStart.getTime() - 7 * 86400000)
    return { after: start.toISOString(), before: thisWeekStart.toISOString() }
  },
  this_month: () => {
    const d = new Date()
    const start = new Date(d.getFullYear(), d.getMonth(), 1)
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 1)
    return { after: start.toISOString(), before: end.toISOString() }
  },
  last_month: () => {
    const d = new Date()
    const start = new Date(d.getFullYear(), d.getMonth() - 1, 1)
    const end = new Date(d.getFullYear(), d.getMonth(), 1)
    return { after: start.toISOString(), before: end.toISOString() }
  },
}

export const DATE_RANGE_VALUES = Object.keys(DATE_SHORTCUTS).join(", ")

const RELATIVE_PATTERN = /^(\d+)([dwm])$/

function resolveRelativeRange(input: string): { after: string; before: string } | null {
  const match = input.match(RELATIVE_PATTERN)
  if (!match) return null
  const count = parseInt(match[1], 10)
  const unit = match[2]
  const now = new Date()
  const start = new Date(now)

  if (unit === "d") {
    start.setDate(start.getDate() - count)
  } else if (unit === "w") {
    start.setDate(start.getDate() - count * 7)
  } else if (unit === "m") {
    start.setMonth(start.getMonth() - count)
  }

  return { after: start.toISOString(), before: now.toISOString() }
}

export function resolveDateRange(input: string): { after: string; before: string } | null {
  return DATE_SHORTCUTS[input]?.() ?? resolveRelativeRange(input) ?? null
}
