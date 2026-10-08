import { differenceInCalendarDays, getDate, getDay, isAfter, isBefore } from 'date-fns'
import { fromISODate, toISODate } from './dates'
import type { Recurrence } from '../db/types'

/**
 * Expands a recurrence rule into concrete occurrence dates (YYYY-MM-DD)
 * within [rangeStartISO, rangeEndISO], inclusive. Occurrences are computed
 * on the fly rather than stored, so a recurrence is a single row regardless
 * of how many months it spans.
 */
export function expandRecurrence(rec: Recurrence, rangeStartISO: string, rangeEndISO: string): string[] {
  const rangeStart = fromISODate(rangeStartISO)
  const rangeEnd = fromISODate(rangeEndISO)
  const recStart = fromISODate(rec.startDate)
  const recEnd = rec.endDate ? fromISODate(rec.endDate) : null

  const windowStart = isAfter(recStart, rangeStart) ? recStart : rangeStart
  const windowEnd = recEnd && isBefore(recEnd, rangeEnd) ? recEnd : rangeEnd

  if (isAfter(windowStart, windowEnd)) return []

  const exceptionSet = new Set(rec.exceptions)
  const occurrences: string[] = []
  const totalDays = differenceInCalendarDays(windowEnd, windowStart)

  for (let i = 0; i <= totalDays; i++) {
    const day = new Date(windowStart)
    day.setDate(day.getDate() + i)
    if (isBefore(day, recStart)) continue
    if (recEnd && isAfter(day, recEnd)) continue

    if (matchesRule(rec, day, recStart)) {
      const iso = toISODate(day)
      if (!exceptionSet.has(iso)) occurrences.push(iso)
    }
  }

  return occurrences
}

function matchesRule(rec: Recurrence, day: Date, recStart: Date): boolean {
  switch (rec.rule.frequency) {
    case 'daily':
      return true
    case 'weekdays': {
      const dow = getDay(day)
      return dow >= 1 && dow <= 5
    }
    case 'weekly':
      return (rec.rule.daysOfWeek ?? []).includes(getDay(day))
    case 'monthly':
      return getDate(day) === getDate(recStart)
    case 'custom': {
      const interval = rec.rule.intervalDays ?? 1
      const diff = differenceInCalendarDays(day, recStart)
      return diff >= 0 && diff % interval === 0
    }
    default:
      return false
  }
}
