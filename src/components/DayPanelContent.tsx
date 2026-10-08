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
  compact?: boolean
}

export function DayPanelContent({ dateISO, onNavigateDay, onClose, compact }: Props) {
  const settings = useSettings()
  const [showInk, setShowInk] = useState(false)
  const InkEditor = useLazyComponent(() => import('./InkEditor'), showInk)

  const day = useObservable(() => liveQuery(() => db.days.get(dateISO)), [dateISO], undefined)
  const tasks = useObservable(() => liveQuery(() => getTasksForRange(dateISO, dateISO)), [dateISO], {} as Record<string, unknown>)
  const categories = useObservable(() => liveQuery(() => db.categories.orderBy('order').toArray()), [], [])
  const templates = useObservable(() => liveQuery(() => db.templates.toArray()), [], [])
  const ink = useObservable(() => liveQuery(() => db.ink.get(dateISO)), [dateISO], undefined)

  const dayTasks = (tasks[dateISO] ?? []) as Awaited<ReturnType<typeof getTasksForRange>>[string]
  const doneCount = dayTasks.filter((t) => t.done).length

  return (
    <div class={`day-panel ${compact ? 'day-panel-compact' : ''}`}>
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
        <NotesEditor key={dateISO} dateISO={dateISO} initialNotes={day?.notes ?? ''} />

        <button class="handwrite-entry" onClick={() => setShowInk(true)}>
          <span aria-hidden="true">✎</span>
          <span><strong>Handwrite with Apple Pencil</strong><small>{ink?.pages.some(page => page.strokes.length) ? `${ink.pages.length} handwritten page${ink.pages.length === 1 ? '' : 's'}` : 'Open a blank handwriting page'}</small></span>
          <span aria-hidden="true">›</span>
        </button>

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
      {showInk && InkEditor && <InkEditor dateISO={dateISO} onClose={() => setShowInk(false)} />}
    </div>
  )
}
