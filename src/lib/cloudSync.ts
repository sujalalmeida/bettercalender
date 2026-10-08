import { initializeApp, getApps } from 'firebase/app'
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, signOut, type User } from 'firebase/auth'
import { collection, deleteDoc, doc, getDoc, getDocsFromServer, getFirestore, onSnapshot, setDoc, type DocumentData, type Unsubscribe } from 'firebase/firestore'
import { db } from '../db/db'
import { SYNC_TABLES, type SyncTable, enqueueChange, onSyncChange, waitForQueuedChanges, applyRemoteChange } from './syncQueue'

export interface CloudState { email: string | null; status: string; syncing: boolean; configured: boolean }
const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
}
const configured = Boolean(config.apiKey && config.authDomain && config.projectId && config.appId)
let state: CloudState = { email: null, status: configured ? 'Sign in to sync across devices.' : 'Firebase is not configured.', syncing: false, configured }
const subscribers = new Set<(state: CloudState) => void>()
const emit = (patch: Partial<CloudState>) => { state = { ...state, ...patch }; subscribers.forEach(fn => fn(state)) }
export const getCloudState = () => state
export function subscribeCloudState(fn: (state: CloudState) => void): () => void { subscribers.add(fn); fn(state); return () => subscribers.delete(fn) }

const app = configured ? (getApps()[0] ?? initializeApp(config)) : null
const auth = app ? getAuth(app) : null
const firestore = app ? getFirestore(app) : null
let currentUser: User | null = null
let unsubscribeSnapshot: Unsubscribe | null = null
let started = false
let flushing = false
let flushAgain = false
let flushTimer: ReturnType<typeof setTimeout> | null = null
let incoming: Promise<void> = Promise.resolve()
let startingSync = false
let generation = 0

const primaryKey = (table: SyncTable) => table === 'days' || table === 'ink' ? 'date' : 'id'
const localTable = (name: SyncTable) => db[name] as typeof db.days
const recordKey = (table: SyncTable, id: string) => `${table}:${id}`
const cloudDocId = (key: string) => encodeURIComponent(key)
const cloudRecords = (uid: string) => collection(firestore!, 'users', uid, 'records')
const inkPart = (uid: string, date: string, revision: string, index: number) =>
  doc(firestore!, 'users', uid, 'ink', encodeURIComponent(date), 'versions', revision, 'parts', String(index))
const INK_CHUNK_LENGTH = 100_000

function decodeRecord(raw: DocumentData): { table: SyncTable; id: string; payload?: Record<string, unknown>; deleted?: boolean; updatedAt: number } | null {
  if (!SYNC_TABLES.includes(raw.table)) return null
  if (typeof raw.id !== 'string') return null
  return { table: raw.table, id: raw.id, payload: raw.payload, deleted: raw.deleted, updatedAt: Number(raw.updatedAt) || 0 }
}

async function receive(raw: DocumentData): Promise<void> {
  const item = decodeRecord(raw)
  if (!item) return
  const key = recordKey(item.table, item.id)
  if (await db.syncChanges.get(key)) return
  const table = localTable(item.table)
  const current = await table.get(item.id) as Record<string, unknown> | undefined
  if (item.deleted) {
    if (current && (Number(current.updatedAt) || 0) > item.updatedAt) { await enqueueChange(item.table, item.id); return }
    if (current) await applyRemoteChange(table, () => table.delete(item.id))
  } else {
    if (item.table === 'ink' && typeof raw.partCount === 'number' && typeof raw.inkRevision === 'string' && currentUser) {
      const chunks = await Promise.all(Array.from({ length: raw.partCount }, (_, index) =>
        getDoc(inkPart(currentUser!.uid, item.id, raw.inkRevision, index))))
      if (chunks.some(snap => !snap.exists() || typeof snap.data()?.data !== 'string')) throw new Error('Handwriting cloud data is incomplete.')
      item.payload = JSON.parse(chunks.map(snap => snap.data()!.data as string).join(''))
    }
    if (!item.payload) return
    const localTime = Number(current?.updatedAt) || 0
    if (current && localTime > item.updatedAt) { await enqueueChange(item.table, item.id); return }
    if (!current || JSON.stringify(current) !== JSON.stringify(item.payload)) {
      await applyRemoteChange(table, () => table.put(item.payload as never).then(() => undefined))
    }
  }
}

