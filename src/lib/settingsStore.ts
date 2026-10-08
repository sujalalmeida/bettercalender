import { liveQuery } from 'dexie'
import { db } from '../db/db'
import { setSetting } from '../db/repository'
import { useObservable } from './useObservable'
import type { ReminderLeadTime } from './ics'

export type Theme = 'system' | 'light' | 'dark'

export interface AppSettings {
  weekStartsOn: 0 | 1
  theme: Theme
  reminderLeadTime: ReminderLeadTime
  lastExportAt: string | null
  installGuideDismissed: boolean
  storagePersistAsked: boolean
}

export const DEFAULT_SETTINGS: AppSettings = {
  weekStartsOn: 0,
  theme: 'system',
  reminderLeadTime: '10-min',
  lastExportAt: null,
  installGuideDismissed: false,
  storagePersistAsked: false
}

export function useSettings(): AppSettings {
  return useObservable(
    () =>
      liveQuery(async () => {
        const rows = await db.settings.toArray()
        const map = Object.fromEntries(rows.map((r) => [r.key, r.value]))
        return { ...DEFAULT_SETTINGS, ...map } as AppSettings
      }),
    [],
    DEFAULT_SETTINGS
  )
}

export async function updateSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]): Promise<void> {
  await setSetting(key, value)
}

export function applyThemeClass(theme: Theme): void {
  const root = document.documentElement
  if (theme === 'system') {
    root.removeAttribute('data-theme')
  } else {
    root.setAttribute('data-theme', theme)
  }
  try {
    localStorage.setItem('plan.theme', theme)
  } catch {
    // ignore (private browsing / storage blocked)
  }
}
