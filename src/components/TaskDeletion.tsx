import { useEffect, useState } from 'preact/hooks'
import { deleteTask, restoreDeletedOccurrence, type DeleteScope, type TaskViewModel } from '../db/repository'

export function useTaskDeletion() {
  const [deleted, setDeleted] = useState<TaskViewModel | null>(null)

  useEffect(() => {
    if (!deleted) return
    const timeout = setTimeout(() => setDeleted(null), 5000)
    return () => clearTimeout(timeout)
  }, [deleted])

  async function remove(task: TaskViewModel, scope: DeleteScope) {
    await deleteTask(task, scope)
    if (scope === 'this') setDeleted(task)
  }

  function undo() {
    if (!deleted) return
    void restoreDeletedOccurrence(deleted)
    setDeleted(null)
  }

  return { deleted, remove, undo }
}

export function TaskUndo({ task, onUndo }: { task: TaskViewModel; onUndo: () => void }) {
  return <div class="undo-toast" role="status">
    <span>Deleted "{task.title}"</span>
    <button class="chip-btn" onClick={onUndo}>Undo</button>
  </div>
}
