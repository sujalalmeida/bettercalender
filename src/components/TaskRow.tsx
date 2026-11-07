import { useRef, useState } from 'preact/hooks'
import type { TaskViewModel } from '../db/repository'
import type { Category } from '../db/types'
import { CategoryDot } from './CategoryDot'
import { PlannerIcon } from './PlannerIcon'

const SWIPE_THRESHOLD = 72

interface Props {
  task: TaskViewModel
  category?: Category
  onToggle: () => void
  onDelete: (scope: 'this' | 'all-future') => void
  onOpenDetails: () => void
  onGripPointerDown?: (e: PointerEvent) => void
  timeline?: boolean
}

export function TaskRow({ task, category, onToggle, onDelete, onOpenDetails, onGripPointerDown, timeline = false }: Props) {
  const [dragX, setDragX] = useState(0)
  const [swiping, setSwiping] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const start = useRef<{ x: number; y: number } | null>(null)
  const axisLocked = useRef<'x' | 'y' | null>(null)

  function onPointerDown(e: PointerEvent) {
    if (confirming) return
    start.current = { x: e.clientX, y: e.clientY }
    axisLocked.current = null
  }

  function onPointerMove(e: PointerEvent) {
    if (!start.current) return
    const dx = e.clientX - start.current.x
    const dy = e.clientY - start.current.y
    if (!axisLocked.current) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return
      axisLocked.current = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
    }
    if (axisLocked.current !== 'x') return
    setSwiping(true)
    setDragX(Math.min(0, dx))
  }

  function onPointerUp() {
    if (axisLocked.current === 'x') {
      if (dragX < -SWIPE_THRESHOLD) {
        requestDelete()
      }
      setDragX(0)
    }
    start.current = null
    axisLocked.current = null
    setSwiping(false)
  }

  function requestDelete() {
    if (task.recurrenceId) setConfirming(true)
    else onDelete('this')
  }

  function cancelSwipe() {
    start.current = null
    axisLocked.current = null
    setDragX(0)
    setSwiping(false)
  }

  return (
    <li class={`task-row-wrap ${timeline ? 'timeline-task-wrap' : ''}`}>
      <div class="task-row-delete-bg" aria-hidden="true">
        Delete
      </div>
      {confirming ? (
        <div class="task-row task-row-confirm">
          <span>Delete this occurrence?</span>
          <div class="task-row-confirm-actions">
            <button class="chip-btn" onClick={() => onDelete('this')}>
              This day
            </button>
            <button class="chip-btn" onClick={() => onDelete('all-future')}>
              All future
            </button>
            <button class="chip-btn chip-btn-muted" onClick={() => setConfirming(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div
          class="task-row"
          style={{ transform: `translateX(${dragX}px)`, transition: swiping ? 'none' : 'transform 200ms cubic-bezier(.22,1,.36,1)' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={cancelSwipe}
        >
          {onGripPointerDown && <button class="task-row-grip" aria-label="Reorder task" onPointerDown={onGripPointerDown}>
            ⠿
          </button>}
          <button
            class={`task-row-circle ${task.done ? 'is-done' : ''}`}
            onClick={onToggle}
            aria-pressed={task.done}
            aria-label={timeline ? (task.done ? `Mark ${task.title} incomplete` : `Complete ${task.title}`) : (task.done ? 'Mark incomplete' : 'Mark complete')}
          />
          {timeline && <CategoryDot color={category?.color ?? 'var(--color-text-tertiary)'} size={8} />}
          <button class="task-row-main" onClick={onOpenDetails}>
            <span class={`task-row-title ${task.done ? 'is-done' : ''}`}>{task.title}</span>
            <span class="task-row-meta">
              {category && (timeline ? <span>{category.name}</span> : <CategoryDot color={category.color} />)}
              {!timeline && task.time && <span class="task-row-time">{task.time}</span>}
              {task.deadline && <span class="task-row-badge">Deadline</span>}
              {task.virtual && <span class="task-row-badge task-row-badge-muted">Repeats</span>}
            </span>
          </button>
          {timeline && <div class="timeline-task-actions">
            <button aria-label={`Edit ${task.title}`} onClick={onOpenDetails}><PlannerIcon name="pen" /></button>
            <button aria-label={`Delete ${task.title}`} onClick={requestDelete}><PlannerIcon name="trash" /></button>
          </div>}
        </div>
      )}
    </li>
  )
}
