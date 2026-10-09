import { liveQuery } from 'dexie'
import { db } from '../db/db'
import { getInkDatesForRange, getTasksForRange, type TaskViewModel } from '../db/repository'
import { addDaysToDate, formatDayTitle, getWeekDays, isTodayDate, toISODate } from '../lib/dates'
import { useObservable } from '../lib/useObservable'
import { CategoryDot } from './CategoryDot'

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

  const tasksByDate = useObservable(() => liveQuery(() => getTasksForRange(rangeStart, rangeEnd)), [rangeStart, rangeEnd], {} as Record<string, TaskViewModel[]>)
  const categories = useObservable(() => liveQuery(() => db.categories.orderBy('order').toArray()), [], [])
  const inkDates = useObservable(() => liveQuery(() => getInkDatesForRange(rangeStart, rangeEnd)), [rangeStart, rangeEnd], [])
  const categoryById = new Map(categories.map((c) => [c.id, c]))

  return (
    <div class="week-view">
      <header class="month-header ui-chrome">
        <h1 class="month-title">{formatDayTitle(days[0])} – {formatDayTitle(days[6])}</h1>
        <div class="month-header-actions">
          <button class="icon-btn" aria-label="Previous week" onClick={() => onAnchorChange(addDaysToDate(anchorDate, -7))}>
            ‹
          </button>
          <button class="today-btn" onClick={() => onAnchorChange(new Date())}>
            Today
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

          return (
            <button
              type="button"
              class={`week-day-card ${isTodayDate(date) ? 'is-today' : ''}`}
              key={dateISO}
              onClick={(e) => onExpand(dateISO, (e.currentTarget as HTMLElement).getBoundingClientRect())}
            >
              <div class="week-day-card-header">
                <span class="week-day-card-title">{formatDayTitle(date)}</span>
                {inkDates.includes(dateISO) && <span aria-label="Handwritten notes">✎</span>}
                {tasks.length > 0 && (
                  <span class="day-panel-subtitle">
                    {doneCount}/{tasks.length}
                  </span>
                )}
              </div>
              <ul class="week-day-card-tasks">
                {tasks.slice(0, 5).map((t) => (
                  <li key={t.id} class={t.done ? 'is-done' : ''}>
                    {t.categoryId && categoryById.get(t.categoryId) && <CategoryDot color={categoryById.get(t.categoryId)!.color} />}
                    <span>{t.title}</span>
                    {t.time && <span class="task-row-time">{t.time}</span>}
                  </li>
                ))}
                {tasks.length === 0 && <li class="week-day-card-empty">Nothing planned</li>}
              </ul>
            </button>
          )
        })}
      </div>
    </div>
  )
}
