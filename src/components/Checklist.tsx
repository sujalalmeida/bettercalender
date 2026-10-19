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
  const dragOrder = useRef<TaskViewModel[] | null>(null)
  const dragCleanup = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (!dragId.current) setLocalOrder(null)
  }, [tasks])

  useEffect(() => () => dragCleanup.current?.(), [])

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
    e.stopPropagation()
    dragId.current = taskId
    dragOrder.current = [...items]
    dragCleanup.current?.()
    window.addEventListener('pointermove', onDragMove)
    window.addEventListener('pointerup', onDragEnd, { once: true })
    window.addEventListener('pointercancel', onDragCancel, { once: true })
    dragCleanup.current = () => {
      window.removeEventListener('pointermove', onDragMove)
      window.removeEventListener('pointerup', onDragEnd)
      window.removeEventListener('pointercancel', onDragCancel)
    }
  }

  function onDragMove(e: PointerEvent) {
    const container = listRef.current
    if (!container || !dragId.current) return
    const rows = Array.from(container.querySelectorAll<HTMLElement>('[data-task-row-id]'))
    const currentIds = (dragOrder.current ?? []).map((t) => t.id)
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

    const next = [...(dragOrder.current ?? [])]
    const [moved] = next.splice(fromIndex, 1)
    next.splice(toIndex, 0, moved)
    dragOrder.current = next
    setLocalOrder(next)
  }

  async function onDragEnd() {
    dragCleanup.current?.()
    const order = dragOrder.current
    dragId.current = null
    dragOrder.current = null
    if (order) {
      await reorderTasks(dateISO, order.map((t) => t.id))
    }
  }

  function onDragCancel() {
    dragCleanup.current?.()
    dragId.current = null
    dragOrder.current = null
    setLocalOrder(null)
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
