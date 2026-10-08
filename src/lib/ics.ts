export type ReminderLeadTime = 'at-time' | '10-min' | '1-hour' | '1-day'

export const LEAD_TIME_LABELS: Record<ReminderLeadTime, string> = {
  'at-time': 'At time of event',
  '10-min': '10 minutes before',
  '1-hour': '1 hour before',
  '1-day': '1 day before'
}

function leadTimeToTrigger(lead: ReminderLeadTime): string {
  switch (lead) {
    case 'at-time':
      return 'PT0S'
    case '10-min':
      return '-PT10M'
    case '1-hour':
      return '-PT1H'
    case '1-day':
      return '-P1D'
  }
}

/** Escapes text per RFC 5545 §3.3.11. */
function escapeText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

/** Folds a content line to 75 octets per RFC 5545 §3.1, continuation lines prefixed with a space. */
function foldLine(line: string): string {
  const encoder = new TextEncoder()
  let result = ''
  let octets = 0
  for (const char of line) {
    const width = encoder.encode(char).length
    if (octets + width > 75) {
      result += '\r\n '
      octets = 1
    }
    result += char
    octets += width
  }
  return result
}

function formatUTCStamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
}

export interface ICSEventInput {
  uid: string
  title: string
  description?: string
  date: string // YYYY-MM-DD
  time?: string // HH:mm, omit for an all-day event
  leadTime: ReminderLeadTime
  now?: Date
}

export function buildICS(input: ICSEventInput): string {
  const now = input.now ?? new Date()
  const dtstamp = formatUTCStamp(now)

  let dtstart: string
  if (input.time) {
    const [hh, mm] = input.time.split(':')
    dtstart = `DTSTART:${input.date.replace(/-/g, '')}T${hh.padStart(2, '0')}${mm.padStart(2, '0')}00`
  } else {
    dtstart = `DTSTART;VALUE=DATE:${input.date.replace(/-/g, '')}`
  }

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Plan//Calendar//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${input.uid}`,
    `DTSTAMP:${dtstamp}`,
    dtstart,
    `SUMMARY:${escapeText(input.title)}`,
    ...(input.description ? [`DESCRIPTION:${escapeText(input.description)}`] : []),
    'BEGIN:VALARM',
    `TRIGGER:${leadTimeToTrigger(input.leadTime)}`,
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeText(input.title)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR'
  ]

  return lines.map(foldLine).join('\r\n') + '\r\n'
}

export function downloadICS(filename: string, icsContent: string): void {
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.ics') ? filename : `${filename}.ics`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
