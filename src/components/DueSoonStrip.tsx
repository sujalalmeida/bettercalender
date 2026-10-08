import { liveQuery } from 'dexie'
import { db } from '../db/db'
import { getDueSoon } from '../db/repository'
import { daysUntilLabel } from '../lib/dates'
import { useObservable } from '../lib/useObservable'

interface Props {
  onJumpToDate: (dateISO: string) => void
}

export function DueSoonStrip({ onJumpToDate }: Props) {
  const dueSoon = useObservable(() => liveQuery(() => getDueSoon(5)), [], [])
  const categories = useObservable(() => liveQuery(() => db.categories.toArray()), [], [])
  const categoryById = new Map(categories.map((c) => [c.id, c]))

  if (dueSoon.length === 0) return null

  return (
    <div class="due-soon-strip ui-chrome scroll-panel" role="region" aria-label="Due soon">
      {dueSoon.map((task) => {
        const category = task.categoryId ? categoryById.get(task.categoryId) : undefined
        const isExam = category?.id === 'exam'
        return (
          <button class="due-soon-chip" key={task.id} onClick={() => onJumpToDate(task.date)}>
            <span class="due-soon-title">{task.title}</span>
            <span class="due-soon-when">{isExam ? `${daysUntilLabel(task.date)} · Exam` : daysUntilLabel(task.date)}</span>
          </button>
        )
      })}
    </div>
  )
}
