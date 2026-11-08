import { afterAll,afterEach,beforeAll,describe,expect,it } from 'vitest'
import { db } from './db'
import { ensureFocusGarden,restartFocusGarden,saveFocusSession } from './focusRepository'
import { gardenElapsed,newClock } from '../lib/gardenState'
import { exportAll,importAll,saveDayNotes } from './repository'
beforeAll(()=>db.open())
afterEach(async()=>{await db.focusGardens.clear();await db.focusSessions.clear();await db.days.clear()})
afterAll(()=>db.close())
describe('garden persistence',()=>{
  it('migrates recorded legacy credit once and never clears it on re-open',async()=>{
    const garden=await ensureFocusGarden(3600000)
    expect(await ensureFocusGarden(3600000)).toEqual(garden)
    expect(gardenElapsed(garden,await db.focusSessions.toArray(),null)).toBe(3600000)
  })
  it('makes heartbeat saves idempotent and never rolls back earned time',async()=>{
    const garden=await ensureFocusGarden(),clock={...newClock(garden.generation,0),timer:{elapsedMs:60000,startedAt:null,lastSeenAt:null}}
    await saveFocusSession(clock,1000);await saveFocusSession(clock,2000)
    await saveFocusSession({...clock,timer:{...clock.timer,elapsedMs:1000}},3000)
    expect(await db.focusSessions.count()).toBe(1)
    expect((await db.focusSessions.get(clock.id))?.elapsedMs).toBe(60000)
  })
  it('restarts only the landscape while retaining saved session history',async()=>{
    const garden=await ensureFocusGarden(3600000)
    const next=await restartFocusGarden(garden)
    expect(next.generation).not.toBe(garden.generation)
    expect(gardenElapsed(next,await db.focusSessions.toArray(),null)).toBe(0)
    expect(await db.focusSessions.count()).toBe(1)
    await expect(restartFocusGarden(garden)).rejects.toThrow('changed')
  })
  it('includes the garden in backups and preserves it when restoring an older calendar backup',async()=>{
    const garden=await ensureFocusGarden(3600000)
    const backup=await exportAll()
    expect(backup.focusGardens).toHaveLength(1)
    await importAll({...backup,version:4,focusGardens:undefined,focusSessions:undefined},'replace')
    expect((await db.focusGardens.get('main'))?.generation).toBe(garden.generation)
    expect(await db.focusSessions.count()).toBe(1)
  })
  it('adds outpost progress without replacing the existing garden, sessions, or dated notes', async () => {
    const garden = await ensureFocusGarden(3600000)
    await saveDayNotes('2026-11-09', 'Existing notes')
    const before = await exportAll()
    const outpost = await ensureFocusGarden(3600000, 'outpost')
    const clock = newClock(outpost.generation, 0)
    clock.timer.elapsedMs = 120000
    await saveFocusSession(clock, 120000)
    expect(await ensureFocusGarden(0, 'outpost')).toEqual(outpost)
    const backup = await exportAll()
    expect(backup.days).toEqual(before.days)
    expect(backup.focusGardens).toContainEqual(garden)
    expect(backup.focusSessions).toEqual(expect.arrayContaining(before.focusSessions!))
    expect(gardenElapsed(garden, backup.focusSessions!, null)).toBe(3600000)
    expect(gardenElapsed(outpost, backup.focusSessions!, null)).toBe(120000)

    const restartedGarden = await restartFocusGarden(garden)
    expect(gardenElapsed(restartedGarden, backup.focusSessions!, null)).toBe(0)
    expect(await db.focusGardens.get('outpost')).toEqual(outpost)
    expect(gardenElapsed(outpost, await db.focusSessions.toArray(), null)).toBe(120000)
  })
})
