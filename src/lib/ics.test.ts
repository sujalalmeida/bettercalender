import { describe, expect, it } from 'vitest'
import { buildICS } from './ics'

const FIXED_NOW = new Date('2026-01-01T12:00:00.000Z')

describe('buildICS', () => {
  it('produces a valid VEVENT with a timed DTSTART and VALARM', () => {
    const ics = buildICS({
      uid: 'abc-123@plan.app',
      title: 'Step 1 prep exam',
      date: '2026-03-15',
      time: '09:30',
      leadTime: '1-day',
      now: FIXED_NOW
    })

    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).toContain('END:VCALENDAR')
    expect(ics).toContain('BEGIN:VEVENT')
    expect(ics).toContain('UID:abc-123@plan.app')
    expect(ics).toContain('DTSTAMP:20260101T120000Z')
    expect(ics).toContain('DTSTART:20260315T093000')
    expect(ics).toContain('SUMMARY:Step 1 prep exam')
    expect(ics).toContain('BEGIN:VALARM')
    expect(ics).toContain('TRIGGER:-P1D')
    expect(ics).toContain('ACTION:DISPLAY')
    // Lines must be CRLF-terminated per RFC 5545.
    expect(ics.includes('\r\n')).toBe(true)
  })

  it('produces an all-day DTSTART when no time is given', () => {
    const ics = buildICS({ uid: 'u2@plan.app', title: 'Deadline', date: '2026-04-01', leadTime: 'at-time', now: FIXED_NOW })
    expect(ics).toContain('DTSTART;VALUE=DATE:20260401')
    expect(ics).toContain('TRIGGER:PT0S')
  })

  it('escapes special characters in text fields', () => {
    const ics = buildICS({
      uid: 'u3@plan.app',
      title: 'Exam; review, notes\nfollow-up',
      date: '2026-04-01',
      leadTime: '10-min',
      now: FIXED_NOW
    })
    expect(ics).toContain('SUMMARY:Exam\\; review\\, notes\\nfollow-up')
  })

  it('folds lines longer than 75 octets', () => {
    const longTitle = 'A'.repeat(120)
    const ics = buildICS({ uid: 'u4@plan.app', title: longTitle, date: '2026-04-01', leadTime: '1-hour', now: FIXED_NOW })
    const lines = ics.split('\r\n')
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(75)
    }
    // Continuation lines start with a space per RFC 5545 §3.1.
    expect(lines.some((l) => l.startsWith(' '))).toBe(true)
  })
})
