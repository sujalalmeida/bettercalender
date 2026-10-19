import { initializeApp, getApps } from 'firebase/app'
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, signOut, type User } from 'firebase/auth'
import { collection, deleteDoc, doc, getDoc, getDocsFromServer, getFirestore, onSnapshot, setDoc, type DocumentData, type Unsubscribe } from 'firebase/firestore'
import { db, type SyncChange } from '../db/db'
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
let connected = false
let readError = false
let generation = 0
let flushDueAt = 0
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let retryDelay = 1000

function scheduleFlush(delay: number) {
  const due = Date.now() + delay
  if (flushTimer && flushDueAt <= due) return
  if (flushTimer) clearTimeout(flushTimer)
  flushDueAt = due
  flushTimer = setTimeout(() => { flushTimer = null; void flush() }, delay)
}

function scheduleReconnect() {
  if (reconnectTimer || !currentUser) return
  const expectedGeneration = generation
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    if (currentUser && expectedGeneration === generation) void connect(currentUser)
  }, retryDelay)
  retryDelay = Math.min(retryDelay * 2, 30000)
}

async function networkDeadline<T>(operation: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([operation, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Firebase request timed out')), 20000)
    })])
  } finally { if (timer) clearTimeout(timer) }
}

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

async function receive(raw: DocumentData, uid: string, expectedGeneration: number): Promise<void> {
  const item = decodeRecord(raw)
  if (!item) return
  await waitForQueuedChanges()
  if (expectedGeneration !== generation) return
  const key = recordKey(item.table, item.id)
  if (await db.syncChanges.get(key)) return
  const table = localTable(item.table)
  if (!item.deleted && item.table === 'ink' && typeof raw.partCount === 'number' && typeof raw.inkRevision === 'string') {
    const chunks = await Promise.all(Array.from({ length: raw.partCount }, (_, index) =>
      networkDeadline(getDoc(inkPart(uid, item.id, raw.inkRevision, index)))))
    if (chunks.some(snap => !snap.exists() || typeof snap.data()?.data !== 'string')) throw new Error('Handwriting cloud data is incomplete.')
    item.payload = JSON.parse(chunks.map(snap => snap.data()!.data as string).join(''))
  }
  if (!item.deleted && !item.payload) return
  // Check local edits and apply the cloud version in one transaction. In particular,
  // a slow Pencil download must not replace strokes written while it was in flight.
  await waitForQueuedChanges()
  let requeue = false
  await applyRemoteChange(table, async () => {
    if (expectedGeneration !== generation || await db.syncChanges.get(key)) return
    const latest = await table.get(item.id) as Record<string, unknown> | undefined
    if (latest && (Number(latest.updatedAt) || 0) > item.updatedAt) { requeue = true; return }
    if (item.deleted) {
      if (latest) await table.delete(item.id)
    } else if (!latest || JSON.stringify(latest) !== JSON.stringify(item.payload)) {
      await table.put(item.payload as never)
    }
  }, [db.syncChanges])
  if (requeue) await enqueueChange(item.table, item.id)
}

async function initialReconcile(uid: string, expectedGeneration: number): Promise<boolean> {
  const remote = await networkDeadline(getDocsFromServer(cloudRecords(uid)))
  if (expectedGeneration !== generation) return false
  await waitForQueuedChanges()
  let failed = false
  const remoteKeys = new Set<string>()
  for (const snap of remote.docs) {
    if (expectedGeneration !== generation) return failed
    const item = decodeRecord(snap.data())
    if (!item) continue
    remoteKeys.add(recordKey(item.table, item.id))
    try { await receive(snap.data(), uid, expectedGeneration) }
    catch (error) { failed = true; console.error('Could not read cloud record', item.table, error) }
  }
  for (const name of SYNC_TABLES) {
    if (expectedGeneration !== generation) return failed
    const rows = await localTable(name).toArray() as unknown as Record<string, unknown>[]
    for (const row of rows) {
      const id = String(row[primaryKey(name)])
      const key = recordKey(name, id)
      if (!remoteKeys.has(key) && !(await db.syncChanges.get(key))) await enqueueChange(name, id)
    }
  }
  return failed
}

