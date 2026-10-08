import { liveQuery } from 'dexie'
import { useRef, useState } from 'preact/hooks'
import { db } from '../db/db'
import { deleteCategory, exportAll, importAll, upsertCategory, upsertTemplate, deleteTemplate } from '../db/repository'
import { validateExportBundle } from '../lib/backup'
import { createId } from '../lib/id'
import { LEAD_TIME_LABELS, type ReminderLeadTime } from '../lib/ics'
import { applyThemeClass, updateSetting, useSettings, type Theme } from '../lib/settingsStore'
import { useEscapeKey } from '../lib/useEscapeKey'
import { useObservable } from '../lib/useObservable'
import { useLazyComponent } from '../lib/useLazyComponent'

interface Props {
  onClose: () => void
}

const SWATCHES = ['#007aff', '#ff3b30', '#ff9500', '#ffcc00', '#34c759', '#5ac8fa', '#af52de', '#ff2d55', '#a2845e']

export default function SettingsScreen({ onClose }: Props) {
  const settings = useSettings()
  const categories = useObservable(() => liveQuery(() => db.categories.orderBy('order').toArray()), [], [])
  const templates = useObservable(() => liveQuery(() => db.templates.toArray()), [], [])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importMessage, setImportMessage] = useState<string | null>(null)
  const CloudSyncSettings = useLazyComponent(() => import('./CloudSyncSettings'), true)

  useEscapeKey(onClose)

  async function handleExport() {
    const bundle = await exportAll()
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `plan-backup-${bundle.exportedAt.slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    await updateSetting('lastExportAt', new Date().toISOString())
  }

  async function handleImportFile(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      const bundle = validateExportBundle(parsed)
      if (!bundle) {
        setImportMessage("This file doesn't look like a Plan backup.")
        return
      }
      const mode = window.confirm('Replace all current data with this backup? Cancel to merge instead.') ? 'replace' : 'merge'
      await importAll(bundle, mode)
      setImportMessage(`Imported ${bundle.tasks.length} tasks and ${bundle.days.length} days (${mode}).`)
    } catch {
      setImportMessage('Could not read that file as JSON.')
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function handleThemeChange(theme: Theme) {
    updateSetting('theme', theme)
    applyThemeClass(theme)
  }

  async function addCategory() {
    await upsertCategory({ id: createId(), name: 'New category', color: SWATCHES[categories.length % SWATCHES.length], order: categories.length })
  }

  async function addTemplate() {
    await upsertTemplate({ id: createId(), name: 'New template', tasks: [{ title: 'Task' }] })
  }

  return (
    <div class="settings-screen" role="dialog" aria-modal="true" aria-label="Settings">
      <header class="search-header">
        <h2>Settings</h2>
        <button class="chip-btn" onClick={onClose}>
          Done
        </button>
      </header>

      <div class="settings-body scroll-panel">
        {CloudSyncSettings ? <CloudSyncSettings /> : <section class="settings-section"><h3>Cloud sync</h3><p class="settings-hint">Loading sync options…</p></section>}
        <section class="settings-section">
          <h3>Appearance</h3>
          <div class="settings-row">
            <label>Theme</label>
            <select value={settings.theme} onChange={(e) => handleThemeChange((e.target as HTMLSelectElement).value as Theme)}>
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>
          <div class="settings-row">
            <label>Week starts on</label>
            <select
              value={settings.weekStartsOn}
              onChange={(e) => updateSetting('weekStartsOn', Number((e.target as HTMLSelectElement).value) as 0 | 1)}
            >
              <option value={0}>Sunday</option>
              <option value={1}>Monday</option>
            </select>
          </div>
          <div class="settings-row">
            <label>Default reminder lead time</label>
            <select
              value={settings.reminderLeadTime}
              onChange={(e) => updateSetting('reminderLeadTime', (e.target as HTMLSelectElement).value as ReminderLeadTime)}
            >
              {Object.entries(LEAD_TIME_LABELS).map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </section>

        <section class="settings-section">
          <h3>Categories</h3>
          {categories.map((cat) => (
            <div class="settings-category-row" key={cat.id}>
              <input
                type="color"
                value={cat.color}
                onChange={(e) => upsertCategory({ ...cat, color: (e.target as HTMLInputElement).value })}
                aria-label={`${cat.name} color`}
              />
              <input
                type="text"
                value={cat.name}
                onChange={(e) => upsertCategory({ ...cat, name: (e.target as HTMLInputElement).value })}
                aria-label="Category name"
              />
              <button class="chip-btn chip-btn-muted" onClick={() => deleteCategory(cat.id)}>
                Remove
              </button>
            </div>
          ))}
          <button class="chip-btn" onClick={addCategory}>
            + Add category
          </button>
        </section>

        <section class="settings-section">
          <h3>Quick-add templates</h3>
          {templates.map((tpl) => (
            <div class="template-editor" key={tpl.id}>
              <div class="settings-category-row">
                <input type="text" value={tpl.name} onChange={(e) => upsertTemplate({ ...tpl, name: (e.target as HTMLInputElement).value })} aria-label="Template name" />
                <button class="chip-btn chip-btn-muted" onClick={() => deleteTemplate(tpl.id)}>Remove</button>
              </div>
              {tpl.tasks.map((task, index) => (
                <div class="template-task-row" key={index}>
                  <input type="text" value={task.title} aria-label={`Task ${index + 1} title`} onInput={e => {
                    const tasks = [...tpl.tasks]
                    tasks[index] = { ...task, title: (e.target as HTMLInputElement).value }
                    upsertTemplate({ ...tpl, tasks })
                  }} />
                  <input type="time" value={task.time ?? ''} aria-label={`Task ${index + 1} time`} onChange={e => {
                    const tasks = [...tpl.tasks]
                    tasks[index] = { ...task, time: (e.target as HTMLInputElement).value || undefined }
                    upsertTemplate({ ...tpl, tasks })
                  }} />
                  <select value={task.categoryId ?? ''} aria-label={`Task ${index + 1} category`} onChange={e => {
                    const tasks = [...tpl.tasks]
                    tasks[index] = { ...task, categoryId: (e.target as HTMLSelectElement).value || undefined }
                    upsertTemplate({ ...tpl, tasks })
                  }}>
                    <option value="">No category</option>
                    {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                  </select>
                  <button class="icon-btn" aria-label={`Remove task ${index + 1}`} onClick={() => upsertTemplate({ ...tpl, tasks: tpl.tasks.filter((_, i) => i !== index) })}>×</button>
                </div>
              ))}
              <button class="chip-btn" onClick={() => upsertTemplate({ ...tpl, tasks: [...tpl.tasks, { title: 'New task' }] })}>+ Add task</button>
            </div>
          ))}
          <button class="chip-btn" onClick={addTemplate}>
            + Add template
          </button>
        </section>

        <section class="settings-section">
          <h3>Backup</h3>
          <p class="settings-hint">
            {settings.lastExportAt ? `Last export: ${new Date(settings.lastExportAt).toLocaleString()}` : 'You have not exported a backup yet.'}
          </p>
          <div class="settings-row-buttons">
            <button class="chip-btn chip-btn-primary" onClick={handleExport}>
              Export JSON
            </button>
            <button class="chip-btn" onClick={() => fileInputRef.current?.click()}>
              Import JSON
            </button>
            <input ref={fileInputRef} type="file" accept="application/json" class="visually-hidden" onChange={handleImportFile} />
          </div>
          {importMessage && <p class="settings-hint">{importMessage}</p>}
        </section>

        <section class="settings-section">
          <h3>About</h3>
          <p class="settings-hint">
            Plan saves immediately on this device and syncs to Firebase after sign-in when online. To install on an iPhone or iPad: open this page in Safari, tap the Share icon, then
            "Add to Home Screen".
          </p>
          <p class="settings-hint">Due Soon and app badges update while you use Plan. For alerts when Plan is closed, export a task to Apple Calendar with an alert.</p>
        </section>
      </div>
    </div>
  )
}
