import { describe, expect, it } from 'vitest'
import { validateExportBundle } from './backup'

const validBundle = {
  version: 1,
  exportedAt: '2026-01-01T00:00:00.000Z',
  days: [{ date: '2026-01-01', notes: 'hello', updatedAt: 1 }],
  tasks: [{ id: 't1', date: '2026-01-01', title: 'Task', done: false, order: 0, createdAt: 1, updatedAt: 1 }],
  recurrences: [{ id: 'r1', rule: { frequency: 'daily' }, startDate: '2026-01-01', title: 'Repeat', exceptions: [] }],
  categories: [{ id: 'c1', name: 'Study', color: '#000', order: 0 }],
  templates: [{ id: 'tpl1', name: 'Block', tasks: [] }]
}

describe('validateExportBundle', () => {
  it('accepts a well-formed bundle', () => {
    expect(validateExportBundle(validBundle)).not.toBeNull()
    expect(validateExportBundle({ ...validBundle, version: 2, settings: [{ key: 'theme', value: 'dark' }] })).not.toBeNull()
    expect(validateExportBundle({ ...validBundle, version: 3, settings: [], ink: [{ date: '2026-01-01', updatedAt: 1, pages: [{ id: 'p', strokes: [{ id: 's', color: '#182331', size: 5, points: [{ x: 1, y: 2, pressure: 0.5 }] }] }] }] })).not.toBeNull()
  })

  it('rejects null and non-object values', () => {
    expect(validateExportBundle(null)).toBeNull()
    expect(validateExportBundle('a string')).toBeNull()
    expect(validateExportBundle(42)).toBeNull()
  })

  it('rejects a mismatched version', () => {
    expect(validateExportBundle({ ...validBundle, version: 2 })).toBeNull()
  })

  it('rejects malformed ink in a v3 backup', () => {
    expect(validateExportBundle({ ...validBundle, version: 3, settings: [], ink: [{ date: '2026-01-01', updatedAt: 1, pages: [{ id: 'p', strokes: [{ id: 's', color: '#000000', size: 5, points: [{ x: Infinity, y: 2, pressure: 0.5 }] }] }] }] })).toBeNull()
  })

  it('rejects a bundle missing a required array', () => {
    const { days: _days, ...rest } = validBundle
    expect(validateExportBundle(rest)).toBeNull()
  })

  it('rejects a task with the wrong shape', () => {
    expect(
      validateExportBundle({
        ...validBundle,
        tasks: [{ id: 't1', date: '2026-01-01', title: 'Task' /* missing done/order/timestamps */ }]
      })
    ).toBeNull()
  })

  it('rejects arbitrary foreign JSON', () => {
    expect(validateExportBundle({ hello: 'world' })).toBeNull()
  })
})
