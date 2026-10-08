import { useState } from 'preact/hooks'
import type { TaskViewModel } from '../db/repository'
import { addRecurrence, updateTask, updateFutureOccurrences } from '../db/repository'
import type { Category, RepeatFrequency } from '../db/types'
import { downloadICS, LEAD_TIME_LABELS, buildICS, type ReminderLeadTime } from '../lib/ics'
import { createId } from '../lib/id'

interface Props {
  task: TaskViewModel
  categories: Category[]
  defaultLeadTime: ReminderLeadTime
  onClose: () => void
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function TaskDetailsEditor({ task, categories, defaultLeadTime, onClose }: Props) {
  const [time, setTime] = useState(task.time ?? '')
  const [title, setTitle] = useState(task.title)
  const [categoryId, setCategoryId] = useState(task.categoryId ?? '')
  const [deadline, setDeadline] = useState(Boolean(task.deadline))
  const [repeatFreq, setRepeatFreq] = useState<RepeatFrequency | 'none'>('none')
  const [weeklyDays, setWeeklyDays] = useState<number[]>([])
  const [intervalDays, setIntervalDays] = useState(2)
  const [leadTime, setLeadTime] = useState<ReminderLeadTime>(defaultLeadTime)
  const [editScope, setEditScope] = useState<'this' | 'all-future'>('this')

  async function handleSave() {
    const patch = {
      title: title.trim() || task.title,
      time: time || undefined,
      categoryId: categoryId || undefined,
      deadline
    }
    if (task.recurrenceId && editScope === 'all-future') await updateFutureOccurrences(task, patch)
    else await updateTask(task, patch)

    if (!task.recurrenceId && repeatFreq !== 'none') {
      const recurrence = await addRecurrence({
        title: patch.title,
        startDate: task.date,
        time: time || undefined,
        categoryId: categoryId || undefined,
        deadline,
        rule:
          repeatFreq === 'weekly'
            ? { frequency: 'weekly', daysOfWeek: weeklyDays.length ? weeklyDays : [new Date(task.date).getDay()] }
            : repeatFreq === 'custom'
              ? { frequency: 'custom', intervalDays }
              : { frequency: repeatFreq }
      })
      await updateTask(task, { recurrenceId: recurrence.id })
    }

    onClose()
  }

  function handleAddToCalendar() {
    const ics = buildICS({
      uid: `${task.id || createId()}@plan.app`,
      title,
      date: task.date,
      time: time || undefined,
      leadTime
    })
    downloadICS(task.title, ics)
  }

  function toggleWeeklyDay(day: number) {
    setWeeklyDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()))
  }

  return (
    <li class="task-details">
      <div class="task-details-field">
        <label for={`task-title-${task.id}`}>Task</label>
        <input id={`task-title-${task.id}`} type="text" value={title} onInput={(e) => setTitle((e.target as HTMLInputElement).value)} />
      </div>
      <div class="task-details-field">
        <label for="task-time">Time</label>
        <input id="task-time" type="time" value={time} onInput={(e) => setTime((e.target as HTMLInputElement).value)} />
      </div>

      <div class="task-details-field">
        <label for="task-category">Category</label>
        <select id="task-category" value={categoryId} onChange={(e) => setCategoryId((e.target as HTMLSelectElement).value)}>
          <option value="">None</option>
          {categories.map((c) => (
            <option value={c.id} key={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <label class="task-details-checkbox">
        <input type="checkbox" checked={deadline} onChange={(e) => setDeadline((e.target as HTMLInputElement).checked)} />
        Deadline
      </label>

      {task.recurrenceId && (
        <div class="task-details-field">
          <label for={`task-scope-${task.id}`}>Apply changes to</label>
          <select id={`task-scope-${task.id}`} value={editScope} onChange={e => setEditScope((e.target as HTMLSelectElement).value as 'this' | 'all-future')}>
            <option value="this">This day only</option>
            <option value="all-future">This and future days</option>
          </select>
        </div>
      )}

      {!task.recurrenceId && (
        <div class="task-details-field">
          <label for="task-repeat">Repeat</label>
          <select id="task-repeat" value={repeatFreq} onChange={(e) => setRepeatFreq((e.target as HTMLSelectElement).value as RepeatFrequency | 'none')}>
            <option value="none">Does not repeat</option>
            <option value="daily">Daily</option>
            <option value="weekdays">Weekdays</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="custom">Custom interval</option>
          </select>
        </div>
      )}

      {repeatFreq === 'weekly' && (
        <div class="task-details-weekdays">
          {WEEKDAY_LABELS.map((label, i) => (
            <button
              type="button"
              key={label}
              class={`weekday-chip ${weeklyDays.includes(i) ? 'is-active' : ''}`}
              onClick={() => toggleWeeklyDay(i)}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {repeatFreq === 'custom' && (
        <div class="task-details-field">
          <label for="task-interval">Every N days</label>
          <input
            id="task-interval"
            type="number"
            min={2}
            value={intervalDays}
            onInput={(e) => setIntervalDays(Number((e.target as HTMLInputElement).value) || 2)}
          />
        </div>
      )}

      {(deadline || time) && (
        <div class="task-details-field">
          <label for="task-lead">Reminder</label>
          <select id="task-lead" value={leadTime} onChange={(e) => setLeadTime((e.target as HTMLSelectElement).value as ReminderLeadTime)}>
            {Object.entries(LEAD_TIME_LABELS).map(([value, label]) => (
              <option value={value} key={value}>
                {label}
              </option>
            ))}
          </select>
          <button type="button" class="chip-btn" onClick={handleAddToCalendar}>
            Add alert to Calendar
          </button>
        </div>
      )}

      <div class="task-details-actions">
        <button class="chip-btn chip-btn-muted" onClick={onClose}>
          Cancel
        </button>
        <button class="chip-btn chip-btn-primary" onClick={handleSave}>
          Save
        </button>
      </div>
    </li>
  )
}
