import { db } from './db'
import { createId } from '../lib/id'
import { expandRecurrence } from '../lib/recurrence'
import { addDaysToDate, fromISODate, toISODate, todayISO } from '../lib/dates'
import { enqueueChange, SYNC_TABLES } from '../lib/syncQueue'
import type { Category, Day, InkDocument, Recurrence, RepeatRule, SettingsRow, Task, Template, RevisionTopic, SkillEntry, Milestone } from './types'

export interface TaskViewModel extends Task {
  /** True when this occurrence only exists virtually (expanded from a Recurrence, not yet written to the tasks table). */
  virtual: boolean
}

function toViewModel(task: Task): TaskViewModel {
  return { ...task, virtual: false }
}

// ---------- Days ----------

export async function getDay(dateISO: string): Promise<Day | undefined> {
  return db.days.get(dateISO)
}

export async function saveDayNotes(dateISO: string, notes: string): Promise<void> {
  await db.days.put({ date: dateISO, notes, updatedAt: Date.now() })
}

export async function getInk(dateISO: string): Promise<InkDocument | undefined> {
  return db.ink.get(dateISO)
}

export async function saveInk(document: InkDocument): Promise<void> {
  await db.ink.put({ ...document, updatedAt: Date.now() })
}

export async function getInkDatesForRange(startISO: string, endISO: string): Promise<string[]> {
  const docs = await db.ink.where('date').between(startISO, endISO, true, true).toArray()
  return docs.filter(doc => doc.pages.some(page => page.strokes.length > 0)).map(doc => doc.date)
}

// ---------- Tasks + recurrence expansion ----------