async function uploadChange(uid: string, change: SyncChange): Promise<void> {
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
    const oldManifest = await networkDeadline(getDoc(doc(cloudRecords(uid), cloudDocId(change.key))))
    const old = oldManifest.data()
    const json = JSON.stringify(payload)
    const partCount = Math.ceil(json.length / INK_CHUNK_LENGTH)
    for (let start = 0; start < partCount; start += 4) {
      await Promise.all(Array.from({ length: Math.min(4, partCount - start) }, (_, offset) => {
        const index = start + offset
        return networkDeadline(setDoc(inkPart(uid, change.id, change.revision, index), { data: json.slice(index * INK_CHUNK_LENGTH, (index + 1) * INK_CHUNK_LENGTH) }))
      }))
    }
    await networkDeadline(setDoc(doc(cloudRecords(uid), cloudDocId(change.key)), { table, id: change.id, deleted: false, updatedAt: record.updatedAt, inkRevision: change.revision, partCount }))
    if (old && typeof old.inkRevision === 'string' && old.inkRevision !== change.revision && typeof old.partCount === 'number') {
      // Old versions are no longer referenced by the manifest.
      void Promise.all(Array.from({ length: old.partCount }, (_, index) => deleteDoc(inkPart(uid, change.id, old.inkRevision, index)))).catch(error => console.warn('Could not remove old handwriting chunks', error))
    }
  } else {
    const old = table === 'ink' ? (await networkDeadline(getDoc(doc(cloudRecords(uid), cloudDocId(change.key))))).data() : null
    await networkDeadline(setDoc(doc(cloudRecords(uid), cloudDocId(change.key)), record))
    if (old && typeof old.inkRevision === 'string' && typeof old.partCount === 'number') {
      void Promise.all(Array.from({ length: old.partCount }, (_, index) => deleteDoc(inkPart(uid, change.id, old.inkRevision, index)))).catch(error => console.warn('Could not remove deleted handwriting chunks', error))
    }
  }
}

async function flush(): Promise<void> {
  if (flushing || startingSync) { flushAgain = true; return }
  if (!currentUser || !firestore || !navigator.onLine || !connected) return
  flushing = true
  emit({ syncing: true, status: 'Syncing…' })
  const uid = currentUser.uid
  const expectedGeneration = generation
  let failed = false
  try {
    await waitForQueuedChanges()
    const changes = await db.syncChanges.toArray()
    // Send small records first so a large whiteboard cannot hold up tasks.
    changes.sort((a, b) => Number(a.collection === 'ink') - Number(b.collection === 'ink'))
    for (const change of changes) {
      if (currentUser?.uid !== uid || expectedGeneration !== generation) break
      if (!SYNC_TABLES.includes(change.collection as SyncTable)) continue
      try {
        await uploadChange(uid, change)
        await db.transaction('rw', db.syncChanges, async () => {
          const latest = await db.syncChanges.get(change.key)
          if (latest?.revision === change.revision) await db.syncChanges.delete(change.key)
        })
      } catch (error) {
        // A failed handwriting upload must not block unrelated tasks or notes.
        console.error('Could not sync record', change.collection, error)
        failed = true
      }
    }
    if (expectedGeneration === generation) emit({ status: failed ? 'Saved on this device. Retrying sync…' : readError ? 'Some notes are waiting to sync.' : (await db.syncChanges.count()) ? 'Changes waiting to sync.' : 'Synced' })
  } catch (error) {
    console.error('Cloud sync failed', error)
    failed = true
    if (expectedGeneration === generation) emit({ status: 'Saved on this device. Retrying sync…' })
  } finally {
    flushing = false
    const again = flushAgain
    flushAgain = false
    if (expectedGeneration === generation) {
      emit({ syncing: false })
      if (failed) { scheduleFlush(retryDelay); retryDelay = Math.min(retryDelay * 2, 30000) }
      else { if (!readError) retryDelay = 1000; if (again || await db.syncChanges.count()) scheduleFlush(0) }
    } else if (currentUser && connected) scheduleFlush(0)
  }
}

