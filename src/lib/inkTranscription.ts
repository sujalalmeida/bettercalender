import { db } from '../db/db'
import { drawInkPage, INK_HEIGHT, INK_WIDTH } from './ink'
import { flushInkForDate } from './inkSaveCoordinator'
import type { InkPage } from '../db/types'

export type InkReadingState = 'reading' | 'error' | undefined
const states = new Map<string, InkReadingState>()
const jobs = new Map<string, Promise<void>>()
const rerun = new Set<string>()
const listeners = new Set<() => void>()

export function getInkReadingState(dateISO: string): InkReadingState { return states.get(dateISO) }
export function subscribeInkReading(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
function setState(dateISO: string, state: InkReadingState) {
  if (state) states.set(dateISO, state)
  else states.delete(dateISO)
  listeners.forEach(listener => listener())
}

function pageImage(page: InkPage): { mimeType: string; data: string } {
  const canvas = document.createElement('canvas')
  canvas.width = INK_WIDTH
  canvas.height = INK_HEIGHT
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not prepare the handwritten page.')
  drawInkPage(context, page, null, false)
  return { mimeType: 'image/jpeg', data: canvas.toDataURL('image/jpeg', 0.78).split(',')[1] }
}

export function transcribeDayAfterClose(dateISO: string): Promise<void> {
  const running = jobs.get(dateISO)
  if (running) { rerun.add(dateISO); return running }
  const job = (async () => {
    try {
      await flushInkForDate(dateISO)
      const ink = await db.ink.get(dateISO)
      const day = await db.days.get(dateISO)
      if (!ink) return
      const pages = ink.pages.filter(page => page.strokes.length > 0)
      if (!pages.length) {
        if (day?.inkText) await db.transaction('rw', db.days, async () => {
          const current = await db.days.get(dateISO)
          if (current) await db.days.put({ ...current, inkText: '', inkTextSourceUpdatedAt: ink.updatedAt, updatedAt: Date.now() })
        })
        setState(dateISO, undefined)
        return
      }
      if (day?.inkTextSourceUpdatedAt === ink.updatedAt) { setState(dateISO, undefined); return }
      setState(dateISO, 'reading')
      const images = pages.map(pageImage)
      const { transcribeInk } = await import('./geminiSuggestions')
      const inkText = await transcribeInk(images)
      // Never let a delayed response replace text from newer Pencil strokes.
      const latestInk = await db.ink.get(dateISO)
      if (latestInk?.updatedAt !== ink.updatedAt) return
      await db.transaction('rw', db.days, async () => {
        const currentDay = await db.days.get(dateISO)
        await db.days.put({ ...currentDay, date: dateISO, notes: currentDay?.notes ?? '', inkText, inkTextSourceUpdatedAt: ink.updatedAt, updatedAt: Date.now() })
      })
      setState(dateISO, undefined)
    } catch {
      console.error('Handwriting transcription failed.')
      setState(dateISO, 'error')
    } finally {
      jobs.delete(dateISO)
      if (rerun.delete(dateISO)) void transcribeDayAfterClose(dateISO)
    }
  })()
  jobs.set(dateISO, job)
  return job
}
