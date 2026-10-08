import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import {
  addRecurrence,
  addTask,
  deleteTask,
  getTasksForRange,
  toggleTaskDone,
  updateFutureOccurrences,
  restoreDeletedOccurrence,
  exportAll,
  importAll,
  setSetting,
  getSetting,
  reorderTasks,
  saveInk,
  getInk,
  getInkDatesForRange
} from './repository'

beforeEach(async () => {
  await db.open()
})

afterEach(async () => {
  await db.transaction(
    'rw',
    [db.days, db.tasks, db.recurrences, db.categories, db.templates, db.settings, db.ink],
    async () => {
      await Promise.all([
        db.days.clear(),
        db.tasks.clear(),
        db.recurrences.clear(),
        db.categories.clear(),
        db.templates.clear(),
        db.settings.clear(),
        db.ink.clear()
      ])
    }
  )
})

describe('getTasksForRange', () => {
  it('returns one-off tasks within the date range', async () => {
    await addTask('2026-01-02', 'Buy groceries')
    await addTask('2026-01-10', 'Outside range')

    const result = await getTasksForRange('2026-01-01', '2026-01-05')
    expect(result['2026-01-02']).toHaveLength(1)
    expect(result['2026-01-02'][0].title).toBe('Buy groceries')
    expect(result['2026-01-10']).toBeUndefined()
  })

  it('expands recurring tasks as virtual occurrences', async () => {
    await addRecurrence({ title: 'Morning run', startDate: '2026-01-01', rule: { frequency: 'daily' } })

    const result = await getTasksForRange('2026-01-01', '2026-01-03')
    expect(result['2026-01-01'][0]).toMatchObject({ title: 'Morning run', virtual: true })
    expect(result['2026-01-02'][0].virtual).toBe(true)
    expect(result['2026-01-03'][0].virtual).toBe(true)
  })

  it('prefers a materialized occurrence over its virtual counterpart', async () => {
    const rec = await addRecurrence({ title: 'Morning run', startDate: '2026-01-01', rule: { frequency: 'daily' } })
    const [virtualOccurrence] = (await getTasksForRange('2026-01-02', '2026-01-02'))['2026-01-02']

    await toggleTaskDone(virtualOccurrence)

    const result = await getTasksForRange('2026-01-01', '2026-01-03')
    const jan2 = result['2026-01-02']
    expect(jan2).toHaveLength(1)
    expect(jan2[0].virtual).toBe(false)
    expect(jan2[0].done).toBe(true)
    expect(jan2[0].recurrenceId).toBe(rec.id)

    // Other occurrences remain untouched and still virtual.
    expect(result['2026-01-01'][0].done).toBe(false)
    expect(result['2026-01-01'][0].virtual).toBe(true)
  })

  it('deleting "this" occurrence only removes that date, not future ones', async () => {
    await addRecurrence({ title: 'Clinic', startDate: '2026-01-01', rule: { frequency: 'daily' } })
    const occurrence = (await getTasksForRange('2026-01-02', '2026-01-02'))['2026-01-02'][0]

    await deleteTask(occurrence, 'this')

    const result = await getTasksForRange('2026-01-01', '2026-01-03')
    expect(result['2026-01-02']).toBeUndefined()
    expect(result['2026-01-01']).toHaveLength(1)
    expect(result['2026-01-03']).toHaveLength(1)
  })

  it('deleting "all-future" truncates the recurrence from that date on', async () => {
    await addRecurrence({ title: 'Clinic', startDate: '2026-01-01', rule: { frequency: 'daily' } })
    const occurrence = (await getTasksForRange('2026-01-03', '2026-01-03'))['2026-01-03'][0]

    await deleteTask(occurrence, 'all-future')

    const result = await getTasksForRange('2026-01-01', '2026-01-05')
    expect(result['2026-01-01']).toHaveLength(1)
    expect(result['2026-01-02']).toHaveLength(1)
    expect(result['2026-01-03']).toBeUndefined()
    expect(result['2026-01-04']).toBeUndefined()
  })

  it('splits future edits while preserving earlier and completed occurrences', async () => {
    await addRecurrence({ title: 'Clinic', startDate: '2026-01-01', rule: { frequency: 'daily' } })
    const completed = (await getTasksForRange('2026-01-04', '2026-01-04'))['2026-01-04'][0]
    await toggleTaskDone(completed)
    const occurrence = (await getTasksForRange('2026-01-03', '2026-01-03'))['2026-01-03'][0]
    await updateFutureOccurrences(occurrence, { title: 'New clinic', time: '09:00', categoryId: undefined, deadline: false })
    const result = await getTasksForRange('2026-01-02', '2026-01-05')
    expect(result['2026-01-02'][0].title).toBe('Clinic')
    expect(result['2026-01-03'][0].title).toBe('New clinic')
    expect(result['2026-01-04'][0]).toMatchObject({ title: 'New clinic', done: true })
    expect(result['2026-01-05'][0].title).toBe('New clinic')
  })

  it('restores a deleted recurring occurrence', async () => {
    await addRecurrence({ title: 'Clinic', startDate: '2026-01-01', rule: { frequency: 'daily' } })
    const occurrence = (await getTasksForRange('2026-01-02', '2026-01-02'))['2026-01-02'][0]
    await deleteTask(occurrence)
    await restoreDeletedOccurrence(occurrence)
    expect((await getTasksForRange('2026-01-02', '2026-01-02'))['2026-01-02']).toHaveLength(1)
  })

  it('round-trips settings through a backup', async () => {
    await setSetting('theme', 'dark')
    const bundle = await exportAll()
    expect(bundle.version).toBe(3)
    await setSetting('theme', 'light')
    await importAll(bundle, 'replace')
    expect(await getSetting('theme', 'system')).toBe('dark')
  })

  it('persists a reordered virtual occurrence for that day only', async () => {
    await addTask('2026-01-02', 'One-off')
    await addRecurrence({ title: 'Daily', startDate: '2026-01-01', rule: { frequency: 'daily' } })
    const before = (await getTasksForRange('2026-01-02', '2026-01-02'))['2026-01-02']
    await reorderTasks('2026-01-02', [before.find(t => t.title === 'One-off')!.id, before.find(t => t.title === 'Daily')!.id])
    const after = (await getTasksForRange('2026-01-02', '2026-01-02'))['2026-01-02']
    expect(after.map(t => t.title)).toEqual(['One-off', 'Daily'])
    expect(after.every(t => !t.virtual)).toBe(true)
  })

  it('saves handwritten pages separately and includes them in backups', async () => {
    const ink = { date: '2026-01-02', updatedAt: 1, pages: [{ id: 'p1', strokes: [{ id: 's1', color: '#182331', size: 5, points: [{ x: 10, y: 20, pressure: 0.5 }] }] }] }
    await saveInk(ink)
    expect(await getInkDatesForRange('2026-01-01', '2026-01-03')).toEqual(['2026-01-02'])
    const bundle = await exportAll()
    await db.ink.clear()
    await importAll(bundle, 'merge')
    expect((await getInk('2026-01-02'))?.pages[0].strokes[0].points[0].x).toBe(10)
  })
})
