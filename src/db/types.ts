export type RepeatFrequency = 'daily' | 'weekdays' | 'weekly' | 'monthly' | 'custom'

export interface RepeatRule {
  frequency: RepeatFrequency
  /** For 'weekly': 0 (Sun) - 6 (Sat) days the item repeats on. */
  daysOfWeek?: number[]
  /** For 'custom': repeat every N days. */
  intervalDays?: number
}

export interface Day {
  date: string // YYYY-MM-DD, primary key
  notes: string
  updatedAt: number
}

/** Vector ink is stored in page coordinates so it stays sharp after rotation or resizing. */
export interface InkPoint { x: number; y: number; pressure: number }
export interface InkStroke { id: string; color: string; size: number; points: InkPoint[] }
export interface InkPage { id: string; strokes: InkStroke[] }
export interface InkDocument { date: string; pages: InkPage[]; updatedAt: number }

export interface Task {
  id: string
  date: string
  title: string
  done: boolean
  order: number
  time?: string
  categoryId?: string
  deadline?: boolean
  /** Links an occurrence back to its Recurrence rule; absent for one-off tasks. */
  recurrenceId?: string
  createdAt: number
  updatedAt: number
}

export interface Recurrence {
  id: string
  rule: RepeatRule
  startDate: string
  endDate?: string
  title: string
  time?: string
  categoryId?: string
  deadline?: boolean
  /** Dates (YYYY-MM-DD) where this occurrence was edited/completed/deleted independently. */
  exceptions: string[]
}

export interface Category {
  id: string
  name: string
  color: string
  order: number
}

export interface Template {
  id: string
  name: string
  tasks: { title: string; time?: string; categoryId?: string }[]
}

export interface SettingsRow {
  key: string
  value: unknown
}

export interface RevisionTopic {
  id: string
  title: string
  subject: string
  reason: string
  takeaway: string
  source: string
  confidence: 1 | 2 | 3
  nextReviewDate: string
  reviewCount: number
  mastered: boolean
  createdAt: number
  updatedAt: number
}

export interface SkillEntry {
  id: string
  kind: 'learning' | 'practice'
  title: string
  note: string
  rotation: string
  nextStep: string
  confidence: 1 | 2 | 3
  status: 'active' | 'done' | 'cancelled'
  createdAt: number
  updatedAt: number
}

export interface MilestoneStep {
  id: string
  title: string
  done: boolean
}

export interface Milestone {
  id: string
  kind: 'exam' | 'application' | 'elective' | 'reference' | 'form' | 'other'
  title: string
  dueDate: string
  notes: string
  url: string
  steps: MilestoneStep[]
  status: 'planned' | 'waiting' | 'done' | 'cancelled'
  createdAt: number
  updatedAt: number
}
