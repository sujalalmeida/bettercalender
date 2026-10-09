import { liveQuery } from 'dexie'
import { useLayoutEffect, useRef } from 'preact/hooks'
import { db } from '../db/db'
import { getInkDatesForRange, getTasksForRange, type TaskViewModel } from '../db/repository'
import {
  formatDayTitle,
  formatMonthTitle,
  fromISODate,
  getMonthGrid,
  getWeekdayLabels,
  isCurrentMonth as isCurrentMonthFn,
  nextMonth,
  previousMonth,
  toISODate
} from '../lib/dates'
import { prefersReducedMotion } from '../lib/flip'
import { useObservable } from '../lib/useObservable'
import { DayCell } from './DayCell'

interface Props {
  currentMonth: Date
  onMonthChange: (date: Date) => void
  weekStartsOn: 0 | 1
  expandedDate: string | null
  onExpand: (dateISO: string, originRect: DOMRect) => void
  onCollapse: () => void
}

export function MonthGrid({ currentMonth, onMonthChange, weekStartsOn, expandedDate, onExpand, onCollapse }: Props) {
  const gridRef = useRef<HTMLDivElement>(null)
  const direction = useRef<1 | -1>(1)
  const swipeStart = useRef<{ x: number; y: number } | null>(null)
  const axisLocked = useRef<'x' | 'y' | null>(null)

  const days = getMonthGrid(currentMonth, weekStartsOn)
  const weekdayLabels = getWeekdayLabels(weekStartsOn)
  const rangeStart = toISODate(days[0])
  const rangeEnd = toISODate(days[days.length - 1])
  const totalRows = Math.ceil(days.length / 7)

  const tasksByDate = useObservable(() => liveQuery(() => getTasksForRange(rangeStart, rangeEnd)), [rangeStart, rangeEnd], {} as Record<string, TaskViewModel[]>)
  const dayRows = useObservable(() => liveQuery(() => db.days.where('date').between(rangeStart, rangeEnd, true, true).toArray()), [rangeStart, rangeEnd], [])
  const inkDates = useObservable(() => liveQuery(() => getInkDatesForRange(rangeStart, rangeEnd)), [rangeStart, rangeEnd], [])
  const categories = useObservable(() => liveQuery(() => db.categories.orderBy('order').toArray()), [], [])
  const categoryById = new Map(categories.map((c) => [c.id, c]))
  const notesByDate = new Map(dayRows.map((d) => [d.date, d.notes]))

  useLayoutEffect(() => {
    const el = gridRef.current
    if (!el || prefersReducedMotion()) return
    el.animate(
      [{ transform: `translateX(${direction.current * 24}px)`, opacity: 0.4 }, { transform: 'none', opacity: 1 }],
      { duration: 220, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMonth.getFullYear(), currentMonth.getMonth()])

  function goNext() {
    direction.current = 1
    onMonthChange(nextMonth(currentMonth))
  }
  function goPrev() {
    direction.current = -1
    onMonthChange(previousMonth(currentMonth))
  }
  function goToday() {
    direction.current = 0 as 1
    onMonthChange(new Date())
  }

  function onPointerDown(e: PointerEvent) {
    if (expandedDate) return
    swipeStart.current = { x: e.clientX, y: e.clientY }
    axisLocked.current = null
  }
  function onPointerMove(e: PointerEvent) {
    if (!swipeStart.current) return
    const dx = e.clientX - swipeStart.current.x
    const dy = e.clientY - swipeStart.current.y
    if (!axisLocked.current && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      axisLocked.current = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
    }
  }
  function onPointerUp(e: PointerEvent) {
    if (!swipeStart.current || axisLocked.current !== 'x') {
      swipeStart.current = null
      axisLocked.current = null
      return
    }
    const dx = e.clientX - swipeStart.current.x
    if (dx < -60) goNext()
    else if (dx > 60) goPrev()
    swipeStart.current = null
    axisLocked.current = null
  }

  function handleTap(dateISO: string, el: HTMLElement) {
    if (expandedDate === dateISO) {
      onCollapse()
      return
    }
    onExpand(dateISO, el.getBoundingClientRect())
  }

  return (
    <div class="month-view">
      <header class="month-header ui-chrome">
        <h1 class="month-title">{formatMonthTitle(currentMonth)}</h1>
        <div class="month-header-actions">
          <button class="icon-btn" aria-label="Previous month" onClick={goPrev}>
            ‹
          </button>
          <button class="today-btn" onClick={goToday}>
            Today
          </button>
          <button class="icon-btn" aria-label="Next month" onClick={goNext}>
            ›
          </button>
        </div>
      </header>

      <div class="weekday-row ui-chrome">
        {weekdayLabels.map((label) => (
          <div class="weekday-label" key={label}>
            {label}
          </div>
        ))}
      </div>

      <div
        class="month-grid"
        role="grid"
        aria-label={formatMonthTitle(currentMonth)}
        ref={gridRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        {Array.from({ length: totalRows }, (_, rowIndex) => <div role="row" class="month-grid-row" key={rowIndex}>
          {days.slice(rowIndex * 7, rowIndex * 7 + 7).map((date) => {
          const dateISO = toISODate(date)
          const isExpanded = expandedDate === dateISO
          const tasks = tasksByDate[dateISO] ?? []
          const notes = notesByDate.get(dateISO) ?? ''

          return (
            <DayCell
              key={dateISO}
              date={date}
              isCurrentMonth={isCurrentMonthFn(date, currentMonth)}
              isExpanded={isExpanded}
              tasks={tasks}
              notes={notes}
              hasInk={inkDates.includes(dateISO)}
              categoryById={categoryById}
              onTap={handleTap}
            />
          )
          })}
        </div>)}
      </div>
      <span class="visually-hidden" aria-live="polite">
        {expandedDate ? `Expanded ${formatDayTitle(fromISODate(expandedDate))}` : 'Collapsed day view'}
      </span>
    </div>
  )
}
