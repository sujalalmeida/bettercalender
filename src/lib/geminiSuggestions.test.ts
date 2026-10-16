import { describe, expect, it } from 'vitest'
import { parseSuggestions } from './geminiSuggestions'

describe('Gemini suggestion parsing', () => {
  it('keeps only titled entries and does not invent dates', () => {
    const result = parseSuggestions(JSON.stringify({ items: [
      { kind: 'exam', title: 'Final exam', dueDate: '2026-12-03', steps: ['Register', ''] },
      { kind: 'exam', title: 'Maybe later', dueDate: 'sometime' },
      { title: '' }
    ] }), 'milestones')
    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({ dueDate: '2026-12-03', steps: [{title:'Register'}] })
    expect(result[1]).toMatchObject({ dueDate: '' })
  })
  it('uses safe defaults for invalid fields', () => {
    expect(parseSuggestions('{"items":[{"title":"ECG","kind":"nonsense","confidence":9}]}','skills')[0]).toMatchObject({ kind:'learning', confidence:2, status:'active' })
  })
  it('creates separate review cards with the requested sources and dates', () => {
    const result = parseSuggestions(JSON.stringify({ items: [
      { title: 'Surgery', subject: 'Surgery', reason: 'Needs review', takeaway: '', source: 'Lecture slides 4–8', confidence: 1, nextReviewDate: '2026-10-19' },
      { title: 'Cardiology', subject: 'Medicine', reason: '', takeaway: '', source: 'Question bank', confidence: 2, nextReviewDate: '2026-10-22' }
    ] }), 'revision')
    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({ title: 'Surgery', source: 'Lecture slides 4–8', nextReviewDate: '2026-10-19' })
    expect(result[1]).toMatchObject({ title: 'Cardiology', source: 'Question bank', nextReviewDate: '2026-10-22' })
  })
})