async function initialReconcile(uid: string, expectedGeneration: number): Promise<void> {
  const remote = await getDocsFromServer(cloudRecords(uid))
  if (expectedGeneration !== generation) return
  await waitForQueuedChanges()
  const remoteKeys = new Set<string>()
  for (const snap of remote.docs) {
    if (expectedGeneration !== generation) return
    const item = decodeRecord(snap.data())
    if (!item) continue
    remoteKeys.add(recordKey(item.table, item.id))
    await receive(snap.data())
  }
  for (const name of SYNC_TABLES) {
    if (expectedGeneration !== generation) return
    const rows = await localTable(name).toArray() as unknown as Record<string, unknown>[]
    for (const row of rows) {
      const id = String(row[primaryKey(name)])
      const key = recordKey(name, id)
      if (!remoteKeys.has(key) && !(await db.syncChanges.get(key))) await enqueueChange(name, id)
    }
  }
}

async function flush(): Promise<void> {
  if (flushing || startingSync) { flushAgain = true; return }
  if (!currentUser || !firestore || !navigator.onLine) return
  flushing = true
  emit({ syncing: true, status: 'Syncing…' })
  const uid = currentUser.uid
  try {
    await waitForQueuedChanges()
    const changes = await db.syncChanges.toArray()
    for (const change of changes) {
      if (currentUser?.uid !== uid) break
      if (!SYNC_TABLES.includes(change.collection as SyncTable)) continue
      const table = change.collection as SyncTable
      const payload = await localTable(table).get(change.id)
      const record = {
        table,
        id: change.id,
        deleted: !payload,
        updatedAt: Date.now(),
        // Firestore rejects undefined values. JSON also keeps the remote record compact.
        ...(payload ? { payload: JSON.parse(JSON.stringify(payload)) } : {})
      }
      if (table === 'ink' && payload) {
        const oldManifest = await getDoc(doc(cloudRecords(uid), cloudDocId(change.key)))
        const old = oldManifest.data()
        const json = JSON.stringify(payload)
        const partCount = Math.ceil(json.length / INK_CHUNK_LENGTH)
        for (let index = 0; index < partCount; index++) {
          await setDoc(inkPart(uid, change.id, change.revision, index), { data: json.slice(index * INK_CHUNK_LENGTH, (index + 1) * INK_CHUNK_LENGTH) })
        }
        await setDoc(doc(cloudRecords(uid), cloudDocId(change.key)), { table, id: change.id, deleted: false, updatedAt: record.updatedAt, inkRevision: change.revision, partCount })
        if (old && typeof old.inkRevision === 'string' && old.inkRevision !== change.revision && typeof old.partCount === 'number') {
          // Old versions are no longer referenced by the manifest.
          void Promise.all(Array.from({ length: old.partCount }, (_, index) => deleteDoc(inkPart(uid, change.id, old.inkRevision, index)))).catch(error => console.warn('Could not remove old handwriting chunks', error))
        }
      } else {
        const old = table === 'ink' ? (await getDoc(doc(cloudRecords(uid), cloudDocId(change.key)))).data() : null
        await setDoc(doc(cloudRecords(uid), cloudDocId(change.key)), record)
        if (old && typeof old.inkRevision === 'string' && typeof old.partCount === 'number') {
          void Promise.all(Array.from({ length: old.partCount }, (_, index) => deleteDoc(inkPart(uid, change.id, old.inkRevision, index)))).catch(error => console.warn('Could not remove deleted handwriting chunks', error))
        }
      }
      const latest = await db.syncChanges.get(change.key)
      if (latest?.revision === change.revision) await db.syncChanges.delete(change.key)
    }
    emit({ status: (await db.syncChanges.count()) ? 'Changes waiting to sync.' : 'Saved on this device and synced to Firebase.' })
  } catch (error) {
    console.error('Cloud sync failed', error)
    flushAgain = false
    emit({ status: 'Sync paused. Your changes are saved on this device; check your connection and Firebase setup.' })
  } finally {
    flushing = false
    emit({ syncing: false })
    if (flushAgain && currentUser?.uid === uid) { flushAgain = false; void flush() }
  }
}

