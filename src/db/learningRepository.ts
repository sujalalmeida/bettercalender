import { db } from './db'
import { createId } from '../lib/id'
import { addDaysToDate, fromISODate, toISODate, todayISO } from '../lib/dates'
import type { Milestone, RevisionTopic, SkillEntry } from './types'

export type RevisionInput = Pick<RevisionTopic, 'title' | 'subject' | 'reason' | 'takeaway' | 'source' | 'confidence' | 'nextReviewDate'>
export type SkillInput = Pick<SkillEntry, 'kind' | 'title' | 'note' | 'rotation' | 'nextStep' | 'confidence' | 'status'>
export type MilestoneInput = Pick<Milestone, 'kind' | 'title' | 'dueDate' | 'notes' | 'url' | 'steps' | 'status'>
const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T12:00:00`).getTime())
const title = (value: string) => { const cleaned = value.trim(); if (!cleaned) throw new Error('Please add a title.'); return cleaned }
export const nextReviewDate = (confidence: 1 | 2 | 3, from = todayISO()) => toISODate(addDaysToDate(fromISODate(from), confidence === 1 ? 1 : confidence === 2 ? 3 : 7))

export async function saveRevision(input: RevisionInput, id?: string): Promise<void> {
  if (!validDate(input.nextReviewDate)) throw new Error('Please choose a valid review date.')
  const existing = id ? await db.revisionTopics.get(id) : undefined
  const now = Date.now()
  await db.revisionTopics.put({ ...input, title: title(input.title), id: id ?? createId(), reviewCount: existing?.reviewCount ?? 0, mastered: existing?.mastered ?? false, createdAt: existing?.createdAt ?? now, updatedAt: now })
}
export async function reviewRevision(item: RevisionTopic, confidence: 1 | 2 | 3): Promise<void> {
  await db.revisionTopics.update(item.id, { confidence, nextReviewDate: nextReviewDate(confidence), reviewCount: item.reviewCount + 1, mastered: false, updatedAt: Date.now() })
}
export async function toggleRevisionMastered(item: RevisionTopic): Promise<void> { await db.revisionTopics.update(item.id, { mastered: !item.mastered, updatedAt: Date.now() }) }
export async function deleteRevision(id: string): Promise<void> { await db.revisionTopics.delete(id) }

export async function saveSkill(input: SkillInput, id?: string): Promise<void> {
  const existing = id ? await db.skills.get(id) : undefined
  const now = Date.now()
  await db.skills.put({ ...input, title: title(input.title), id: id ?? createId(), createdAt: existing?.createdAt ?? now, updatedAt: now })
}
export async function setSkillStatus(id: string, status: SkillEntry['status']): Promise<void> { await db.skills.update(id, { status, updatedAt: Date.now() }) }
export async function deleteSkill(id: string): Promise<void> { await db.skills.delete(id) }

export async function saveMilestone(input: MilestoneInput, id?: string): Promise<void> {
  if (input.dueDate && !validDate(input.dueDate)) throw new Error('Please choose a valid due date.')
  if (input.url && !/^https?:\/\//i.test(input.url)) throw new Error('Use an http or https link.')
  const existing = id ? await db.milestones.get(id) : undefined
  const now = Date.now()
  await db.milestones.put({ ...input, title: title(input.title), steps: input.steps.filter(s => s.title.trim()).map(s => ({ ...s, id: s.id || createId(), title: s.title.trim() })), id: id ?? createId(), createdAt: existing?.createdAt ?? now, updatedAt: now })
}
export async function setMilestoneStatus(id: string, status: Milestone['status']): Promise<void> { await db.milestones.update(id, { status, updatedAt: Date.now() }) }
export async function toggleMilestoneStep(item: Milestone, stepId: string): Promise<void> { await db.milestones.update(item.id, { steps: item.steps.map(s => s.id === stepId ? { ...s, done: !s.done } : s), updatedAt: Date.now() }) }
export async function deleteMilestone(id: string): Promise<void> { await db.milestones.delete(id) }
