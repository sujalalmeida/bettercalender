import type { FocusGarden, FocusSession } from '../db/types'
import { createId } from './id'
import { EMPTY_FOCUS_TIMER, FOCUS_STORAGE_KEY, focusElapsed, parseFocusTimer, type FocusTimerState } from './focusTimer'

export const GARDEN_CLOCK_KEY = 'plan.focus-clock.v2'
export interface GardenClock { version:2; id:string; gardenId:string; timer:FocusTimerState; displayOffsetMs:number; createdAt:number }
export const newGarden = (now=Date.now()):FocusGarden => ({id:'main',generation:createId(),seed:Math.floor(Math.random()*2147483647),createdAt:now,updatedAt:now})
export const newClock = (gardenId:string,now=Date.now()):GardenClock => ({version:2,id:createId(),gardenId,timer:{...EMPTY_FOCUS_TIMER},displayOffsetMs:0,createdAt:now})
const finite = (n:unknown) => typeof n==='number'&&Number.isFinite(n)&&n>=0
export function parseGardenClock(raw:string|null,now=Date.now()):GardenClock|null {
  try {
    const v=JSON.parse(raw??'null') as GardenClock
    if(!v||v.version!==2||typeof v.id!=='string'||!v.id||typeof v.gardenId!=='string'||!v.gardenId||!finite(v.displayOffsetMs)||!finite(v.createdAt)||!v.timer) return null
    return {...v,timer:parseFocusTimer(JSON.stringify(v.timer),now,true)}
  } catch {return null}
}
export function sessionSnapshot(clock:GardenClock,now=Date.now()):FocusSession {
  return {id:clock.id,gardenId:clock.gardenId,elapsedMs:focusElapsed(clock.timer,now),createdAt:clock.createdAt,updatedAt:now}
}
export function gardenElapsed(garden:FocusGarden,sessions:FocusSession[],clock:GardenClock|null,now=Date.now()):number {
  let total=0,hasActive=false
  for(const session of sessions) if(session.gardenId===garden.generation) {
    if(clock?.gardenId===garden.generation&&session.id===clock.id) {total+=Math.max(session.elapsedMs,focusElapsed(clock.timer,now));hasActive=true}
    else total+=session.elapsedMs
  }
  if(clock?.gardenId===garden.generation&&!hasActive) total+=focusElapsed(clock.timer,now)
  return total
}
export function legacyGardenCredit(storage:Pick<Storage,'getItem'>,now=Date.now()):number {
  // v1 stopped when a window closed. Never award weeks of unattended legacy time.
  return focusElapsed(parseFocusTimer(storage.getItem(FOCUS_STORAGE_KEY),now),now)
}
export const STUDY_MINUTE=60_000
export const GARDEN_MILESTONES = [
  {minutes:1,label:'First blossoms'}, {minutes:20,label:'Saplings take root'}, {minutes:45,label:'A flowing stream'},
  {minutes:60,label:'Garden keepers arrive'}, {minutes:75,label:'A little footbridge'}, {minutes:90,label:'The first cottage'},
  {minutes:120,label:'Vegetable beds'}, {minutes:150,label:'A campfire'}, {minutes:240,label:'An orchard'},
  {minutes:300,label:'A second cottage'}, {minutes:480,label:'A glasshouse'}, {minutes:600,label:'The old windmill'},
  {minutes:720,label:'An autumn garden'}, {minutes:960,label:'A stone bridge'}, {minutes:1080,label:'Winter lights'},
  {minutes:1440,label:'A cottage library'}
] as const
export function gardenStage(elapsedMs:number) {
  const minutes=Math.max(0,elapsedMs/STUDY_MINUTE),hours=minutes/60
  const season=(['Spring','Summer','Autumn','Winter'] as const)[Math.floor(hours/6)%4]
  const dayProgress=(minutes%180)/180
  const smooth=(n:number)=>{const t=Math.max(0,Math.min(1,n));return t*t*(3-2*t)}
  const night=dayProgress<.33?0:dayProgress<.53?smooth((dayProgress-.33)/.2):dayProgress<.8?1:1-smooth((dayProgress-.8)/.2)
  const phase=dayProgress<.22?'Morning':dayProgress<.33?'Afternoon':dayProgress<.53?'Dusk':dayProgress<.8?'Night':'Dawn'
  const flowers=Math.max(0,Math.floor((minutes-0.25)/.75))
  return {minutes,hours,season,night,phase,dayProgress,flowers,detailedFlowers:Math.min(420,flowers),meadowLevel:Math.floor(flowers/420),next:GARDEN_MILESTONES.find(m=>m.minutes>minutes)}
}
