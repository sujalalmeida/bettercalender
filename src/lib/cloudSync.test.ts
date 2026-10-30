import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { db } from '../db/db'
import { addTask, getTasksForRange, saveInk, updateTask } from '../db/repository'
import { installSyncTracking, waitForQueuedChanges } from './syncQueue'

const cloud = vi.hoisted(() => ({
  authChanged: null as null | ((user: unknown) => void),
  snapshot: null as null | ((snapshot: unknown) => void),
  read: vi.fn(), write: vi.fn(), getDoc: vi.fn(), signOut: vi.fn()
}))

vi.mock('firebase/app', () => ({ initializeApp: () => ({}), getApps: () => [] }))
vi.mock('firebase/auth', () => ({
  getAuth: () => ({}), onAuthStateChanged: (_auth: unknown, callback: typeof cloud.authChanged) => { cloud.authChanged = callback },
  signInWithEmailAndPassword: vi.fn(), createUserWithEmailAndPassword: vi.fn(), sendPasswordResetEmail: vi.fn(), signOut: cloud.signOut
}))
vi.mock('firebase/firestore', () => ({
  getFirestore: () => ({}),
  collection: (_ref: unknown, ...parts: string[]) => ({ path: parts.join('/') }),
  doc: (ref: { path?: string }, ...parts: string[]) => ({ path: [ref.path, ...parts].filter(Boolean).join('/') }),
  getDoc: cloud.getDoc, getDocsFromServer: cloud.read, setDoc: cloud.write, deleteDoc: vi.fn().mockResolvedValue(undefined),
  runTransaction: (_db: unknown, callback: (tx: unknown) => Promise<unknown>) => callback({ get: cloud.getDoc, set: cloud.write }),
  onSnapshot: (_ref: unknown, callback: typeof cloud.snapshot) => { cloud.snapshot = callback; return () => { cloud.snapshot = null } }
}))

let sync: typeof import('./cloudSync')
const user = { uid: 'student-1', email: 'student@example.invalid' }
const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined)

beforeAll(async () => {
  vi.stubEnv('VITE_FIREBASE_API_KEY', 'public-test-key')
  vi.stubEnv('VITE_FIREBASE_AUTH_DOMAIN', 'test.firebaseapp.com')
  vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'test')
  vi.stubEnv('VITE_FIREBASE_APP_ID', 'test-app')
  vi.stubGlobal('window', new EventTarget())
  vi.stubGlobal('document', Object.assign(new EventTarget(), { visibilityState: 'visible' }))
  vi.stubGlobal('navigator', { onLine: true })
  await db.open()
  installSyncTracking()
  cloud.read.mockResolvedValue({ docs: [] })
  cloud.getDoc.mockResolvedValue({ data: () => undefined, exists: () => false })
  cloud.write.mockResolvedValue(undefined)
  sync = await import('./cloudSync')
  sync.startCloudSync()
})

afterEach(async () => {
  cloud.authChanged!(null)
  await db.tasks.clear()
  await db.ink.clear()
  await db.settings.clear()
  await waitForQueuedChanges()
  await db.syncChanges.clear()
  cloud.write.mockReset().mockResolvedValue(undefined)
  cloud.read.mockReset().mockResolvedValue({ docs: [] })
  cloud.getDoc.mockReset().mockResolvedValue({ data: () => undefined, exists: () => false })
})

afterAll(async () => {
  cloud.authChanged!(null)
  db.close()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  errors.mockRestore()
})

