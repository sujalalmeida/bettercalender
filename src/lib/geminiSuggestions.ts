import { getApps, initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import type { MilestoneInput, RevisionInput, SkillInput } from '../db/learningRepository'
import { nextReviewDate } from '../db/learningRepository'
import { todayISO } from './dates'

type Target = 'revision' | 'skills' | 'milestones'
export type Suggestion = RevisionInput | SkillInput | MilestoneInput
const validDate = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(new Date(`${v}T12:00:00`).getTime()) ? v : ''
const str = (v: unknown) => typeof v === 'string' ? v.trim().slice(0, 4000) : ''
const confidence = (v: unknown): 1|2|3 => v === 1 || v === 3 ? v : 2
const oneOf = <T extends string>(v: unknown, choices: readonly T[], fallback: T): T => choices.includes(v as T) ? v as T : fallback

export function parseSuggestions(raw: string, target: Target): Suggestion[] {
  const parsed: unknown = JSON.parse(raw)
  const items = Array.isArray(parsed) ? parsed : typeof parsed === 'object' && parsed !== null && 'items' in parsed ? (parsed as {items: unknown}).items : []
  if (!Array.isArray(items)) return []
  return items.slice(0, 20).filter(x => x && typeof x === 'object' && str(x.title)).map(x => {
    const v = x as Record<string, unknown>
    if (target === 'revision') return { title: str(v.title), subject: str(v.subject), reason: str(v.reason), takeaway: str(v.takeaway), source: str(v.source), confidence: confidence(v.confidence), nextReviewDate: validDate(v.nextReviewDate) || nextReviewDate(confidence(v.confidence)) } satisfies RevisionInput
    if (target === 'skills') return { kind: oneOf(v.kind, ['learning','practice'] as const, 'learning'), title: str(v.title), note: str(v.note), rotation: str(v.rotation), nextStep: str(v.nextStep), confidence: confidence(v.confidence), status: 'active' } satisfies SkillInput
    return { kind: oneOf(v.kind, ['exam','application','elective','reference','form','other'] as const, 'other'), title: str(v.title), dueDate: validDate(v.dueDate), notes: str(v.notes), url: /^https?:\/\//.test(str(v.url)) ? str(v.url) : '', steps: Array.isArray(v.steps) ? v.steps.slice(0,12).map(s => ({id:'',title:str(s),done:false})).filter(s => s.title) : [], status: 'planned' } satisfies MilestoneInput
  })
}

export type AIFile = { mimeType: string; data: string }
async function generateJson(prompt: string, images: AIFile[] = []): Promise<string> {
  const config = { apiKey: import.meta.env.VITE_FIREBASE_API_KEY, authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN, projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID, appId: import.meta.env.VITE_FIREBASE_APP_ID }
  if (!config.apiKey || !config.projectId || !config.appId) throw new Error('Gemini is not connected yet. Ask the app owner to finish setup.')
  const app = getApps()[0] ?? initializeApp(config)
  const user = getAuth(app).currentUser
  if (!user) throw new Error('Sign in under Settings → Cloud sync before using Gemini.')
  const response = await fetch('/api/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await user.getIdToken()}` },
    body: JSON.stringify({ parts: [{ text: prompt }, ...images.map(image => ({ inlineData: image }))] })
  })
  const result = await response.json() as { text?: string; error?: string }
  if (!response.ok || !result.text) throw new Error(result.error || 'Gemini could not analyze this. Please try again.')
  return result.text
}

export async function generateSuggestions(target: Target, note: string, file?: AIFile): Promise<Suggestion[]> {
  const fields = target === 'revision' ? 'title, subject, reason, takeaway, source, confidence (1-3), nextReviewDate (YYYY-MM-DD)' : target === 'skills' ? 'kind (learning or practice), title, note, rotation, nextStep, confidence (1-3)' : 'kind (exam, application, elective, reference, form, other), title, dueDate (YYYY-MM-DD), notes, url, steps (array of short strings)'
  const prompt = `Today is ${todayISO()}. The user is a final-year medical student. Create editable ${target} cards from her request or uploaded academic schedule/syllabus. Return ONLY valid JSON: {"items":[{${fields}}]}. Use one card per distinct topic, skill or milestone, up to 20 cards. Preserve all explicitly stated topics, sources, lecture slides, dates, rotations, follow-ups and checklist details. Interpret relative dates against today only when unambiguous. Never invent a deadline, source, patient detail or completed achievement. Use an empty string for missing details. For revision: a topic she asks to review is enough; reason can describe why she wants to review it, and takeaway should only state a fact she supplied (never fabricate medical advice). For skills: only record learning or practice she mentions or asks to track; use nextStep for planned follow-up. For milestones: create concrete exams, applications, electives, references, forms or follow-ups, and make short steps only when supported by her request. The user may speak informally. User text: ${note.slice(0,12000)}`
  return parseSuggestions(await generateJson(prompt, file ? [file] : []), target)
}

/** Reads handwriting only; the original vector ink stays in IndexedDB. */
export async function transcribeInk(images: AIFile[]): Promise<string> {
  if (!images.length) return ''
  const parts: string[] = []
  for (let start = 0; start < images.length; start += 4) {
    const result = await generateJson(
      'Transcribe every legible handwritten word in these page images in reading order. Preserve line breaks where useful. Return ONLY valid JSON like {"text":"..."}. Do not summarize, correct medical facts, invent missing words, or add commentary. If a word is unreadable, use [unclear].',
      images.slice(start, start + 4)
    )
    const parsed: unknown = JSON.parse(result)
    if (!parsed || typeof parsed !== 'object' || !('text' in parsed) || typeof parsed.text !== 'string') throw new Error('Gemini returned an unreadable transcription.')
    parts.push(parsed.text.trim())
  }
  return parts.filter(Boolean).join('\n\n').slice(0, 20000)
}
