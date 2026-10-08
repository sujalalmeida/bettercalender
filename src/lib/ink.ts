import type { InkDocument, InkPage, InkPoint, InkStroke } from '../db/types'
import { createId } from './id'

export const INK_WIDTH = 1000
export const INK_HEIGHT = 1400

export function blankInkDocument(date: string): InkDocument {
  return { date, pages: [{ id: createId(), strokes: [] }], updatedAt: Date.now() }
}

export function appendStroke(document: InkDocument, pageIndex: number, stroke: InkStroke): InkDocument {
  return { ...document, pages: document.pages.map((page, i) => i === pageIndex ? { ...page, strokes: [...page.strokes, stroke] } : page) }
}

function distanceToSegment(point: InkPoint, a: InkPoint, b: InkPoint): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lengthSquared = dx * dx + dy * dy
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared))
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy))
}

export function eraseAt(document: InkDocument, pageIndex: number, point: InkPoint, radius: number): InkDocument {
  const page = document.pages[pageIndex]
  const strokes = page.strokes.filter(stroke => {
    const points = stroke.points
    return !points.some((p, i) => distanceToSegment(point, points[Math.max(0, i - 1)], p) <= radius + stroke.size)
  })
  if (strokes.length === page.strokes.length) return document
  return { ...document, pages: document.pages.map((p, i) => i === pageIndex ? { ...p, strokes } : p) }
}

export function addInkPage(document: InkDocument): InkDocument {
  const page: InkPage = { id: createId(), strokes: [] }
  return { ...document, pages: [...document.pages, page] }
}

export function clearInkPage(document: InkDocument, pageIndex: number): InkDocument {
  if (document.pages[pageIndex].strokes.length === 0) return document
  return { ...document, pages: document.pages.map((page, i) => i === pageIndex ? { ...page, strokes: [] } : page) }
}

export function removeInkPage(document: InkDocument, pageIndex: number): InkDocument {
  if (document.pages.length === 1) return clearInkPage(document, 0)
  return { ...document, pages: document.pages.filter((_, i) => i !== pageIndex) }
}

export function drawInkPage(ctx: CanvasRenderingContext2D, page: InkPage, active?: InkStroke | null): void {
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, INK_WIDTH, INK_HEIGHT)
  ctx.strokeStyle = '#e8eef5'
  ctx.lineWidth = 1
  for (let y = 96; y < INK_HEIGHT - 30; y += 48) {
    ctx.beginPath()
    ctx.moveTo(48, y)
    ctx.lineTo(INK_WIDTH - 48, y)
    ctx.stroke()
  }
  for (const stroke of page.strokes) drawStroke(ctx, stroke)
  if (active) drawStroke(ctx, active)
}

function drawStroke(ctx: CanvasRenderingContext2D, stroke: InkStroke): void {
  const points = stroke.points
  if (points.length === 0) return
  ctx.fillStyle = stroke.color
  ctx.strokeStyle = stroke.color
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  if (points.length === 1) {
    ctx.beginPath()
    ctx.arc(points[0].x, points[0].y, Math.max(0.5, stroke.size * points[0].pressure / 2), 0, Math.PI * 2)
    ctx.fill()
    return
  }
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]
    const b = points[i]
    ctx.lineWidth = Math.max(1, stroke.size * (a.pressure + b.pressure) / 2)
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()
  }
}
