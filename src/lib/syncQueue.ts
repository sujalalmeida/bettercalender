import Dexie, { type Table, type Transaction } from 'dexie'
import { db, type SyncChange } from '../db/db'
import { createId } from './id'

export const SYNC_TABLES = ['days', 'ink', 'tasks', 'recurrences', 'categories', 'templates'] as const
export type SyncTable = (typeof SYNC_TABLES)[number]
const listeners = new Set<(change: SyncChange) => void>()
let pending: Promise<void> = Promise.resolve()
type RemoteTransaction = Transaction & { cloudRemote?: boolean }

export function onSyncChange(listener: (change: SyncChange) => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function waitForQueuedChanges(): Promise<void> { return pending }

export function enqueueChange(collection: SyncTable, id: string): Promise<void> {
  const change: SyncChange = { key: `${collection}:${id}`, collection, id, revision: createId() }
  pending = pending.catch(() => undefined).then(async () => {
    await db.syncChanges.put(change)
    listeners.forEach(listener => listener(change))
  })
  return pending
}

// Dexie hooks run inside the local write transaction. Queue only after it commits.
// Remote transactions are marked so received records are never echoed back.
export function installSyncTracking(): void {
  for (const name of SYNC_TABLES) {
    const table = db[name] as unknown as Table<Record<string, unknown>, string>
    table.hook('creating', (key, value, tx) => {
      if ((tx as RemoteTransaction).cloudRemote) return
      const id = String(key ?? value[name === 'days' || name === 'ink' ? 'date' : 'id'])
      tx.on('complete', () => { void enqueueChange(name, id) })
    })
    table.hook('updating', (_changes, key, _value, tx) => {
      if (!(tx as RemoteTransaction).cloudRemote) tx.on('complete', () => { void enqueueChange(name, String(key)) })
    })
    table.hook('deleting', (key, _value, tx) => {
      if (!(tx as RemoteTransaction).cloudRemote) tx.on('complete', () => { void enqueueChange(name, String(key)) })
    })
  }
}

export async function applyRemoteChange(table: Table, action: () => Promise<void>): Promise<void> {
  await db.transaction('rw', table, async () => {
    const tx = Dexie.currentTransaction as RemoteTransaction | null
    if (tx) tx.cloudRemote = true
    await action()
  })
}
