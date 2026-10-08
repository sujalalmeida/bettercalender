import { getApps, initializeApp } from 'firebase/app'
import { getAI, getGenerativeModel, GoogleAIBackend } from 'firebase/ai'
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check'
import type { MilestoneInput, RevisionInput, SkillInput } from '../db/learningRepository'
import { nextReviewDate } from '../db/learningRepository'

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
let appCheckReady = false
export async function generateSuggestions(target: Target, note: string, file?: AIFile): Promise<Suggestion[]> {
  const config = { apiKey: import.meta.env.VITE_FIREBASE_API_KEY, authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN, projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID, appId: import.meta.env.VITE_FIREBASE_APP_ID }
  if (!config.apiKey || !config.projectId || !config.appId) throw new Error('Firebase configuration is missing.')
  const siteKey = import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY
  if (!siteKey) throw new Error('Gemini needs Firebase App Check setup. Add VITE_FIREBASE_APPCHECK_SITE_KEY after enabling App Check in Firebase.')
  const app = getApps()[0] ?? initializeApp(config)
  if (!appCheckReady) { initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(siteKey), isTokenAutoRefreshEnabled: true }); appCheckReady = true }
  const ai = getAI(app, { backend: new GoogleAIBackend() })
  const model = getGenerativeModel(ai, { model: import.meta.env.VITE_GEMINI_MODEL || 'gemini-2.5-flash', generationConfig: { responseMimeType: 'application/json', temperature: 0.1 } })
  const fields = target === 'revision' ? 'title, subject, reason, takeaway, source, confidence (1-3), nextReviewDate (YYYY-MM-DD)' : target === 'skills' ? 'kind (learning or practice), title, note, rotation, nextStep, confidence (1-3)' : 'kind (exam, application, elective, reference, form, other), title, dueDate (YYYY-MM-DD), notes, url, steps (array of short strings)'
  const prompt = `Extract ${target} entries from the user's text or uploaded academic schedule/syllabus. Return ONLY valid JSON: {"items":[{${fields}}]}. Use at most 20 items. Keep exact dates only if explicit; do not invent deadlines, patient details, or achievements. Omit uncertain values by using empty strings. For revision topics, create a review entry only for an explicitly weak or missed topic. For skills, capture only learning or practice the user explicitly mentions. For milestones, extract only concrete commitments or deadlines, not every syllabus heading. The user may speak informally. User text: ${note.slice(0,10000)}`
  const parts = file ? [prompt, { inlineData: file }] : [prompt]
  const result = await model.generateContent(parts)
  return parseSuggestions(result.response.text(), target)
}
