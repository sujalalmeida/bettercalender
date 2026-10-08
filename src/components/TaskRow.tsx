import { useRef, useState } from 'preact/hooks'
import type { TaskViewModel } from '../db/repository'
import type { Category } from '../db/types'
import { CategoryDot } from './CategoryDot'

const SWIPE_THRESHOLD = 72

interface Props {
  task: TaskViewModel
  category?: Category
  onToggle: () => void
  onDelete: (scope: 'this' | 'all-future') => void
  onOpenDetails: () => void
  onGripPointerDown: (e: PointerEvent) => void
}

export function TaskRow({ task, category, onToggle, onDelete, onOpenDetails, onGripPointerDown }: Props) {
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
        if (task.recurrenceId) {
          setConfirming(true)
        } else {
          onDelete('this')
        }
      }
      setDragX(0)
    }
    start.current = null
    axisLocked.current = null
    setSwiping(false)
  }

  return (
    <li class="task-row-wrap">
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
          onPointerCancel={onPointerUp}
        >
          <button class="task-row-grip" aria-label="Reorder task" onPointerDown={onGripPointerDown}>
            ⠿
          </button>
          <button
            class={`task-row-circle ${task.done ? 'is-done' : ''}`}
            onClick={onToggle}
            aria-pressed={task.done}
            aria-label={task.done ? 'Mark incomplete' : 'Mark complete'}
          />
          <button class="task-row-main" onClick={onOpenDetails}>
            <span class={`task-row-title ${task.done ? 'is-done' : ''}`}>{task.title}</span>
            <span class="task-row-meta">
              {category && <CategoryDot color={category.color} />}
              {task.time && <span class="task-row-time">{task.time}</span>}
              {task.deadline && <span class="task-row-badge">Deadline</span>}
              {task.virtual && <span class="task-row-badge task-row-badge-muted">Repeats</span>}
            </span>
          </button>
        </div>
      )}
    </li>
  )
}
