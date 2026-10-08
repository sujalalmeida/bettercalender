import { describe, expect, it } from 'vitest'
import { expandRecurrence } from './recurrence'
import type { Recurrence } from '../db/types'

function makeRec(overrides: Partial<Recurrence>): Recurrence {
  return {
    id: 'r1',
    title: 'Test',
    startDate: '2026-01-01',
    exceptions: [],
    rule: { frequency: 'daily' },
    ...overrides
  }
}

describe('expandRecurrence', () => {
  it('expands a daily recurrence across the range', () => {
    const rec = makeRec({ startDate: '2026-01-01', rule: { frequency: 'daily' } })
    const dates = expandRecurrence(rec, '2026-01-01', '2026-01-05')
    expect(dates).toEqual(['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04', '2026-01-05'])
  })

  it('only includes weekdays for the weekdays rule', () => {
    // 2026-01-01 is a Thursday
    const rec = makeRec({ startDate: '2026-01-01', rule: { frequency: 'weekdays' } })
    const dates = expandRecurrence(rec, '2026-01-01', '2026-01-07')
    expect(dates).toEqual(['2026-01-01', '2026-01-02', '2026-01-05', '2026-01-06', '2026-01-07'])
  })

  it('respects selected days for the weekly rule', () => {
    // Mondays (1) and Wednesdays (3)
    const rec = makeRec({ startDate: '2026-01-01', rule: { frequency: 'weekly', daysOfWeek: [1, 3] } })
    const dates = expandRecurrence(rec, '2026-01-01', '2026-01-14')
    expect(dates).toEqual(['2026-01-05', '2026-01-07', '2026-01-12', '2026-01-14'])
  })

  it('repeats on the same day-of-month for the monthly rule', () => {
    const rec = makeRec({ startDate: '2026-01-15', rule: { frequency: 'monthly' } })
    const dates = expandRecurrence(rec, '2026-01-01', '2026-03-31')
    expect(dates).toEqual(['2026-01-15', '2026-02-15', '2026-03-15'])
  })

  it('repeats every N days for the custom rule', () => {
    const rec = makeRec({ startDate: '2026-01-01', rule: { frequency: 'custom', intervalDays: 3 } })
    const dates = expandRecurrence(rec, '2026-01-01', '2026-01-10')
    expect(dates).toEqual(['2026-01-01', '2026-01-04', '2026-01-07', '2026-01-10'])
  })

  it('excludes dates listed as exceptions', () => {
    const rec = makeRec({ startDate: '2026-01-01', rule: { frequency: 'daily' }, exceptions: ['2026-01-03'] })
    const dates = expandRecurrence(rec, '2026-01-01', '2026-01-05')
    expect(dates).not.toContain('2026-01-03')
    expect(dates).toHaveLength(4)
  })

  it('stops at endDate', () => {
    const rec = makeRec({ startDate: '2026-01-01', endDate: '2026-01-03', rule: { frequency: 'daily' } })
    const dates = expandRecurrence(rec, '2026-01-01', '2026-01-10')
    expect(dates).toEqual(['2026-01-01', '2026-01-02', '2026-01-03'])
  })

  it('does not include occurrences before startDate even if the range starts earlier', () => {
    const rec = makeRec({ startDate: '2026-01-05', rule: { frequency: 'daily' } })
    const dates = expandRecurrence(rec, '2026-01-01', '2026-01-07')
    expect(dates).toEqual(['2026-01-05', '2026-01-06', '2026-01-07'])
  })

  it('returns an empty array when the range is entirely outside the recurrence window', () => {
    const rec = makeRec({ startDate: '2026-01-01', endDate: '2026-01-05', rule: { frequency: 'daily' } })
    const dates = expandRecurrence(rec, '2026-02-01', '2026-02-28')
    expect(dates).toEqual([])
  })
})
