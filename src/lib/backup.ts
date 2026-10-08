import type { ExportBundle } from '../db/repository'

function isString(v: unknown): v is string {
  return typeof v === 'string'
}
function isBoolean(v: unknown): v is boolean {
  return typeof v === 'boolean'
}
function isNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}
const isDate = (v: unknown): v is string => isString(v) && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(new Date(`${v}T12:00:00`).getTime())
const optional = (v: unknown, check: (value: unknown) => boolean) => v === undefined || check(v)
function isArray(v: unknown): v is unknown[] {
  return Array.isArray(v)
}
function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function isDay(v: unknown): boolean {
  return isObject(v) && isDate(v.date) && isString(v.notes) && isNumber(v.updatedAt)
}

function isTask(v: unknown): boolean {
  return (
    isObject(v) &&
    isString(v.id) &&
    isDate(v.date) &&
    isString(v.title) &&
    isBoolean(v.done) &&
    isNumber(v.order) &&
    isNumber(v.createdAt) &&
    isNumber(v.updatedAt) &&
    optional(v.time, isString) && optional(v.categoryId, isString) && optional(v.deadline, isBoolean) && optional(v.recurrenceId, isString)
  )
}

function isRecurrence(v: unknown): boolean {
  if (!isObject(v) || !isString(v.id) || !isObject(v.rule) || !isDate(v.startDate) || !isString(v.title) || !isArray(v.exceptions) || !v.exceptions.every(isDate)) return false
  if (!optional(v.endDate, isDate) || !optional(v.time, isString) || !optional(v.categoryId, isString) || !optional(v.deadline, isBoolean)) return false
  const frequency = v.rule.frequency
  if (!['daily', 'weekdays', 'weekly', 'monthly', 'custom'].includes(String(frequency))) return false
  if (frequency === 'weekly' && (!isArray(v.rule.daysOfWeek) || !v.rule.daysOfWeek.every(d => typeof d === 'number' && Number.isInteger(d) && d >= 0 && d <= 6))) return false
  if (frequency === 'custom' && (!Number.isInteger(v.rule.intervalDays) || (v.rule.intervalDays as number) < 1)) return false
  return true
}

function isCategory(v: unknown): boolean {
  return isObject(v) && isString(v.id) && isString(v.name) && isString(v.color) && isNumber(v.order)
}

function isTemplate(v: unknown): boolean {
  return isObject(v) && isString(v.id) && isString(v.name) && isArray(v.tasks) && v.tasks.every(t => isObject(t) && isString(t.title) && optional(t.time, isString) && optional(t.categoryId, isString))
}

function isInkDocument(v: unknown): boolean {
  return isObject(v) && isDate(v.date) && isNumber(v.updatedAt) && isArray(v.pages) && v.pages.every(page =>
    isObject(page) && isString(page.id) && isArray(page.strokes) && page.strokes.every(stroke =>
      isObject(stroke) && isString(stroke.id) && isString(stroke.color) && /^#[0-9a-fA-F]{6}$/.test(stroke.color) &&
      isNumber(stroke.size) && stroke.size > 0 && stroke.size <= 100 && isArray(stroke.points) && stroke.points.length > 0 &&
      stroke.points.every(point => isObject(point) && isNumber(point.x) && isNumber(point.y) && isNumber(point.pressure) &&
        point.x >= 0 && point.x <= 1000 && point.y >= 0 && point.y <= 1400 && point.pressure >= 0 && point.pressure <= 1)
    )
  )
}

/**
 * Validates an untrusted parsed-JSON value against the export schema.
 * Returns the bundle if valid, or null if the shape doesn't match
 * (so callers can show a friendly "this file isn't a Plan backup" message
 * instead of crashing on malformed/foreign JSON).
 */
export function validateExportBundle(value: unknown): ExportBundle | null {
  if (!isObject(value)) return null
  if (value.version !== 1 && value.version !== 2 && value.version !== 3) return null
  if (!isString(value.exportedAt) || Number.isNaN(Date.parse(value.exportedAt))) return null
  if (!isArray(value.days) || !value.days.every(isDay)) return null
  if (!isArray(value.tasks) || !value.tasks.every(isTask)) return null
  if (!isArray(value.recurrences) || !value.recurrences.every(isRecurrence)) return null
  if (!isArray(value.categories) || !value.categories.every(isCategory)) return null
  if (!isArray(value.templates) || !value.templates.every(isTemplate)) return null
  if (value.version >= 2 && (!isArray(value.settings) || !value.settings.every(v => isObject(v) && isString(v.key)))) return null
  if (value.version === 3 && (!isArray(value.ink) || !value.ink.every(isInkDocument))) return null

  return value as unknown as ExportBundle
}