async function connect(user: User): Promise<void> {
  const myGeneration = ++generation
  unsubscribeSnapshot?.()
  unsubscribeSnapshot = null
  currentUser = user
  const bound = (await db.settings.get('syncAccountId'))?.value
  if (bound && bound !== user.uid) {
    await signOut(auth!)
    await db.settings.put({ key: 'cloudEnabled', value: false })
    emit({ email: null, status: 'This device has data linked to another account. Sign in with the original account to avoid mixing private calendars.' })
    return
  }
  if (!bound) await db.settings.put({ key: 'syncAccountId', value: user.uid })
  emit({ email: user.email, status: 'Connecting to Firebase…', syncing: true })
  startingSync = true
  try {
    await initialReconcile(user.uid, myGeneration)
    if (myGeneration !== generation) return
    unsubscribeSnapshot = onSnapshot(cloudRecords(user.uid), snapshot => {
      for (const change of snapshot.docChanges()) {
        if (change.type !== 'removed') incoming = incoming.catch(() => undefined).then(() => myGeneration === generation ? receive(change.doc.data()) : undefined).catch(err => {
          console.error('Could not apply cloud record', err)
          emit({ status: 'Could not read a cloud record. Local data is still saved; try Sync now.' })
        })
      }
    }, error => {
      console.error('Cloud listener failed', error)
      emit({ status: 'Live sync stopped. Changes remain on this device; check Firebase permissions.' })
    })
    emit({ status: 'Syncing…' })
  } catch (error) {
    console.error('Cloud connection failed', error)
    emit({ status: navigator.onLine ? 'Could not reach Firebase. Check Firestore setup and rules.' : 'Offline. Changes remain saved on this device.' })
  } finally {
    startingSync = false
    emit({ syncing: false })
    void flush()
  }
}

export function startCloudSync(): void {
  if (started || !auth) return
  started = true
  onSyncChange(change => {
    if (flushTimer) clearTimeout(flushTimer)
    flushTimer = setTimeout(() => { flushTimer = null; void flush() }, change.collection === 'ink' ? 4000 : 250)
  })
  onAuthStateChanged(auth, user => {
    if (user) void connect(user)
    else {
      generation++
      currentUser = null
      unsubscribeSnapshot?.()
      unsubscribeSnapshot = null
      emit({ email: null, syncing: false, status: 'Saved on this device. Sign in to sync across devices.' })
    }
  })
  window.addEventListener('online', () => { if (currentUser) void connect(currentUser) })
}

export async function logIn(email: string, password: string): Promise<void> {
  if (!auth) throw new Error('Firebase is not configured.')
  await signInWithEmailAndPassword(auth, email, password)
  await db.settings.put({ key: 'cloudEnabled', value: true })
}
export async function createAccount(email: string, password: string): Promise<void> {
  if (!auth) throw new Error('Firebase is not configured.')
  await createUserWithEmailAndPassword(auth, email, password)
  await db.settings.put({ key: 'cloudEnabled', value: true })
}
export async function resetPassword(email: string): Promise<void> {
  if (!auth) throw new Error('Firebase is not configured.')
  await sendPasswordResetEmail(auth, email)
}
export async function logOut(): Promise<void> { if (auth) await signOut(auth); await db.settings.put({ key: 'cloudEnabled', value: false }) }
export async function syncNow(): Promise<void> { if (currentUser) { await connect(currentUser); await flush() } }
