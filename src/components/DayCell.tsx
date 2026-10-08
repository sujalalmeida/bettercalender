import type { TaskViewModel } from '../db/repository'
import type { Category } from '../db/types'
import { toISODate, isTodayDate } from '../lib/dates'
import { CategoryDot } from './CategoryDot'

interface Props {
  date: Date
  isCurrentMonth: boolean
  isExpanded: boolean
  tasks: TaskViewModel[]
  notes: string
  hasInk: boolean
  categoryById: Map<string, Category>
  onTap: (dateISO: string, el: HTMLElement) => void
}

export function DayCell({ date, isCurrentMonth, isExpanded, tasks, notes, hasInk, categoryById, onTap }: Props) {
  const dateISO = toISODate(date)
  const today = isTodayDate(date)
  const doneCount = tasks.filter((t) => t.done).length
  const hasDeadline = tasks.some((t) => t.deadline && !t.done)
  const categoryColors = [...new Set(tasks.map((t) => t.categoryId).filter(Boolean))].slice(0, 4) as string[]

  const previewLines: string[] = []
  if (notes.trim()) previewLines.push(notes.trim())
  else if (hasInk) previewLines.push('✎ Handwritten notes')
  for (const t of tasks) {
    if (previewLines.length >= 2) break
    previewLines.push(t.title)
  }

  const label = `${date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}${
    tasks.length ? `, ${tasks.length} task${tasks.length === 1 ? '' : 's'}` : ''
  }${hasInk ? ', handwritten notes' : ''}`

  return (
    <button
      type="button"
      class={`day-cell ${isCurrentMonth ? '' : 'is-dim'} ${today ? 'is-today' : ''} ${isExpanded ? 'is-expanded' : ''}`}
      data-flip-id={dateISO}
      role="gridcell"
      aria-label={label}
      aria-expanded={isExpanded}
      onClick={(e) => onTap(dateISO, e.currentTarget as HTMLElement)}
    >
      <div class="day-cell-top">
        <span class="day-cell-number">{date.getDate()}</span>
        {hasDeadline && <span class="day-cell-deadline-badge" aria-label="Deadline today" />}
      </div>

      <div class="day-cell-preview">
        {previewLines.map((line, i) => (
          <div class="day-cell-preview-line" key={i}>
            {line}
          </div>
        ))}
      </div>

      <div class="day-cell-footer">
        {categoryColors.length > 0 && (
          <div class="day-cell-dots">
            {categoryColors.map((id) => {
              const cat = categoryById.get(id)
              return cat ? <CategoryDot key={id} color={cat.color} /> : null
            })}
          </div>
        )}
        {tasks.length > 0 && (
          <span class="day-cell-progress">
            {doneCount}/{tasks.length}
          </span>
        )}
      </div>
    </button>
  )
}
