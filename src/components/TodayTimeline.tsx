import { liveQuery } from 'dexie'
import { useState } from 'preact/hooks'
import { db } from '../db/db'
import { addTask, getTasksForRange, toggleTaskDone, type TaskViewModel } from '../db/repository'
import { addDaysToDate, getWeekDays, toISODate, todayISO } from '../lib/dates'
import { useObservable } from '../lib/useObservable'

interface Props {
  date: Date
  onDateChange: (date: Date) => void
  weekStartsOn: 0 | 1
  onOpenDay: (dateISO: string, originRect: DOMRect) => void
}

function formatTime(value: string): string {
  const [hour, minute] = value.split(':').map(Number)
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return value
  return new Date(2020, 0, 1, hour, minute).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

export function TodayTimeline({ date, onDateChange, weekStartsOn, onOpenDay }: Props) {
  const dateISO = toISODate(date)
  const week = getWeekDays(date, weekStartsOn)
  const tasksByDate = useObservable(() => liveQuery(() => getTasksForRange(dateISO, dateISO)), [dateISO], {} as Record<string, TaskViewModel[]>)
  const categories = useObservable(() => liveQuery(() => db.categories.orderBy('order').toArray()), [], [])
  const categoryById = new Map(categories.map(category => [category.id, category]))
  const tasks = tasksByDate[dateISO] ?? []
  const timed = tasks.filter(task => task.time).sort((a, b) => (a.time || '').localeCompare(b.time || '') || a.order - b.order)
  const anytime = tasks.filter(task => !task.time).sort((a, b) => a.order - b.order)
  const completed = tasks.filter(task => task.done).length
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

  function taskCard(task: TaskViewModel) {
    const category = task.categoryId ? categoryById.get(task.categoryId) : undefined
    const color = category?.color ?? (task.deadline ? '#dc8d84' : '#8da6bb')
    return <article class={`timeline-task ${task.done ? 'is-done' : ''}`} key={task.id} style={{ borderLeftColor: color }}>
      <span class="timeline-task-icon" style={{ backgroundColor: color }} aria-hidden="true">{category?.name.charAt(0).toUpperCase() ?? (task.deadline ? '!' : '✓')}</span>
      <div class="timeline-task-copy">
        <span class="timeline-task-meta">{task.time ? formatTime(task.time) : 'Anytime'}{category ? ` · ${category.name}` : ''}{task.deadline ? ' · Deadline' : ''}</span>
        <h3>{task.title}</h3>
        {task.virtual && <span class="timeline-task-repeat">↻ Repeats</span>}
      </div>
      <button class="timeline-task-check" aria-label={task.done ? `Mark ${task.title} incomplete` : `Complete ${task.title}`} aria-pressed={task.done} onClick={() => toggleTaskDone(task)}>{task.done ? '✓' : ''}</button>
    </article>
  }

  return <section class="timeline-screen scroll-panel" aria-label="Daily timeline">
    <div class="timeline-inner">
      <header class="timeline-heading">
        <div><span class="timeline-eyebrow">DAILY PLAN</span><h1>{date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</h1><p>{tasks.length ? `${completed} of ${tasks.length} tasks completed` : 'No tasks planned'}</p></div>
        <button class="timeline-today-link" onClick={() => onDateChange(new Date())}>Today</button>
      </header>
      <div class="timeline-week-wrap">
        <button class="timeline-week-arrow" aria-label="Previous week" onClick={() => onDateChange(addDaysToDate(date, -7))}>‹</button>
        <div class="timeline-week" role="group" aria-label="Choose a day">
          {week.map(day => { const iso = toISODate(day); return <button key={iso} class={`timeline-date ${iso === dateISO ? 'is-selected' : ''} ${iso === todayISO() ? 'is-today' : ''}`} aria-pressed={iso === dateISO} onClick={() => onDateChange(day)}><span>{day.toLocaleDateString(undefined, { weekday: 'short' })}</span><strong>{day.getDate()}</strong></button> })}
        </div>
        <button class="timeline-week-arrow" aria-label="Next week" onClick={() => onDateChange(addDaysToDate(date, 7))}>›</button>
      </div>
      <div class="timeline-day-actions"><span>{tasks.length ? `${tasks.length - completed} remaining` : 'Write freely with Apple Pencil'}</span><button onClick={event => onOpenDay(dateISO, event.currentTarget.getBoundingClientRect())}>Open day & whiteboard <span aria-hidden="true">↗</span></button></div>
      <div class="timeline-section-heading"><h2>Tasks</h2><button class="timeline-add" onClick={() => setAdding(value => !value)} aria-expanded={adding}>{adding ? 'Close' : '+ Add task'}</button></div>
      {adding && <form class="timeline-add-form" onSubmit={saveTask}><label>Task<input autoFocus value={title} onInput={event => setTitle(event.currentTarget.value)} placeholder="What needs doing?" required /></label><div class="timeline-add-fields"><label>Time (optional)<input type="time" value={time} onInput={event => setTime(event.currentTarget.value)} /></label><label>Category<select value={categoryId} onChange={event => setCategoryId(event.currentTarget.value)}><option value="">None</option>{categories.map(category => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label></div><label class="timeline-deadline"><input type="checkbox" checked={deadline} onChange={event => setDeadline(event.currentTarget.checked)} /> Deadline</label>{error && <p role="alert">{error}</p>}<button type="submit">Add to {date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</button></form>}
      {anytime.length > 0 && <section class="timeline-group"><div class="timeline-group-label"><span class="timeline-rail-dot" /><span>Anytime</span></div><div class="timeline-group-items">{anytime.map(taskCard)}</div></section>}
      {timed.length > 0 && <section class="timeline-group"><div class="timeline-group-label"><span class="timeline-rail-dot" /><span>Scheduled</span></div><div class="timeline-group-items">{timed.map(taskCard)}</div></section>}
      {tasks.length === 0 && <div class="timeline-empty"><h3>Nothing scheduled</h3><p>Add a task or open the day to take notes.</p><button onClick={() => setAdding(true)}>Add a task</button></div>}
    </div>
  </section>
}
