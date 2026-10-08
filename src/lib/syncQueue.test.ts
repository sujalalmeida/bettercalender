import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { db } from '../db/db'
import { importAll } from '../db/repository'
import { applyRemoteChange, installSyncTracking, waitForQueuedChanges } from './syncQueue'

beforeAll(async () => {
  await db.open()
  await db.days.clear()
  await db.syncChanges.clear()
  installSyncTracking()
})
afterAll(async () => {
  await db.days.clear()
  await db.syncChanges.clear()
  db.close()
})

describe('durable cloud queue', () => {
  it('records edits and deletion of a saved day', async () => {
    await db.days.put({ date: '2026-10-08', notes: 'Pencil note', updatedAt: 1 })
    await waitForQueuedChanges()
    expect((await db.syncChanges.get('days:2026-10-08'))?.id).toBe('2026-10-08')

    await db.syncChanges.clear()
    await db.days.delete('2026-10-08')
    await waitForQueuedChanges()
    expect((await db.syncChanges.get('days:2026-10-08'))?.collection).toBe('days')
  })

  it('does not queue a cloud change received locally', async () => {
    await db.syncChanges.clear()
    await applyRemoteChange(db.days, () => db.days.put({ date: '2026-10-09', notes: 'From iPad', updatedAt: 2 }).then(() => undefined))
    await waitForQueuedChanges()
    expect(await db.syncChanges.count()).toBe(0)
  })

  it('queues deletions when a backup replaces the local database', async () => {
    await db.syncChanges.clear()
    await db.settings.put({ key: 'syncAccountId', value: 'account-1' })
    await importAll({ version: 3, exportedAt: new Date().toISOString(), days: [], ink: [], tasks: [], recurrences: [], categories: [], templates: [] }, 'replace')
    await waitForQueuedChanges()
    expect(await db.days.get('2026-10-09')).toBeUndefined()
    expect(await db.syncChanges.get('days:2026-10-09')).toBeTruthy()
    expect((await db.settings.get('syncAccountId'))?.value).toBe('account-1')
  })
})
