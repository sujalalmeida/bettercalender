import { useEffect, useRef, useState } from 'preact/hooks'
import { addTask, deleteTask, reorderTasks, restoreDeletedOccurrence, toggleTaskDone, type DeleteScope, type TaskViewModel } from '../db/repository'
import type { Category } from '../db/types'
import type { ReminderLeadTime } from '../lib/ics'
import { TaskRow } from './TaskRow'
import { TaskDetailsEditor } from './TaskDetailsEditor'

interface Props {
  dateISO: string
  tasks: TaskViewModel[]
  categories: Category[]
  defaultLeadTime: ReminderLeadTime
}

export function Checklist({ dateISO, tasks, categories, defaultLeadTime }: Props) {
  const [newTitle, setNewTitle] = useState('')
  const [openDetailsId, setOpenDetailsId] = useState<string | null>(null)
  const [localOrder, setLocalOrder] = useState<TaskViewModel[] | null>(null)
  const [undo, setUndo] = useState<{ title: string; restore: () => void } | null>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const dragId = useRef<string | null>(null)

  useEffect(() => {
    setLocalOrder(null)
  }, [tasks])

  useEffect(() => {
    if (!undo) return
    const timer = setTimeout(() => setUndo(null), 5000)
    return () => clearTimeout(timer)
  }, [undo])

  const items = localOrder ?? tasks
  const categoryById = new Map(categories.map((c) => [c.id, c]))

  async function handleAdd(e: Event) {
    e.preventDefault()
    const title = newTitle.trim()
    if (!title) return
    await addTask(dateISO, title)
    setNewTitle('')
  }

  async function handleDelete(task: TaskViewModel, scope: DeleteScope) {
    await deleteTask(task, scope)
    if (scope === 'this') {
      setUndo({
        title: task.title,
        restore: () => { void restoreDeletedOccurrence(task) }
      })
    }
  }

  function onGripPointerDown(taskId: string, e: PointerEvent) {
    e.preventDefault()
    dragId.current = taskId
    window.addEventListener('pointermove', onDragMove)
    window.addEventListener('pointerup', onDragEnd, { once: true })
  }

  function onDragMove(e: PointerEvent) {
    const container = listRef.current
    if (!container || !dragId.current) return
    const rows = Array.from(container.querySelectorAll<HTMLElement>('[data-task-row-id]'))
    const currentIds = (localOrder ?? tasks).map((t) => t.id)
    const fromIndex = currentIds.indexOf(dragId.current)
    if (fromIndex === -1) return

    let toIndex = fromIndex
    for (let i = 0; i < rows.length; i++) {
      const rect = rows[i].getBoundingClientRect()
      if (e.clientY < rect.top + rect.height / 2) {
        toIndex = i
        break
      }
      toIndex = i
    }
    if (toIndex === fromIndex) return

    const next = [...(localOrder ?? tasks)]
    const [moved] = next.splice(fromIndex, 1)
    next.splice(toIndex, 0, moved)
    setLocalOrder(next)
  }

  async function onDragEnd() {
    window.removeEventListener('pointermove', onDragMove)
    const order = localOrder
    dragId.current = null
    if (order) {
      await reorderTasks(dateISO, order.map((t) => t.id))
    }
  }

  return (
    <div class="checklist">
      <ul class="task-list" ref={listRef}>
        {items.map((task) => (
          <div data-task-row-id={task.id} key={task.id}>
            <TaskRow
              task={task}
              category={task.categoryId ? categoryById.get(task.categoryId) : undefined}
              onToggle={() => toggleTaskDone(task)}
              onDelete={(scope) => handleDelete(task, scope)}
              onOpenDetails={() => setOpenDetailsId((id) => (id === task.id ? null : task.id))}
              onGripPointerDown={(e) => onGripPointerDown(task.id, e)}
            />
            {openDetailsId === task.id && (
              <TaskDetailsEditor
                task={task}
                categories={categories}
                defaultLeadTime={defaultLeadTime}
                onClose={() => setOpenDetailsId(null)}
              />
            )}
          </div>
        ))}
      </ul>

      <form class="task-add-form" onSubmit={handleAdd}>
        <input
          type="text"
          placeholder="Add a task…"
          value={newTitle}
          onInput={(e) => setNewTitle((e.target as HTMLInputElement).value)}
          aria-label="Add a task"
        />
      </form>

      {undo && (
        <div class="undo-toast" role="status">
          <span>Deleted "{undo.title}"</span>
          <button
            class="chip-btn"
            onClick={() => {
              undo.restore()
              setUndo(null)
            }}
          >
            Undo
          </button>
        </div>
      )}
    </div>
  )
}
