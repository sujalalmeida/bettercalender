export const FOCUS_STORAGE_KEY = 'plan.focus-garden.v1'

export interface FocusTimerState {
  elapsedMs: number
  startedAt: number | null
  lastSeenAt: number | null
}

export const EMPTY_FOCUS_TIMER: FocusTimerState = { elapsedMs: 0, startedAt: null, lastSeenAt: null }

function safeTime(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
}

export function parseFocusTimer(raw: string | null, now = Date.now()): FocusTimerState {
  if (!raw) return { ...EMPTY_FOCUS_TIMER }
  try {
    const value = JSON.parse(raw) as Record<string, unknown>
    const elapsedMs = safeTime(value.elapsedMs) ?? 0
    const startedAt = safeTime(value.startedAt)
    const lastSeenAt = safeTime(value.lastSeenAt)
    if (startedAt === null || lastSeenAt === null || startedAt > now || lastSeenAt < startedAt) {
      return { elapsedMs, startedAt: null, lastSeenAt: null }
    }
    // A closed or suspended window cannot earn focus time indefinitely.
    if (now - lastSeenAt > 30_000) {
      return { elapsedMs: elapsedMs + lastSeenAt - startedAt, startedAt: null, lastSeenAt: null }
    }
    return { elapsedMs, startedAt, lastSeenAt }
  } catch {
    return { ...EMPTY_FOCUS_TIMER }
  }
}

export function focusElapsed(state: FocusTimerState, now = Date.now()): number {
  return state.elapsedMs + (state.startedAt === null ? 0 : Math.max(0, now - state.startedAt))
}

export function startFocus(state: FocusTimerState, now = Date.now()): FocusTimerState {
  return state.startedAt === null ? { ...state, startedAt: now, lastSeenAt: now } : state
}

export function pauseFocus(state: FocusTimerState, now = Date.now()): FocusTimerState {
  return { elapsedMs: focusElapsed(state, now), startedAt: null, lastSeenAt: null }
}

export function formatFocusTime(milliseconds: number): string {
  const seconds = Math.floor(Math.max(0, milliseconds) / 1000)
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return [hours, minutes, seconds % 60].map(value => String(value).padStart(2, '0')).join(':')
}
