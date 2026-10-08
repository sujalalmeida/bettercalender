import Dexie, { type Table } from 'dexie'
import type { Category, Day, InkDocument, Recurrence, SettingsRow, Task, Template } from './types'

export interface SyncChange { key: string; collection: string; id: string; revision: string }

export class PlanDatabase extends Dexie {
  days!: Table<Day, string>
  ink!: Table<InkDocument, string>
  tasks!: Table<Task, string>
  recurrences!: Table<Recurrence, string>
  categories!: Table<Category, string>
  templates!: Table<Template, string>
  settings!: Table<SettingsRow, string>
  syncChanges!: Table<SyncChange, string>

  constructor() {
    super('plan-db')

    // v1: initial schema.
    this.version(1).stores({
      days: '&date, updatedAt',
      tasks: '&id, date, deadline, [done+date], recurrenceId',
      recurrences: '&id, startDate',
      categories: '&id, order',
      templates: '&id',
      settings: '&key'
    })

    // v2 adds handwritten pages without modifying existing notes or tasks.
    this.version(2).stores({ ink: '&date, updatedAt' })

    // Pending cloud writes survive reloads and offline periods.
    this.version(3).stores({ syncChanges: '&key' })

    // Example migration for future changes (bumping version adds an index
    // without touching existing rows, so her data is preserved):
    // this.version(2).stores({
    //   tasks: '&id, date, deadline, [done+date], recurrenceId, categoryId',
    // }).upgrade(tx => {
    //   // transform existing rows here if needed
    // })
  }
}

export const db = new PlanDatabase()

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'study', name: 'Study', color: '#3b82f6', order: 0 },
  { id: 'clinical', name: 'Clinical', color: '#10b981', order: 1 },
  { id: 'exam', name: 'Exam', color: '#ef4444', order: 2 },
  { id: 'personal', name: 'Personal', color: '#f59e0b', order: 3 },
  { id: 'health', name: 'Health', color: '#06b6d4', order: 4 },
  { id: 'social', name: 'Social', color: '#a855f7', order: 5 }
]

export const DEFAULT_TEMPLATES: Template[] = [
  { id: 'study-block', name: 'Study block', tasks: [{ title: 'Study block', categoryId: 'study' }] },
  { id: 'clinical-shift', name: 'Clinical shift', tasks: [{ title: 'Clinical shift', categoryId: 'clinical' }] },
  { id: 'exam-prep', name: 'Exam prep', tasks: [{ title: 'Exam prep', categoryId: 'exam' }] }
]

export async function ensureSeedData(): Promise<void> {
  await db.transaction('rw', db.categories, db.templates, db.settings, async () => {
    if (await db.settings.get('seeded')) return
    if (await db.categories.count() === 0) await db.categories.bulkAdd(DEFAULT_CATEGORIES)
    if (await db.templates.count() === 0) await db.templates.bulkAdd(DEFAULT_TEMPLATES)
    await db.settings.put({ key: 'seeded', value: true })
  })
}
