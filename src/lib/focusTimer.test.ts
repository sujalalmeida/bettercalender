import { describe, expect, it } from 'vitest'
import { focusElapsed, formatFocusTime, parseFocusTimer, pauseFocus, startFocus } from './focusTimer'

describe('focus timer', () => {
  it('starts, pauses, resumes, and formats elapsed time', () => {
    const running = startFocus({ elapsedMs: 0, startedAt: null, lastSeenAt: null }, 1000)
    expect(focusElapsed(running, 62_000)).toBe(61_000)
    const paused = pauseFocus(running, 62_000)
    expect(focusElapsed(paused, 90_000)).toBe(61_000)
    expect(formatFocusTime(focusElapsed(startFocus(paused, 90_000), 91_000))).toBe('00:01:02')
  })

  it('stops counting when a saved window has gone stale', () => {
    const raw = JSON.stringify({ elapsedMs: 10_000, startedAt: 1000, lastSeenAt: 6000 })
    expect(parseFocusTimer(raw, 50_000)).toEqual({ elapsedMs: 15_000, startedAt: null, lastSeenAt: null })
    expect(parseFocusTimer(raw, 7000).startedAt).toBe(1000)
  })

  it('ignores damaged saved state', () => {
    expect(parseFocusTimer('{bad')).toEqual({ elapsedMs: 0, startedAt: null, lastSeenAt: null })
  })
})
