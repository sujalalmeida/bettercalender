import type { InkPage, InkPoint, InkStroke } from '../db/types'
import { drawInkPage, drawStroke, INK_HEIGHT, INK_WIDTH, type InkBounds } from './ink'

/** Historical ink is rasterized only when it changes; writing never repaints it. */
export class InkRenderer {
  private width = 0
  private height = 0
  constructor(private base: HTMLCanvasElement, private active: HTMLCanvasElement, private feedback: HTMLCanvasElement) {}
  resize(width: number, height: number, dpr: number): boolean {
    const pixelWidth = Math.min(2000, Math.round(width * Math.min(dpr || 1, 2)))
    const pixelHeight = Math.round(pixelWidth * height / width)
    if (!pixelWidth || !pixelHeight || this.width === pixelWidth && this.height === pixelHeight) return false
    this.width = pixelWidth; this.height = pixelHeight
    for (const canvas of [this.base, this.active, this.feedback]) { canvas.width = pixelWidth; canvas.height = pixelHeight }
    return true
  }
  private context(canvas: HTMLCanvasElement, clear = false) {
    const ctx = canvas.getContext('2d', { desynchronized: true })
    if (!ctx) return null
    ctx.setTransform(this.width / INK_WIDTH, 0, 0, this.height / INK_HEIGHT, 0, 0)
    if (clear) ctx.clearRect(0, 0, INK_WIDTH, INK_HEIGHT)
    return ctx
  }
  page(page: InkPage) { const ctx = this.context(this.base); if (ctx) drawInkPage(ctx, page) }
  stroke(stroke: InkStroke | null) {
    const ctx = this.context(this.active, true)
    this.active.style.mixBlendMode = stroke?.tool === 'highlighter' ? 'multiply' : 'normal'
    if (ctx && stroke) drawStroke(ctx, stroke)
  }
  overlay(predicted: InkStroke | null = null, lasso: InkPoint[] = [], bounds: InkBounds | null = null, preview: InkStroke[] = [], ruler?: { start: InkPoint; angle: number }) {
    const ctx = this.context(this.feedback, true)
    if (!ctx) return
    if (predicted) { ctx.save(); ctx.globalAlpha = .5; drawStroke(ctx, predicted); ctx.restore() }
    for (const stroke of preview) drawStroke(ctx, stroke)
    ctx.strokeStyle = '#2777c8'; ctx.lineWidth = 1.5; ctx.setLineDash([6, 5])
    if (lasso.length) { ctx.beginPath(); ctx.moveTo(lasso[0].x,lasso[0].y); for (const p of lasso.slice(1)) ctx.lineTo(p.x,p.y); ctx.stroke() }
    if (bounds) {
      ctx.strokeRect(bounds.x-8,bounds.y-8,bounds.width+16,bounds.height+16)
      ctx.setLineDash([]); ctx.fillStyle = '#ffffff'
      for (const [x,y] of [[bounds.x-8,bounds.y-8],[bounds.x+bounds.width+8,bounds.y-8],[bounds.x-8,bounds.y+bounds.height+8],[bounds.x+bounds.width+8,bounds.y+bounds.height+8]]) { ctx.fillRect(x-4,y-4,8,8);ctx.strokeRect(x-4,y-4,8,8) }
    }
    if (ruler) {
      const rad = ruler.angle*Math.PI/180
      ctx.setLineDash([12,6]); ctx.strokeStyle='#78879a';ctx.lineWidth=2
      ctx.beginPath();ctx.moveTo(ruler.start.x-Math.cos(rad)*1700,ruler.start.y-Math.sin(rad)*1700);ctx.lineTo(ruler.start.x+Math.cos(rad)*1700,ruler.start.y+Math.sin(rad)*1700);ctx.stroke()
    }
    ctx.setLineDash([])
  }
  clear() { this.stroke(null); this.overlay() }
}
