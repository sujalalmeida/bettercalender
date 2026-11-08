import { db } from './db'
import { createId } from '../lib/id'
import { newGarden, sessionSnapshot, type FocusWorld, type GardenClock } from '../lib/gardenState'
import type { FocusGarden } from './types'

export async function ensureFocusGarden(legacyCredit=0, world:FocusWorld='main'):Promise<FocusGarden> {
  return db.transaction('rw',db.focusGardens,db.focusSessions,async()=>{
    const existing=await db.focusGardens.get(world)
    if(existing) return existing
    const garden=newGarden(Date.now(),world)
    await db.focusGardens.put(garden)
    if(world==='main'&&legacyCredit>0) await db.focusSessions.put({id:'legacy-focus-credit',gardenId:garden.generation,elapsedMs:legacyCredit,createdAt:garden.createdAt,updatedAt:garden.updatedAt})
    return garden
  })
}
export async function saveFocusSession(clock:GardenClock,now=Date.now()):Promise<void> {
  const snapshot=sessionSnapshot(clock,now)
  if(snapshot.elapsedMs<=0) return
  await db.transaction('rw',db.focusSessions,async()=>{
    const previous=await db.focusSessions.get(clock.id)
    if(previous&&previous.elapsedMs>=snapshot.elapsedMs) return
    await db.focusSessions.put({...snapshot,elapsedMs:Math.max(previous?.elapsedMs??0,snapshot.elapsedMs)})
  })
}
export async function restartFocusGarden(current:FocusGarden,now=Date.now()):Promise<FocusGarden> {
  const next={...newGarden(now),generation:createId()}
  await db.transaction('rw',db.focusGardens,async()=>{
    const latest=await db.focusGardens.get('main')
    if(latest&&latest.generation!==current.generation) throw new Error('The garden changed on another device. Try again.')
    await db.focusGardens.put(next)
  })
  return next
}
