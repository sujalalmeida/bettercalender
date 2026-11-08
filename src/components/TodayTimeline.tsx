import { liveQuery } from 'dexie'
import { Fragment } from 'preact'
import { useRef, useState } from 'preact/hooks'
import { db } from '../db/db'
import { addTask, getTasksForRange, toggleTaskDone, type TaskViewModel } from '../db/repository'
import { addDaysToDate, daysUntilLabel, fromISODate, getWeekDays, toISODate, todayISO } from '../lib/dates'
import { useObservable } from '../lib/useObservable'
import { useSettings } from '../lib/settingsStore'
import { DueSoonStrip } from './DueSoonStrip'
import { PlannerIcon } from './PlannerIcon'
import { TaskDetailsEditor } from './TaskDetailsEditor'
import { TaskRow } from './TaskRow'
import { TaskUndo, useTaskDeletion } from './TaskDeletion'

interface Props {
  date: Date
  onDateChange: (date: Date) => void
  weekStartsOn: 0 | 1
  onOpenDay: (dateISO: string, originRect: DOMRect) => void
  onJumpToDate: (dateISO: string) => void
  onOpenMilestones: () => void
}

function formatTime(value: string): string {
  const [hour, minute] = value.split(':').map(Number)
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return value
  return new Date(2020, 0, 1, hour, minute).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

export function TodayTimeline({ date, onDateChange, weekStartsOn, onOpenDay, onJumpToDate, onOpenMilestones }: Props) {
  const dateISO = toISODate(date)
  const today = todayISO()
  const isToday = dateISO === today
  const week = getWeekDays(date, weekStartsOn)
  const { reminderLeadTime } = useSettings()
  const tasksByDate = useObservable(() => liveQuery(() => getTasksForRange(dateISO, dateISO)), [dateISO], {} as Record<string, TaskViewModel[]>)
  const categories = useObservable(() => liveQuery(() => db.categories.orderBy('order').toArray()), [], [])
  const nextMilestone = useObservable(() => liveQuery(() => db.milestones.where('dueDate').aboveOrEqual(today)
    .filter(item => item.status === 'planned' || item.status === 'waiting').first()), [today], undefined)
  const categoryById = new Map(categories.map(category => [category.id, category]))
  const tasks = tasksByDate[dateISO] ?? []
  const timed = tasks.filter(task => task.time).sort((a, b) => (a.time || '').localeCompare(b.time || '') || a.order - b.order)
  const groups = new Map<string, TaskViewModel[]>()
  const anytime = tasks.filter(task => !task.time).sort((a, b) => a.order - b.order)
  if (anytime.length) groups.set('', anytime)
  for (const task of timed) {
    const time = task.time!
    const group = groups.get(time)
    if (group) group.push(task)
    else groups.set(time, [task])
  }
  const completed = tasks.filter(task => task.done).length
  const progress = tasks.length ? Math.round(completed / tasks.length * 100) : 0
  const { deleted, remove, undo } = useTaskDeletion()
  const [editing, setEditing] = useState<{ id: string; date: string } | null>(null)
  const taskInput = useRef<HTMLInputElement>(null)
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')
  const [time, setTime] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [deadline, setDeadline] = useState(false)
  const [error, setError] = useState('')

  async function saveTask(event: Event) {
    event.preventDefault()
    const cleanTitle = title.trim()
    if (!cleanTitle) return
    setError('')
    try {
      await addTask(dateISO, cleanTitle, { ...(time ? { time } : {}), ...(categoryId ? { categoryId } : {}), ...(deadline ? { deadline: true } : {}) })
      setTitle('')
      setTime('')
      setCategoryId('')
      setDeadline(false)
      setAdding(false)
    } catch { setError('Could not save this task. Please try again.') }
  }

  function openAddForm() {
    setAdding(true)
    taskInput.current?.focus()
  }

  function taskCard(task: TaskViewModel) {
    const isEditing = editing?.id === task.id && editing.date === dateISO
    return <Fragment key={task.id}>
      <TaskRow
        timeline
        task={task}
        category={task.categoryId ? categoryById.get(task.categoryId) : undefined}
        onToggle={() => toggleTaskDone(task)}
        onDelete={scope => remove(task, scope)}
        onOpenDetails={() => setEditing(isEditing ? null : { id: task.id, date: dateISO })}
      />
      {isEditing && <TaskDetailsEditor task={task} categories={categories} defaultLeadTime={reminderLeadTime} onClose={() => setEditing(null)} />}
    </Fragment>
  }

  return <section class="timeline-screen scroll-panel" aria-label="Daily timeline">
    <div class="timeline-inner">
      <header class="timeline-heading">
        <div>
          <div class="planner-eyebrow timeline-eyebrow">Your day{isToday && <span>Today</span>}</div>
          <h1>{date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</h1>
          <div class="timeline-progress">
            <span>{tasks.length ? `${completed} of ${tasks.length} complete` : 'No tasks planned'}</span>
            {tasks.length > 0 && <><progress aria-label="Task completion" value={completed} max={tasks.length} /><span>{progress}%</span></>}
          </div>
        </div>
        <div class="timeline-heading-actions">
          <button class="timeline-week-arrow" aria-label="Previous day" onClick={() => onDateChange(addDaysToDate(date, -1))}>‹</button>
          <button class="timeline-today-link" onClick={() => onDateChange(new Date())}>Today</button>
          <button class="timeline-week-arrow" aria-label="Next day" onClick={() => onDateChange(addDaysToDate(date, 1))}>›</button>
        </div>
      </header>
      <div class="timeline-week-wrap">
        <button class="timeline-week-arrow" aria-label="Previous week" onClick={() => onDateChange(addDaysToDate(date, -7))}>‹</button>
        <div class="timeline-week" role="group" aria-label="Choose a day">
          {week.map(day => { const iso = toISODate(day); return <button key={iso} class={`timeline-date ${iso === dateISO ? 'is-selected' : ''} ${iso === today ? 'is-today' : ''}`} aria-label={day.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })} aria-pressed={iso === dateISO} aria-current={iso === today ? 'date' : undefined} onClick={() => onDateChange(day)}><span>{day.toLocaleDateString(undefined, { weekday: 'narrow' })}</span><strong>{day.getDate()}</strong></button> })}
        </div>
        <button class="timeline-week-arrow" aria-label="Next week" onClick={() => onDateChange(addDaysToDate(date, 7))}>›</button>
      </div>
      <button class="timeline-day-actions" onClick={event => onOpenDay(dateISO, event.currentTarget.getBoundingClientRect())}>
        <span class="timeline-notes-icon"><PlannerIcon name="pen" /></span>
        <span class="timeline-notes-copy"><strong>{isToday ? 'Open today’s notes' : 'Open day’s notes'}</strong><span>Handwriting, typed notes, and checklist</span></span>
        <span class="timeline-notes-arrow" aria-hidden="true">→</span>
      </button>
      <div class="timeline-summary">
        <DueSoonStrip card onJumpToDate={onJumpToDate} />
        {nextMilestone && <button class="timeline-summary-card timeline-milestone" onClick={onOpenMilestones}>
          <span class="planner-eyebrow">Next milestone</span>
          <strong>{nextMilestone.title}</strong>
          <span>{daysUntilLabel(nextMilestone.dueDate)} · {fromISODate(nextMilestone.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
        </button>}
      </div>
      <div class="timeline-section-heading">
        <div><span class="planner-eyebrow">Plan</span><h2>The day, at a glance</h2></div>
        <button class="timeline-add" onClick={() => setAdding(value => !value)} aria-expanded={adding}>{adding ? 'Close' : '+ Add task'}</button>
      </div>
      {adding && <form class="timeline-add-form" onSubmit={saveTask}><label>Task<input ref={taskInput} autoFocus value={title} onInput={event => setTitle(event.currentTarget.value)} placeholder="What needs doing?" required /></label><div class="timeline-add-fields"><label>Time (optional)<input type="time" value={time} onInput={event => setTime(event.currentTarget.value)} /></label><label>Category<select value={categoryId} onChange={event => setCategoryId(event.currentTarget.value)}><option value="">None</option>{categories.map(category => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label></div><label class="timeline-deadline"><input type="checkbox" checked={deadline} onChange={event => setDeadline(event.currentTarget.checked)} /> Deadline</label>{error && <p role="alert">{error}</p>}<button type="submit">Add to {date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</button></form>}
      {Array.from(groups, ([time, items]) => <section class="timeline-group" key={time}>
        <div class="timeline-group-label"><span class="timeline-rail-dot" style={{ '--rail-color': (items[0].categoryId && categoryById.get(items[0].categoryId)?.color) || 'var(--color-text-secondary)' }} /><span>{time ? formatTime(time) : 'Anytime'}</span></div>
        <ul class="timeline-group-items">{items.map(taskCard)}</ul>
      </section>)}
      {tasks.length ? <div class="timeline-group timeline-end">
        <div class="timeline-group-label"><span class="timeline-rail-dot" /><span>End of day</span></div>
        <button onClick={openAddForm}>＋ Add another task</button>
      </div> : <div class="timeline-empty"><h3>Nothing scheduled</h3><button onClick={openAddForm}>Add a task</button></div>}
      {deleted && <TaskUndo task={deleted} onUndo={undo} />}
    </div>
  </section>
}
