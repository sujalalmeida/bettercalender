import type { ComponentType } from 'preact'
import type {
  CollectionReference,
  DocumentData,
  Firestore
} from 'firebase/firestore'
import type { SyncChange } from '../db/db'

export interface PersonalSyncHooks {
  validateRecord(id: string, payload: unknown): void
  beforeReceive(payload: Record<string, unknown>): Promise<void>
  upload(context: {
    firestore: Firestore
    collection: CollectionReference
    change: SyncChange
    record: DocumentData
    deadline: <T>(operation: Promise<T>) => Promise<T>
  }): Promise<void>
}

export interface PersonalFeature {
  databaseStores: Record<string, string>
  syncTables: readonly string[]
  launch?: { label: string; query: string; target: string }
  loadPage?: () => Promise<ComponentType>
  loadSyncHooks?: () => Promise<{ default: PersonalSyncHooks }>
}

// A missing local entry produces an empty module map, so fresh checkouts build.
const modules = import.meta.glob<{ default: PersonalFeature }>(
  '../../private/entry.ts',
  { eager: true }
)
export const personalFeature: PersonalFeature = Object.values(modules)[0]
  ?.default ?? {
  databaseStores: {},
  syncTables: []
}