describe('cloud sync recovery', () => {
  it('preserves queued optional records without retrying forever when their module is absent', async () => {
    await db.syncChanges.put({ key: 'optional-store:record', collection: 'optional-store', id: 'record', revision: 'pending' })
    cloud.authChanged!(user)
    await vi.waitFor(() => expect(sync.getCloudState().status).toBe('Synced'))
    expect(await db.syncChanges.get('optional-store:record')).toBeDefined()
    expect(cloud.write).not.toHaveBeenCalled()
  })
  it('preserves the signed-in session when local data belongs to another account', async () => {
    await db.settings.put({ key: 'syncAccountId', value: 'another-account' })
    cloud.authChanged!(user)
    await vi.waitFor(() => expect(sync.getCloudState().status).toContain('different account'))
    expect(cloud.signOut).not.toHaveBeenCalled()
    expect(cloud.read).not.toHaveBeenCalled()
  })

  it('uploads Today tasks and applies edits received from another device to every range', async () => {
    const task = await addTask('2026-10-19', 'Review surgery')
    await waitForQueuedChanges()
    cloud.authChanged!(user)
    await vi.waitFor(() => expect(sync.getCloudState().status).toBe('Synced'))
    expect(cloud.write).toHaveBeenCalledWith(expect.objectContaining({ path: expect.stringContaining('/records/tasks%3A') }), expect.objectContaining({ payload: expect.objectContaining({ title: task.title }) }))
    cloud.snapshot!({ docChanges: () => [{ type: 'modified', doc: { data: () => ({ table: 'tasks', id: task.id, updatedAt: Date.now() + 1000, payload: { ...task, title: 'Review surgery and medicine', done: true, updatedAt: Date.now() + 1000 } }) } }] })
    await vi.waitFor(async () => expect((await getTasksForRange('2026-10-01', '2026-10-31'))[task.date][0]).toMatchObject({ title: 'Review surgery and medicine', done: true }))
    expect((await getTasksForRange('2026-10-18', '2026-10-24'))[task.date][0].done).toBe(true)
    expect(cloud.signOut).not.toHaveBeenCalled()
  })

  it('keeps syncing tasks when an earlier handwriting upload fails', async () => {
    await saveInk({ date: '2026-10-19', pages: [], updatedAt: 1 })
    const task = await addTask('2026-10-19', 'Review surgery')
    await waitForQueuedChanges()
    cloud.write.mockImplementation(async (ref: { path: string }) => { if (ref.path.includes('/ink/')) throw new Error('Temporary upload failure') })
    cloud.authChanged!(user)
    await vi.waitFor(async () => expect(await db.syncChanges.get(`tasks:${task.id}`)).toBeUndefined())
    await vi.waitFor(() => expect(sync.getCloudState().status).toContain('Retrying'))
    expect(await db.syncChanges.get('ink:2026-10-19')).toBeTruthy()
    expect(cloud.write).toHaveBeenCalledWith(expect.objectContaining({ path: expect.stringContaining('/records/tasks%3A') }), expect.anything())
  })

  it('retries a failed task upload without another edit or manual sync', async () => {
    const task = await addTask('2026-10-19', 'Review medicine')
    await waitForQueuedChanges()
    // Let the original edit timer expire while signed out, so recovery must retry.
    await new Promise(resolve => setTimeout(resolve, 300))
    cloud.write.mockRejectedValueOnce(new Error('Connection dropped'))
    cloud.authChanged!(user)
    await vi.waitFor(() => expect(sync.getCloudState().status).toContain('Retrying'))
    expect(await db.syncChanges.get(`tasks:${task.id}`)).toBeTruthy()
    await vi.waitFor(async () => expect(await db.syncChanges.get(`tasks:${task.id}`)).toBeUndefined(), { timeout: 3500 })
    expect(cloud.signOut).not.toHaveBeenCalled()
  })

  it('uploads a newer edit that arrives while the previous version is still uploading', async () => {
    cloud.authChanged!(user)
    await vi.waitFor(() => expect(sync.getCloudState().status).toBe('Synced'))
    let finishUpload!: () => void
    cloud.write.mockImplementationOnce(() => new Promise<void>(resolve => { finishUpload = resolve }))
    const task = await addTask('2026-10-19', 'Original title')
    await vi.waitFor(() => expect(finishUpload).toBeTypeOf('function'))
    await updateTask({ ...task, virtual: false }, { title: 'Updated on this device' })
    await waitForQueuedChanges()
    finishUpload()
    await vi.waitFor(async () => expect(await db.syncChanges.count()).toBe(0))
    expect(cloud.write).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ payload: expect.objectContaining({ title: 'Updated on this device' }) }))
  })

  it('does not replace a local Pencil edit made during a cloud page download', async () => {
    cloud.authChanged!(user)
    await vi.waitFor(() => expect(sync.getCloudState().status).toBe('Synced'))
    let finishDownload!: (value: unknown) => void
    cloud.getDoc.mockImplementationOnce(() => new Promise(resolve => { finishDownload = resolve }))
    cloud.snapshot!({ docChanges: () => [{ type: 'modified', doc: { data: () => ({ table: 'ink', id: '2026-10-19', partCount: 1, inkRevision: 'cloud-version', updatedAt: Date.now() + 1000 }) } }] })
    await vi.waitFor(() => expect(finishDownload).toBeTypeOf('function'))
    await saveInk({ date: '2026-10-19', pages: [{ id: 'local-page', strokes: [] }], updatedAt: 1 })
    await waitForQueuedChanges()
    const payload = { date: '2026-10-19', pages: [{ id: 'older-cloud-page', strokes: [] }], updatedAt: 1 }
    finishDownload({ exists: () => true, data: () => ({ data: JSON.stringify(payload) }) })
    // syncNow waits for all queued incoming snapshots before reconnecting.
    await sync.syncNow()
    expect((await db.ink.get('2026-10-19'))?.pages[0].id).toBe('local-page')
  })

  it('reconnects after a failed initial read without signing the user out', async () => {
    cloud.read.mockRejectedValueOnce(new Error('Connection dropped'))
    cloud.authChanged!(user)
    await vi.waitFor(() => expect(cloud.read).toHaveBeenCalledTimes(1))
    await vi.waitFor(() => expect(sync.getCloudState().status).toBe('Synced'), { timeout: 5000 })
    expect(cloud.read).toHaveBeenCalledTimes(2)
    expect(cloud.signOut).not.toHaveBeenCalled()
  })

  it('downloads tasks even when a cloud whiteboard is missing a page chunk', async () => {
    const task = { id: 'remote-task', title: 'From the other device', date: '2026-10-19', done: false, order: 0, createdAt: 1, updatedAt: 1 }
    cloud.read.mockResolvedValue({ docs: [
      { data: () => ({ table: 'ink', id: task.date, updatedAt: 1, partCount: 1, inkRevision: 'missing-chunk' }) },
      { data: () => ({ table: 'tasks', id: task.id, updatedAt: 1, payload: task }) }
    ] })
    cloud.authChanged!(user)
    await vi.waitFor(() => expect(sync.getCloudState().status).toBe('Some notes are waiting to sync.'))
    expect((await getTasksForRange(task.date, task.date))[task.date][0].title).toBe(task.title)
    expect(cloud.signOut).not.toHaveBeenCalled()
  })
})
