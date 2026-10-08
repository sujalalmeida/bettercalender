import { describe, expect, it } from 'vitest'
import { appendStroke, blankInkDocument, eraseAt, clearInkPage, addInkPage, removeInkPage } from './ink'

describe('handwriting document', () => {
  it('adds strokes and erases a stroke near its middle', () => {
    const start = blankInkDocument('2026-01-01')
    const drawn = appendStroke(start, 0, { id: 's', color: '#182331', size: 5, points: [{ x: 0, y: 20, pressure: .5 }, { x: 100, y: 20, pressure: .5 }] })
    expect(drawn.pages[0].strokes).toHaveLength(1)
    expect(eraseAt(drawn, 0, { x: 50, y: 22, pressure: .5 }, 8).pages[0].strokes).toHaveLength(0)
    expect(start.pages[0].strokes).toHaveLength(0)
  })

  it('keeps pages independent', () => {
    const start = addInkPage(blankInkDocument('2026-01-01'))
    const drawn = appendStroke(start, 1, { id: 's', color: '#182331', size: 5, points: [{ x: 5, y: 5, pressure: .5 }] })
    expect(clearInkPage(drawn, 1).pages[1].strokes).toHaveLength(0)
    expect(drawn.pages[0].strokes).toHaveLength(0)
    expect(removeInkPage(drawn, 1).pages).toHaveLength(1)
  })
})
