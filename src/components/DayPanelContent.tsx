import { liveQuery } from 'dexie'
import { db } from '../db/db'
import { applyTemplate, getTasksForRange } from '../db/repository'
import { fromISODate, formatDayTitle } from '../lib/dates'
import { useObservable } from '../lib/useObservable'
import { useSettings } from '../lib/settingsStore'
import { useLazyComponent } from '../lib/useLazyComponent'
import { NotesEditor } from './NotesEditor'
import { Checklist } from './Checklist'

interface Props {
  dateISO: string
  onNavigateDay: (delta: 1 | -1) => void
  onClose: () => void
}

export function DayPanelContent({ dateISO, onNavigateDay, onClose }: Props) {
  const settings = useSettings()
  const InkEditor = useLazyComponent(() => import('./InkEditor'), true)

  const day = useObservable(() => liveQuery(() => db.days.get(dateISO)), [dateISO], undefined)
  const tasks = useObservable(() => liveQuery(() => getTasksForRange(dateISO, dateISO)), [dateISO], {} as Record<string, unknown>)
  const categories = useObservable(() => liveQuery(() => db.categories.orderBy('order').toArray()), [], [])
  const templates = useObservable(() => liveQuery(() => db.templates.toArray()), [], [])

  const dayTasks = (tasks[dateISO] ?? []) as Awaited<ReturnType<typeof getTasksForRange>>[string]
  const doneCount = dayTasks.filter((t) => t.done).length

  return (
    <div class="day-panel">
      <header class="day-panel-header" onClick={e => { if (!(e.target as HTMLElement).closest('button')) onClose() }}>
        <button class="day-panel-nav" aria-label="Previous day" onClick={() => onNavigateDay(-1)}>
          ‹
        </button>
        <div class="day-panel-title-group">
          <h2 class="day-panel-title">{formatDayTitle(fromISODate(dateISO))}</h2>
          {dayTasks.length > 0 && (
            <span class="day-panel-subtitle">
              {doneCount}/{dayTasks.length} done
            </span>
          )}
        </div>
        <button class="day-panel-nav" aria-label="Next day" onClick={() => onNavigateDay(1)}>
          ›
        </button>
        <button class="day-panel-close" aria-label="Collapse day" onClick={onClose}>
          Done
        </button>
      </header>

      <div class="day-panel-body scroll-panel">
        <section class="day-panel-handwriting" aria-label="Apple Pencil whiteboard">
          {InkEditor ? <InkEditor key={dateISO} dateISO={dateISO} /> : <div class="ink-loading">Preparing handwriting…</div>}
        </section>
        <section class="day-panel-text-notes" aria-label="Typed notes">
          <h3>Typed notes</h3>
          <NotesEditor key={dateISO} dateISO={dateISO} initialNotes={day?.notes ?? ''} />
        </section>

        <Checklist dateISO={dateISO} tasks={dayTasks} categories={categories} defaultLeadTime={settings.reminderLeadTime} />

        {templates.length > 0 && (
          <div class="template-row">
            {templates.map((t) => (
              <button key={t.id} class="chip-btn" onClick={() => applyTemplate(dateISO, t)}>
                + {t.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
