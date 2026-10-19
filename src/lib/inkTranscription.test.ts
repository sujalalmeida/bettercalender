import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../db/db'
import { getInkReadingState, transcribeDayAfterClose } from './inkTranscription'
import { transcribeInk } from './geminiSuggestions'

vi.mock('./ink', () => ({ drawInkPage: vi.fn(), INK_WIDTH: 100, INK_HEIGHT: 100 }))
vi.mock('./geminiSuggestions', () => ({ transcribeInk: vi.fn() }))
const transcribe = vi.mocked(transcribeInk)
const date = '2026-10-19'
const pages = [{ id: 'page-1', strokes: [{ id: 'stroke-1', color: '#000', size: 3, points: [] }] }]

beforeEach(async () => {
  await db.open()
  vi.stubGlobal('document', { createElement: () => ({ getContext: () => ({}), toDataURL: () => 'data:image/jpeg;base64,test' }) })
  await db.days.put({ date, notes: 'Keep the typed note', updatedAt: 1 })
  await db.ink.put({ date, pages, updatedAt: 1 })
})
afterEach(async () => {
  await db.days.clear()
  await db.ink.clear()
  transcribe.mockReset()
  vi.unstubAllGlobals()
})

describe('handwriting updates', () => {
  it('restarts recognition for newer strokes and preserves typed notes', async () => {
    let finish!: (text: string) => void
    transcribe.mockImplementationOnce(() => new Promise(resolve => { finish = resolve })).mockResolvedValueOnce('New handwriting')
    const first = transcribeDayAfterClose(date)
    await vi.waitFor(() => expect(transcribe).toHaveBeenCalledTimes(1))
    await db.ink.put({ date, pages, updatedAt: 2 })
    finish('Old handwriting')
    await first
    await vi.waitFor(async () => expect((await db.days.get(date))?.inkText).toBe('New handwriting'))
    expect((await db.days.get(date))?.notes).toBe('Keep the typed note')
    expect(getInkReadingState(date)).toBeUndefined()
  })

  it('stops the reading indicator if handwriting is removed during recognition', async () => {
    let finish!: (text: string) => void
    transcribe.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    const first = transcribeDayAfterClose(date)
    await vi.waitFor(() => expect(transcribe).toHaveBeenCalledTimes(1))
    await db.ink.delete(date)
    finish('Removed handwriting')
    await first
    await vi.waitFor(() => expect(getInkReadingState(date)).toBeUndefined())
    expect((await db.days.get(date))?.inkText).toBeUndefined()
  })
})
