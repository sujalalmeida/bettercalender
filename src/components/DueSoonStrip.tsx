import { liveQuery } from 'dexie'
import { db } from '../db/db'
import { getDueSoon } from '../db/repository'
import { daysUntilLabel } from '../lib/dates'
import { useObservable } from '../lib/useObservable'
import { CategoryDot } from './CategoryDot'

interface Props {
  onJumpToDate: (dateISO: string) => void
  card?: boolean
}

export function DueSoonStrip({ onJumpToDate, card = false }: Props) {
  const dueSoon = useObservable(() => liveQuery(() => getDueSoon(5)), [], [])
  const categories = useObservable(() => liveQuery(() => db.categories.toArray()), [], [])
  const categoryById = new Map(categories.map((c) => [c.id, c]))

  if (dueSoon.length === 0) return null

  return (
    <div class={card ? 'timeline-summary-card timeline-due-soon' : 'due-soon-strip ui-chrome scroll-panel'} role="region" aria-label="Due soon">
      {card && <h2 class="planner-eyebrow">Due soon</h2>}
      {dueSoon.map((task) => {
        const category = task.categoryId ? categoryById.get(task.categoryId) : undefined
        const isExam = category?.id === 'exam'
        return (
          <button class="due-soon-chip" key={task.id} onClick={() => onJumpToDate(task.date)}>
            {card && <CategoryDot color={category?.color ?? 'var(--color-text-tertiary)'} size={9} />}
            <span class="due-soon-title">{task.title}</span>
            <span class="due-soon-when">{isExam ? `${daysUntilLabel(task.date)} · Exam` : daysUntilLabel(task.date)}</span>
          </button>
        )
      })}
    </div>
  )
}
