import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday as isTodayFns,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths
} from 'date-fns'

export const ISO_FORMAT = 'yyyy-MM-dd'

export function toISODate(date: Date): string {
  return format(date, ISO_FORMAT)
}

export function fromISODate(date: string): Date {
  return parseISO(date)
}

export function todayISO(): string {
  return toISODate(new Date())
}

/** weekStartsOn: 0 = Sunday, 1 = Monday */
export function getMonthGrid(monthDate: Date, weekStartsOn: 0 | 1): Date[] {
  const firstOfMonth = startOfMonth(monthDate)
  const lastOfMonth = endOfMonth(monthDate)
  const gridStart = startOfWeek(firstOfMonth, { weekStartsOn })
  const gridEnd = endOfWeek(lastOfMonth, { weekStartsOn })
  return eachDayOfInterval({ start: gridStart, end: gridEnd })
}

export function getWeekdayLabels(weekStartsOn: 0 | 1): string[] {
  const base = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  if (weekStartsOn === 0) return base
  return [...base.slice(1), base[0]]
}

export function isCurrentMonth(date: Date, monthDate: Date): boolean {
  return isSameMonth(date, monthDate)
}

export function isSameDate(a: Date, b: Date): boolean {
  return isSameDay(a, b)
}

export function isTodayDate(date: Date): boolean {
  return isTodayFns(date)
}

export function nextMonth(monthDate: Date): Date {
  return addMonths(monthDate, 1)
}

export function previousMonth(monthDate: Date): Date {
  return subMonths(monthDate, 1)
}

export function addDaysToDate(date: Date, amount: number): Date {
  return addDays(date, amount)
}

export function formatDayTitle(date: Date): string {
  return format(date, 'EEEE, MMMM d')
}

export function formatMonthTitle(date: Date): string {
  return format(date, 'MMMM yyyy')
}

export function getWeekDays(date: Date, weekStartsOn: 0 | 1): Date[] {
  const start = startOfWeek(date, { weekStartsOn })
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

export function daysUntilLabel(targetISO: string): string {
  const now = new Date()
  const target = fromISODate(targetISO)
  const diffMs = target.setHours(0, 0, 0, 0) - new Date(now).setHours(0, 0, 0, 0)
  const days = Math.round(diffMs / (1000 * 60 * 60 * 24))
  if (days < 0) return 'overdue'
  if (days === 0) return 'today'
  if (days === 1) return 'in 1 day'
  return `in ${days} days`
}