async function connect(user: User): Promise<void> {
  const myGeneration = ++generation
  connected = false
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null }
  unsubscribeSnapshot?.()
  unsubscribeSnapshot = null
  currentUser = user
  const bound = (await db.settings.get('syncAccountId'))?.value
  if (bound && bound !== user.uid) {
    currentUser = null
    startingSync = false
    emit({ email: user.email, syncing: false, status: 'This device is linked to a different account. Use the original account to sync it.' })
    return
  }
  if (!bound) await db.settings.put({ key: 'syncAccountId', value: user.uid })
  emit({ email: user.email, status: 'Connecting to Firebase…', syncing: true })
  startingSync = true
  const slowConnection = setTimeout(() => {
    if (myGeneration === generation && startingSync) emit({ status: 'Firebase is taking longer than expected. Your changes remain saved on this device.' })
  }, 12000)
  try {
    const hadReadErrors = await initialReconcile(user.uid, myGeneration)
    if (myGeneration !== generation) return
    readError = hadReadErrors
    unsubscribeSnapshot = onSnapshot(cloudRecords(user.uid), snapshot => {
      for (const change of snapshot.docChanges()) {
        if (change.type !== 'removed') incoming = incoming.catch(() => undefined).then(() => myGeneration === generation ? receive(change.doc.data(), user.uid, myGeneration) : undefined).catch(err => {
          console.error('Could not apply cloud record', err)
          readError = true
          emit({ status: 'Could not read a cloud record. Local data is still saved; try Sync now.' })
          scheduleReconnect()
        })
      }
    }, error => {
      console.error('Cloud listener failed', error)
      connected = false
      emit({ status: 'Live sync stopped. Changes remain on this device; check Firebase permissions.' })
      scheduleReconnect()
    })
    connected = true
    if (!hadReadErrors) retryDelay = 1000
    if (hadReadErrors) scheduleReconnect()
    emit({ status: 'Syncing…' })
  } catch (error) {
    console.error('Cloud connection failed', error)
    const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : ''
    if (myGeneration === generation) emit({ status: !navigator.onLine ? 'Offline. Changes remain saved on this device.' : code === 'permission-denied' ? 'Firebase denied access. Sign out and sign back in, then try Sync now.' : code === 'unavailable' || code === 'deadline-exceeded' ? 'Firebase is unavailable right now. Your changes remain on this device; try Sync now later.' : `Could not connect to Firebase${code ? ` (${code})` : ''}. Your changes remain on this device.` })
    if (myGeneration === generation) scheduleReconnect()
  } finally {
    clearTimeout(slowConnection)
    if (myGeneration === generation) {
      startingSync = false
      emit({ syncing: false })
      if (connected) await flush()
    }
  }
}

export function startCloudSync(): void {
  if (started || !auth) return
  started = true
  onSyncChange(change => {
    scheduleFlush(change.collection === 'ink' ? 4000 : 250)
  })
  onAuthStateChanged(auth, user => {
    if (user) void connect(user)
    else {
      generation++
      connected = false
      readError = false
      startingSync = false
      if (flushTimer) { clearTimeout(flushTimer); flushTimer = null }
      if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null }
      currentUser = null
      unsubscribeSnapshot?.()
      unsubscribeSnapshot = null
      emit({ email: null, syncing: false, status: 'Saved on this device. Sign in to sync across devices.' })
    }
  })
  window.addEventListener('online', () => { if (currentUser) void connect(currentUser) })
  const resume = () => {
    if (!currentUser || !navigator.onLine || startingSync) return
    if (connected) void flush()
    else void connect(currentUser)
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') resume() })
  window.addEventListener('pageshow', resume)
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
export async function syncNow(): Promise<void> {
  await incoming
  if (currentUser) await connect(currentUser)
}