async function materializeOccurrence(rec: Recurrence, dateISO: string): Promise<Task> {
  const existing = await db.tasks.where({ recurrenceId: rec.id, date: dateISO }).first()
  if (existing) return existing

  const siblingCount = await db.tasks.where('date').equals(dateISO).count()
  const task: Task = {
    id: createId(),
    date: dateISO,
    title: rec.title,
    done: false,
    order: siblingCount,
    time: rec.time,
    categoryId: rec.categoryId,
    deadline: rec.deadline,
    recurrenceId: rec.id,
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
  await db.tasks.add(task)
  return task
}

export async function getTasksForRange(startISO: string, endISO: string): Promise<Record<string, TaskViewModel[]>> {
  const result: Record<string, TaskViewModel[]> = {}

  const realTasks = await db.tasks.where('date').between(startISO, endISO, true, true).toArray()
  const materializedKeys = new Set(realTasks.map((t) => `${t.recurrenceId ?? ''}:${t.date}`))

  for (const task of realTasks) {
    ;(result[task.date] ??= []).push(toViewModel(task))
  }

  const recurrences = await db.recurrences.toArray()
  for (const rec of recurrences) {
    const dates = expandRecurrence(rec, startISO, endISO)
    for (const dateISO of dates) {
      if (materializedKeys.has(`${rec.id}:${dateISO}`)) continue
      const virtualTask: TaskViewModel = {
        id: `v:${rec.id}:${dateISO}`,
        date: dateISO,
        title: rec.title,
        done: false,
        order: -1,
        time: rec.time,
        categoryId: rec.categoryId,
        deadline: rec.deadline,
        recurrenceId: rec.id,
        createdAt: 0,
        updatedAt: 0,
        virtual: true
      }
      ;(result[dateISO] ??= []).push(virtualTask)
    }
  }

  for (const dateISO of Object.keys(result)) {
    result[dateISO].sort((a, b) => a.order - b.order || a.title.localeCompare(b.title))
  }

  return result
}

export async function getTasksForDate(dateISO: string): Promise<TaskViewModel[]> {
  const map = await getTasksForRange(dateISO, dateISO)
  return map[dateISO] ?? []
}

export async function addTask(
  dateISO: string,
  title: string,
  opts: Partial<Pick<Task, 'time' | 'categoryId' | 'deadline'>> = {}
): Promise<Task> {
  const count = await db.tasks.where('date').equals(dateISO).count()
  const task: Task = {
    id: createId(),
    date: dateISO,
    title,
    done: false,
    order: count,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...opts
  }
  await db.tasks.add(task)
  return task
}

async function resolveToRealTask(task: TaskViewModel): Promise<Task> {
  if (!task.virtual) {
    const { virtual: _virtual, ...rest } = task
    return rest
  }
  const rec = await db.recurrences.get(task.recurrenceId!)
  if (!rec) throw new Error('Recurrence not found for virtual task')
  return materializeOccurrence(rec, task.date)
}

export async function toggleTaskDone(task: TaskViewModel): Promise<void> {
  const real = await resolveToRealTask(task)
  await db.tasks.update(real.id, { done: !real.done, updatedAt: Date.now() })
}

export async function updateTask(task: TaskViewModel, patch: Partial<Task>): Promise<void> {
  const real = await resolveToRealTask(task)
  await db.tasks.update(real.id, { ...patch, updatedAt: Date.now() })
}

/** Split a series at this occurrence so older days keep their original rule. */
export async function updateFutureOccurrences(task: TaskViewModel, patch: Pick<Task, 'title' | 'time' | 'categoryId' | 'deadline'>): Promise<void> {
  if (!task.recurrenceId) return updateTask(task, patch)
  await db.transaction('rw', db.tasks, db.recurrences, async () => {
    const rec = await db.recurrences.get(task.recurrenceId!)
    if (!rec) throw new Error('This repeating item no longer exists.')
    const oldEnd = rec.endDate
    const future = await db.tasks.where('recurrenceId').equals(rec.id).and(t => t.date >= task.date).toArray()
    if (task.date === rec.startDate) {
      await db.recurrences.update(rec.id, { ...patch })
      await db.tasks.bulkPut(future.map(t => ({ ...t, ...patch, updatedAt: Date.now() })))
      return
    }
    await db.recurrences.update(rec.id, { endDate: toISODate(addDaysToDate(fromISODate(task.date), -1)), exceptions: rec.exceptions.filter(d => d < task.date) })
    const nextId = createId()
    await db.recurrences.add({ ...rec, ...patch, id: nextId, startDate: task.date, endDate: oldEnd, exceptions: rec.exceptions.filter(d => d >= task.date) })
    await db.tasks.bulkPut(future.map(t => ({ ...t, ...patch, recurrenceId: nextId, updatedAt: Date.now() })))
  })
}

export async function reorderTasks(dateISO: string, orderedIds: string[]): Promise<void> {
  await db.transaction('rw', db.tasks, db.recurrences, async () => {
    for (let i = 0; i < orderedIds.length; i++) {
      let id = orderedIds[i]
      if (id.startsWith('v:')) {
        const recId = id.slice(2, id.lastIndexOf(':'))
        const rec = await db.recurrences.get(recId)
        if (!rec) continue
        id = (await materializeOccurrence(rec, dateISO)).id
      }
      await db.tasks.update(id, { order: i, updatedAt: Date.now() })
    }
  })
}

export type DeleteScope = 'this' | 'all-future'

export async function deleteTask(task: TaskViewModel, scope: DeleteScope = 'this'): Promise<void> {
  if (!task.recurrenceId) {
    await db.tasks.delete(task.id)
    return
  }

  const rec = await db.recurrences.get(task.recurrenceId)
  if (!rec) {
    if (!task.virtual) await db.tasks.delete(task.id)
    return
  }

  if (scope === 'all-future') {
    const dayBeforeISO = toISODate(addDaysToDate(fromISODate(task.date), -1))
    if (task.date <= rec.startDate) {
      await db.recurrences.delete(rec.id)
    } else {
      await db.recurrences.update(rec.id, { endDate: dayBeforeISO })
    }
    await db.tasks.where('recurrenceId').equals(rec.id).and((t) => t.date >= task.date).delete()
  } else {
    if (!task.virtual) await db.tasks.delete(task.id)
    await db.recurrences.update(rec.id, { exceptions: [...new Set([...rec.exceptions, task.date])] })
  }
}

export async function restoreDeletedOccurrence(task: TaskViewModel): Promise<void> {
  await db.transaction('rw', db.tasks, db.recurrences, async () => {
    if (task.recurrenceId) {
      const rec = await db.recurrences.get(task.recurrenceId)
      if (rec) await db.recurrences.update(rec.id, { exceptions: rec.exceptions.filter(d => d !== task.date) })
    }
    if (!task.virtual) {
      const { virtual: _virtual, ...original } = task
      await db.tasks.put(original)
    }
  })
}

// ---------- Recurrences ----------

export async function addRecurrence(input: {
  title: string
  startDate: string
  rule: RepeatRule
  time?: string
  categoryId?: string
  deadline?: boolean
}): Promise<Recurrence> {
  const rec: Recurrence = { id: createId(), exceptions: [], ...input }
  await db.recurrences.add(rec)
  return rec
}

// ---------- Categories ----------

export async function getCategories(): Promise<Category[]> {
  return db.categories.orderBy('order').toArray()
}

export async function upsertCategory(category: Category): Promise<void> {
  await db.categories.put(category)
}

export async function deleteCategory(id: string): Promise<void> {
  await db.categories.delete(id)
}

// ---------- Templates ----------

export async function getTemplates(): Promise<Template[]> {
  return db.templates.toArray()
}

export async function upsertTemplate(template: Template): Promise<void> {
  await db.templates.put(template)
}

export async function deleteTemplate(id: string): Promise<void> {
  await db.templates.delete(id)
}

export async function applyTemplate(dateISO: string, template: Template): Promise<void> {
  const count = await db.tasks.where('date').equals(dateISO).count()
  const now = Date.now()
  const tasks: Task[] = template.tasks.map((t, i) => ({
    id: createId(),
    date: dateISO,
    title: t.title,
    time: t.time,
    categoryId: t.categoryId,
    done: false,
    order: count + i,
    createdAt: now,
    updatedAt: now
  }))
  await db.tasks.bulkAdd(tasks)
}

// ---------- Settings ----------

export async function getSetting<T>(key: string, defaultValue: T): Promise<T> {
  const row = await db.settings.get(key)
  return row ? (row.value as T) : defaultValue
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  const row: SettingsRow = { key, value }
  await db.settings.put(row)
}

// ---------- Due soon / roll-over ----------

export async function getDueSoon(limit = 5): Promise<TaskViewModel[]> {
  const today = todayISO()
  const horizonISO = toISODate(addDaysToDate(new Date(), 90))

  const map = await getTasksForRange(today, horizonISO)
  const all = Object.values(map)
    .flat()
    .filter((t) => t.deadline && !t.done)
    .sort((a, b) => (a.date + (a.time ?? '')).localeCompare(b.date + (b.time ?? '')))

  return all.slice(0, limit)
}

export async function getUnfinishedPast(): Promise<TaskViewModel[]> {
  const today = todayISO()
  const realPast = await db.tasks.where('date').below(today).and((t) => !t.done).toArray()
  return realPast.map(toViewModel)
}

/** Overdue tasks plus today's unfinished tasks — used for the Home Screen app badge. */
export async function getBadgeCount(): Promise<number> {
  const today = todayISO()
  const past = await getUnfinishedPast()
  const todayMap = await getTasksForRange(today, today)
  const todayUnfinished = (todayMap[today] ?? []).filter((t) => !t.done)
  return past.length + todayUnfinished.length
}

export async function moveTasksToToday(tasks: TaskViewModel[]): Promise<void> {
  const today = todayISO()
  await db.transaction('rw', db.tasks, async () => {
    for (const task of tasks) {
      if (task.virtual) continue
      await db.tasks.update(task.id, { date: today, updatedAt: Date.now() })
    }
  })
}

// ---------- Search ----------

export interface SearchResult {
  date: string
  kind: 'note' | 'task'
  snippet: string
  taskId?: string
}

export async function buildSearchIndex(): Promise<SearchResult[]> {
  const [days, tasks, recurrences] = await Promise.all([db.days.toArray(), db.tasks.toArray(), db.recurrences.toArray()])
  const results: SearchResult[] = []

  for (const day of days) {
    if (day.notes.trim()) {
      results.push({ date: day.date, kind: 'note', snippet: day.notes.slice(0, 120) })
    }
  }
  for (const task of tasks) {
    results.push({ date: task.date, kind: 'task', snippet: task.title, taskId: task.id })
  }
  for (const rec of recurrences) results.push({ date: rec.startDate, kind: 'task', snippet: `${rec.title} (repeats)` })

  return results.sort((a, b) => b.date.localeCompare(a.date))
}

export function searchIndex(index: SearchResult[], query: string): SearchResult[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return index.filter(r => r.snippet.toLowerCase().includes(q))
}

// ---------- Export / Import ----------

export interface ExportBundle {
  version: 1 | 2 | 3 | 4
  exportedAt: string
  days: Day[]
  tasks: Task[]
  recurrences: Recurrence[]
  categories: Category[]
  templates: Template[]
  settings?: SettingsRow[]
  ink?: InkDocument[]
  revisionTopics?: RevisionTopic[]
  skills?: SkillEntry[]
  milestones?: Milestone[]
}

export async function exportAll(): Promise<ExportBundle> {
  const [days, tasks, recurrences, categories, templates, settings, ink, revisionTopics, skills, milestones] = await Promise.all([
    db.days.toArray(),
    db.tasks.toArray(),
    db.recurrences.toArray(),
    db.categories.toArray(),
    db.templates.toArray(),
    db.settings.toArray(),
    db.ink.toArray(),
    db.revisionTopics.toArray(),
    db.skills.toArray(),
    db.milestones.toArray()
  ])
  return { version: 4, exportedAt: new Date().toISOString(), days, tasks, recurrences, categories, templates, settings: settings.filter(row => !['syncAccountId', 'installationId'].includes(row.key)), ink, revisionTopics, skills, milestones }
}

export type ImportMode = 'merge' | 'replace'

export async function importAll(bundle: ExportBundle, mode: ImportMode): Promise<void> {
  const removedKeys: { table: (typeof SYNC_TABLES)[number]; id: string }[] = []
  if (mode === 'replace') {
    for (const table of SYNC_TABLES) {
      const rows = await db[table].toArray() as unknown as Record<string, unknown>[]
      for (const row of rows) removedKeys.push({ table, id: String(row[table === 'days' || table === 'ink' ? 'date' : 'id']) })
    }
  }
  await db.transaction('rw', [db.days, db.tasks, db.recurrences, db.categories, db.templates, db.settings, db.ink, db.revisionTopics, db.skills, db.milestones], async () => {
    const installation = await db.settings.get('installationId')
    const syncAccount = await db.settings.get('syncAccountId')
    const cloudEnabled = await db.settings.get('cloudEnabled')
    if (mode === 'replace') {
      await Promise.all([
        db.days.clear(),
        db.tasks.clear(),
        db.recurrences.clear(),
        db.categories.clear(),
        db.templates.clear(),
        db.settings.clear(),
        db.ink.clear(),
        db.revisionTopics.clear(),
        db.skills.clear(),
        db.milestones.clear()
      ])
    }
    await db.days.bulkPut(bundle.days)
    await db.tasks.bulkPut(bundle.tasks)
    await db.recurrences.bulkPut(bundle.recurrences)
    await db.categories.bulkPut(bundle.categories)
    await db.templates.bulkPut(bundle.templates)
    if (bundle.ink) await db.ink.bulkPut(bundle.ink)
    if (bundle.revisionTopics) await db.revisionTopics.bulkPut(bundle.revisionTopics)
    if (bundle.skills) await db.skills.bulkPut(bundle.skills)
    if (bundle.milestones) await db.milestones.bulkPut(bundle.milestones)
    if (bundle.settings) await db.settings.bulkPut(bundle.settings.filter(row => row.key !== 'lastExportAt' && row.key !== 'installationId' && row.key !== 'syncAccountId' && row.key !== 'cloudEnabled'))
    await db.settings.put({ key: 'seeded', value: true })
    if (installation) await db.settings.put(installation)
    if (syncAccount) await db.settings.put(syncAccount)
    if (cloudEnabled) await db.settings.put(cloudEnabled)
  })
  for (const item of removedKeys) await enqueueChange(item.table, item.id)
}
