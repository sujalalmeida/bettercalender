import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import Dexie from 'dexie'
import { db } from './db'
import { exportAll, importAll } from './repository'
import { nextReviewDate, reviewRevision, saveMilestone, saveRevision, saveSkill } from './learningRepository'

beforeEach(async () => { await db.open() })
afterEach(async () => { db.close(); await Dexie.delete('plan-db') })
describe('learning sections', () => {
  it('schedules the next review according to confidence', async () => {
    expect(nextReviewDate(1,'2026-10-08')).toBe('2026-10-09')
    expect(nextReviewDate(2,'2026-10-08')).toBe('2026-10-11')
    expect(nextReviewDate(3,'2026-10-08')).toBe('2026-10-15')
    await saveRevision({ title:' ECG ', subject:'Medicine', reason:'', takeaway:'', source:'', confidence:1, nextReviewDate:'2026-10-08' })
    const topic = (await db.revisionTopics.toArray())[0]
    expect(topic.title).toBe('ECG')
    await reviewRevision(topic,3)
    expect((await db.revisionTopics.get(topic.id))?.reviewCount).toBe(1)
  })
  it('includes all three sections in JSON backup and restores them', async () => {
    await saveRevision({ title:'ECG', subject:'Medicine', reason:'', takeaway:'', source:'', confidence:2, nextReviewDate:'2026-10-11' })
    await saveSkill({kind:'practice',title:'Cannulation',note:'',rotation:'Medicine',nextStep:'',confidence:2,status:'active'})
    await saveMilestone({kind:'exam',title:'Finals',dueDate:'2026-12-01',notes:'',url:'',steps:[{id:'',title:'Register',done:false}],status:'planned'})
    const bundle = await exportAll()
    expect(bundle.revisionTopics).toHaveLength(1)
    expect(bundle.skills).toHaveLength(1)
    expect(bundle.milestones?.[0].steps[0].id).toBeTruthy()
    await db.revisionTopics.clear(); await db.skills.clear(); await db.milestones.clear()
    await importAll(bundle,'merge')
    expect(await db.revisionTopics.count()).toBe(1)
    expect(await db.skills.count()).toBe(1)
    expect(await db.milestones.count()).toBe(1)
  })
})
