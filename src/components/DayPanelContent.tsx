import { liveQuery } from 'dexie'
import { useState } from 'preact/hooks'
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
  const [inkHeader, setInkHeader] = useState<HTMLSpanElement | null>(null)

  const day = useObservable(() => liveQuery(() => db.days.get(dateISO)), [dateISO], undefined)
  const tasks = useObservable(() => liveQuery(() => getTasksForRange(dateISO, dateISO)), [dateISO], {} as Record<string, unknown>)
  const categories = useObservable(() => liveQuery(() => db.categories.orderBy('order').toArray()), [], [])
  const templates = useObservable(() => liveQuery(() => db.templates.toArray()), [], [])

  const dayTasks = (tasks[dateISO] ?? []) as Awaited<ReturnType<typeof getTasksForRange>>[string]
  const doneCount = dayTasks.filter((t) => t.done).length

  return (
    <div class="day-panel">
      <header class="day-panel-header" onClick={e => { if (!(e.target as HTMLElement).closest('button')) onClose() }}>
        <div class="day-panel-navigation">
          <button class="day-panel-nav" aria-label="Previous day" onClick={() => onNavigateDay(-1)}>‹</button>
          <button class="day-panel-nav" aria-label="Next day" onClick={() => onNavigateDay(1)}>›</button>
        </div>
        <div class="day-panel-title-group">
          <div class="planner-eyebrow">Day notebook{dayTasks.length > 0 && <span class="day-panel-subtitle"> · {doneCount}/{dayTasks.length} done</span>}</div>
          <h2 class="day-panel-title">{formatDayTitle(fromISODate(dateISO))}</h2>
        </div>
        <div class="day-panel-actions">
          <span ref={setInkHeader} />
          <button class="day-panel-close" aria-label="Collapse day" onClick={onClose}>✓ <span>Done</span></button>
          <button class="day-panel-nav day-panel-dismiss" aria-label="Close notebook" onClick={onClose}>×</button>
        </div>
      </header>

      <div class="day-panel-body scroll-panel">
        <div class="day-notebook">
          <section class="day-panel-handwriting" aria-label="Apple Pencil whiteboard">
            <div class="notebook-section-title"><span class="planner-eyebrow">Write</span><h3>Whiteboard</h3></div>
            {InkEditor ? <InkEditor key={dateISO} dateISO={dateISO} expandControl={inkHeader} /> : <div class="ink-loading">Preparing handwriting…</div>}
          </section>
          <section class="day-panel-text-notes" aria-label="Typed notes">
            <div class="notebook-section-title"><span class="planner-eyebrow">Capture</span><h3>Notes</h3></div>
            <NotesEditor key={dateISO} dateISO={dateISO} initialNotes={day?.notes ?? ''} />
          </section>
        </div>

        <aside class="day-checklist" aria-label="Day checklist">
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
        </aside>
      </div>
    </div>
  )
}
