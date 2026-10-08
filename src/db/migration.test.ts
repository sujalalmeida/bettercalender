import Dexie from 'dexie'
import { describe, expect, it } from 'vitest'
import { PlanDatabase } from './db'

describe('database upgrade', () => {
  it('adds ink storage without changing existing day notes', async () => {
    const legacy = new Dexie('plan-db')
    legacy.version(1).stores({
      days: '&date, updatedAt',
      tasks: '&id, date, deadline, [done+date], recurrenceId',
      recurrences: '&id, startDate',
      categories: '&id, order',
      templates: '&id',
      settings: '&key'
    })
    await legacy.open()
    await legacy.table('days').put({ date: '2026-10-08', notes: 'Existing notes', updatedAt: 1 })
    legacy.close()

    const upgraded = new PlanDatabase()
    await upgraded.open()
    expect((await upgraded.days.get('2026-10-08'))?.notes).toBe('Existing notes')
    expect(await upgraded.ink.count()).toBe(0)
    expect(await upgraded.revisionTopics.count()).toBe(0)
    expect(await upgraded.skills.count()).toBe(0)
    expect(await upgraded.milestones.count()).toBe(0)
    upgraded.close()
    await Dexie.delete('plan-db')
  })
})
