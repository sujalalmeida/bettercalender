import { liveQuery } from 'dexie'
import { db } from '../db/db'
import { getInkDatesForRange, getTasksForRange, type TaskViewModel } from '../db/repository'
import { addDaysToDate, formatDayTitle, getWeekDays, isTodayDate, toISODate } from '../lib/dates'
import { useObservable } from '../lib/useObservable'
import { CategoryDot } from './CategoryDot'
import { useEffect, useState } from 'preact/hooks'
import { getInkReadingState, subscribeInkReading } from '../lib/inkTranscription'

interface Props {
  anchorDate: Date
  onAnchorChange: (date: Date) => void
  weekStartsOn: 0 | 1
  onExpand: (dateISO: string, originRect: DOMRect) => void
}

export function WeekView({ anchorDate, onAnchorChange, weekStartsOn, onExpand }: Props) {
  const days = getWeekDays(anchorDate, weekStartsOn)
  const rangeStart = toISODate(days[0])
  const rangeEnd = toISODate(days[days.length - 1])
  const rangeLabel = [days[0], days[6]]
    .map(day => day.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }))
    .join(' — ')

  const tasksByDate = useObservable(() => liveQuery(() => getTasksForRange(rangeStart, rangeEnd)), [rangeStart, rangeEnd], {} as Record<string, TaskViewModel[]>)
  const categories = useObservable(() => liveQuery(() => db.categories.orderBy('order').toArray()), [], [])
  const inkDates = useObservable(() => liveQuery(() => getInkDatesForRange(rangeStart, rangeEnd)), [rangeStart, rangeEnd], [])
  const dayRows = useObservable(() => liveQuery(() => db.days.where('date').between(rangeStart, rangeEnd, true, true).toArray()), [rangeStart, rangeEnd], [])
  const daysByDate = new Map(dayRows.map(day => [day.date, day]))
  const [, setInkReadingVersion] = useState(0)
  useEffect(() => subscribeInkReading(() => setInkReadingVersion(version => version + 1)), [])
  const categoryById = new Map(categories.map((c) => [c.id, c]))

  return (
    <div class="week-view">
      <header class="week-heading ui-chrome">
        <div>
          <span class="planner-eyebrow">Weekly view</span>
          <h1>{rangeLabel}</h1>
        </div>
        <div class="month-header-actions">
          <button class="icon-btn" aria-label="Previous week" onClick={() => onAnchorChange(addDaysToDate(anchorDate, -7))}>
            ‹
          </button>
          <button class="today-btn" onClick={() => onAnchorChange(new Date())}>
            This week
          </button>
          <button class="icon-btn" aria-label="Next week" onClick={() => onAnchorChange(addDaysToDate(anchorDate, 7))}>
            ›
          </button>
        </div>
      </header>

      <div class="week-list scroll-panel">
        {days.map((date) => {
          const dateISO = toISODate(date)
          const tasks = tasksByDate[dateISO] ?? []
          const doneCount = tasks.filter((t) => t.done).length
          const inkText = daysByDate.get(dateISO)?.inkText?.trim() ?? ''
          const notes = daysByDate.get(dateISO)?.notes?.trim() ?? ''
          const reading = getInkReadingState(dateISO) === 'reading'
          const today = isTodayDate(date)

          return (
            <button
              type="button"
              class={`week-day-card ${today ? 'is-today' : ''}`}
              aria-label={`Open ${formatDayTitle(date)}`}
              aria-describedby={`week-day-${dateISO}`}
              aria-current={today ? 'date' : undefined}
              key={dateISO}
              onClick={(e) => onExpand(dateISO, (e.currentTarget as HTMLElement).getBoundingClientRect())}
            >
              <span class="week-day-card-header">
                <span class="planner-eyebrow">{date.toLocaleDateString(undefined, { weekday: 'long' })}</span>
                <span class="week-day-card-title">{date.getDate()}</span>
              </span>
              <span class="week-open-day" aria-hidden="true">＋</span>
              <span id={`week-day-${dateISO}`} class="week-day-content">
                <span class="week-day-card-meta">
                  {inkDates.includes(dateISO) && <span aria-label="Pencil note">✎</span>}
                  {tasks.length > 0 && (
                    <span class="day-panel-subtitle">
                      {doneCount}/{tasks.length}
                    </span>
                  )}
                </span>
                {reading && <span class="week-day-card-note day-cell-reading" aria-label="Reading handwriting"><span>Reading handwriting</span></span>}
                {(inkText || inkDates.includes(dateISO) && !reading) && <span class="week-day-card-note">{inkText || 'Open to convert note'}</span>}
                {notes && <span class="week-day-card-note">{notes}</span>}
                <span class="week-day-card-tasks">
                  {tasks.map((t) => (
                    <span key={t.id} class={`week-task ${t.done ? 'is-done' : ''}`}>
                      {t.categoryId && categoryById.get(t.categoryId) && <CategoryDot color={categoryById.get(t.categoryId)!.color} />}
                      <span>{t.title}</span>
                      {t.time && <span class="task-row-time">{t.time}</span>}
                    </span>
                  ))}
                  {tasks.length === 0 && !notes && !inkText && !inkDates.includes(dateISO) && <span class="week-day-card-empty">No entries</span>}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
