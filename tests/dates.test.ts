import { describe, it, expect } from "bun:test"
import { resolveDateRange } from "../src/dates"

describe("date shortcuts", () => {
  it("today returns start and end of current day", () => {
    const range = resolveDateRange("today")!
    const after = new Date(range.after)
    const before = new Date(range.before)
    expect(before.getTime() - after.getTime()).toBe(86400000)
    expect(after.getHours()).toBe(0)
    expect(after.getMinutes()).toBe(0)
  })

  it("yesterday returns the previous day", () => {
    const range = resolveDateRange("yesterday")!
    const after = new Date(range.after)
    const before = new Date(range.before)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    expect(before.getTime()).toBe(today.getTime())
    expect(before.getTime() - after.getTime()).toBe(86400000)
  })

  it("last_week returns 7-day range ending at this week's start", () => {
    const range = resolveDateRange("last_week")!
    const after = new Date(range.after)
    const before = new Date(range.before)
    expect(before.getTime() - after.getTime()).toBe(7 * 86400000)
    expect(before.getDay()).toBe(0) // Sunday = start of week
  })

  it("2d returns a 2-day range ending now", () => {
    const range = resolveDateRange("2d")!
    const after = new Date(range.after)
    const before = new Date(range.before)
    const diffMs = before.getTime() - after.getTime()
    expect(diffMs).toBeGreaterThanOrEqual(2 * 86400000 - 1000)
    expect(diffMs).toBeLessThanOrEqual(2 * 86400000 + 1000)
  })

  it("3w returns a 3-week range ending now", () => {
    const range = resolveDateRange("3w")!
    const after = new Date(range.after)
    const before = new Date(range.before)
    const diffMs = before.getTime() - after.getTime()
    expect(diffMs).toBeGreaterThanOrEqual(21 * 86400000 - 1000)
    expect(diffMs).toBeLessThanOrEqual(21 * 86400000 + 1000)
  })

  it("2m returns a ~2-month range ending now", () => {
    const range = resolveDateRange("2m")!
    const after = new Date(range.after)
    const before = new Date(range.before)
    const expected = new Date(before)
    expected.setMonth(expected.getMonth() - 2)
    expect(after.getTime()).toBe(expected.getTime())
  })

  it("returns null for unknown shortcuts", () => {
    expect(resolveDateRange("next_year")).toBeNull()
  })
})
