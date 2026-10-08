import { useEffect, useRef, useState } from 'preact/hooks'
import { createPortal } from 'preact/compat'
import type { InkDocument, InkPoint, InkStroke } from '../db/types'
import { getInk, saveInk } from '../db/repository'
import { addInkPage, appendStroke, blankInkDocument, clearInkPage, drawInkPage, eraseAt, removeInkPage, INK_HEIGHT, INK_WIDTH } from '../lib/ink'
import { createId } from '../lib/id'

interface Props { dateISO: string; onClose: () => void }
type Tool = 'pen' | 'eraser'
const COLORS = ['#182331', '#0066cc', '#16804a', '#a53d2d', '#8955a0']
const MAX_HISTORY = 40

export default function InkEditor({ dateISO, onClose }: Props) {
  const [document, setDocument] = useState<InkDocument | null>(null)
  const documentRef = useRef<InkDocument | null>(null)
  const [pageIndex, setPageIndex] = useState(0)
  const pageIndexRef = useRef(0)
  const [tool, setTool] = useState<Tool>('pen')
  const toolRef = useRef<Tool>('pen')
  const [color, setColor] = useState(COLORS[0])
  const [size, setSize] = useState(5)
  const [fingerDraw, setFingerDraw] = useState(false)
  const [status, setStatus] = useState('Loading…')
  const undoRef = useRef<InkDocument[]>([])
  const redoRef = useRef<InkDocument[]>([])
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const scrollTouchRef = useRef<{ id: number; y: number; top: number } | null>(null)
  const activeRef = useRef<InkStroke | null>(null)
  const activePointerRef = useRef<number | null>(null)
  const gestureBeforeRef = useRef<InkDocument | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const writeQueueRef = useRef<Promise<void>>(Promise.resolve())
  const frameRef = useRef<number | null>(null)

  useEffect(() => {
    let mounted = true
    getInk(dateISO).then(saved => {
      if (!mounted) return
      const next = saved?.pages.length ? saved : blankInkDocument(dateISO)
      documentRef.current = next
      setDocument(next)
      setStatus('Saved')
    }).catch(() => { if (mounted) setStatus('Could not load handwriting. Reopen this day to retry.') })
    return () => { mounted = false; flush(); if (frameRef.current !== null) cancelAnimationFrame(frameRef.current) }
  }, [dateISO])

  function setCurrentPage(index: number) {
    pageIndexRef.current = index
    setPageIndex(index)
  }

  function renderCanvas() {
    const canvas = canvasRef.current
    const doc = documentRef.current
    if (!canvas || !doc) return
    const rect = canvas.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const width = Math.round(rect.width * dpr)
    const height = Math.round(rect.height * dpr)
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height }
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(width / INK_WIDTH, 0, 0, height / INK_HEIGHT, 0, 0)
    drawInkPage(ctx, doc.pages[pageIndexRef.current], activeRef.current)
  }

  function scheduleRender() {
    if (frameRef.current !== null) return
    frameRef.current = requestAnimationFrame(() => { frameRef.current = null; renderCanvas() })
  }

  useEffect(() => {
    if (!document) return
    const canvas = canvasRef.current
    if (!canvas) return
    const observer = new ResizeObserver(scheduleRender)
    observer.observe(canvas)
    scheduleRender()
    return () => observer.disconnect()
  }, [document, pageIndex])

  function flush() {
    if (saveTimerRef.current !== null) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null }
    const snapshot = documentRef.current
    if (!snapshot) return
    writeQueueRef.current = writeQueueRef.current.catch(() => undefined).then(() => saveInk(snapshot))
    writeQueueRef.current.then(() => setStatus('Saved')).catch(() => setStatus('Could not save. Keep this page open and try again.'))
  }

  function scheduleSave() {
    setStatus('Saving…')
    if (saveTimerRef.current !== null) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(flush, 400)
  }

  useEffect(() => {
    const onHide = () => { if (window.document.visibilityState === 'hidden') flush() }
    window.document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', flush)
    return () => { window.document.removeEventListener('visibilitychange', onHide); window.removeEventListener('pagehide', flush) }
  })

  function updateDocument(next: InkDocument, before?: InkDocument) {
    const previous = before ?? documentRef.current
    if (!previous || next === previous) return
    undoRef.current = [...undoRef.current.slice(-MAX_HISTORY + 1), previous]
    redoRef.current = []
    documentRef.current = next
    setDocument(next)
    scheduleRender()
    scheduleSave()
  }

  function undo() {
    const previous = undoRef.current.pop()
    const current = documentRef.current
    if (!previous || !current) return
    redoRef.current.push(current)
    documentRef.current = previous
    setDocument(previous)
    setCurrentPage(Math.min(pageIndexRef.current, previous.pages.length - 1))
    scheduleRender()
    scheduleSave()
  }

  function redo() {
    const next = redoRef.current.pop()
    const current = documentRef.current
    if (!next || !current) return
    undoRef.current.push(current)
    documentRef.current = next
    setDocument(next)
    setCurrentPage(Math.min(pageIndexRef.current, next.pages.length - 1))
    scheduleRender()
    scheduleSave()
  }

  function pointFromEvent(event: PointerEvent): InkPoint {
    const rect = canvasRef.current!.getBoundingClientRect()
    const tilt = Math.min(1, Math.hypot(event.tiltX || 0, event.tiltY || 0) / 90)
    const pressure = event.pointerType === 'pen' ? Math.max(0.12, Math.min(1, (event.pressure || 0.5) + tilt * 0.1)) : 0.7
    return {
      x: Math.max(0, Math.min(INK_WIDTH, (event.clientX - rect.left) / rect.width * INK_WIDTH)),
      y: Math.max(0, Math.min(INK_HEIGHT, (event.clientY - rect.top) / rect.height * INK_HEIGHT)),
      pressure
    }
  }

  function onPointerDown(event: PointerEvent) {
    if (!documentRef.current || activePointerRef.current !== null) return
    if (event.pointerType === 'touch' && !fingerDraw) {
      scrollTouchRef.current = { id: event.pointerId, y: event.clientY, top: scrollRef.current?.scrollTop ?? 0 }
      canvasRef.current?.setPointerCapture(event.pointerId)
      return
    }
    if (event.pointerType === 'mouse' && event.button !== 0) return
    event.preventDefault()
    scrollTouchRef.current = null
    canvasRef.current?.setPointerCapture(event.pointerId)
    activePointerRef.current = event.pointerId
    const point = pointFromEvent(event)
    if (toolRef.current === 'eraser') {
      gestureBeforeRef.current = documentRef.current
      const next = eraseAt(documentRef.current, pageIndexRef.current, point, 22)
      documentRef.current = next
      setDocument(next)
    } else {
      activeRef.current = { id: createId(), color, size, points: [point] }
    }
    scheduleRender()
  }

  function onPointerMove(event: PointerEvent) {
    if (scrollTouchRef.current?.id === event.pointerId) {
      event.preventDefault()
      if (scrollRef.current) scrollRef.current.scrollTop = scrollTouchRef.current.top + scrollTouchRef.current.y - event.clientY
      return
    }
    if (activePointerRef.current !== event.pointerId) return
    event.preventDefault()
    const samples = event.getCoalescedEvents?.() ?? [event]
    for (const sample of samples.length ? samples : [event]) {
      const point = pointFromEvent(sample)
      if (toolRef.current === 'eraser') {
        const next = eraseAt(documentRef.current!, pageIndexRef.current, point, 22)
        if (next !== documentRef.current) { documentRef.current = next; setDocument(next) }
      } else if (activeRef.current) {
        const last = activeRef.current.points[activeRef.current.points.length - 1]
        if (Math.hypot(point.x - last.x, point.y - last.y) >= 0.5) activeRef.current.points.push(point)
      }
    }
    scheduleRender()
  }

  function finishPointer(event: PointerEvent) {
    if (scrollTouchRef.current?.id === event.pointerId) {
      scrollTouchRef.current = null
      if (canvasRef.current?.hasPointerCapture(event.pointerId)) canvasRef.current.releasePointerCapture(event.pointerId)
      return
    }
    if (activePointerRef.current !== event.pointerId) return
    const before = gestureBeforeRef.current
    const current = documentRef.current
    if (toolRef.current === 'eraser' && before && current && current !== before) updateDocument(current, before)
    if (toolRef.current === 'pen' && activeRef.current && current) updateDocument(appendStroke(current, pageIndexRef.current, activeRef.current))
    activeRef.current = null
    gestureBeforeRef.current = null
    activePointerRef.current = null
    if (canvasRef.current?.hasPointerCapture(event.pointerId)) canvasRef.current.releasePointerCapture(event.pointerId)
    scheduleRender()
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') { event.stopPropagation(); handleClose(); return }
    if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'z') return
    event.preventDefault()
    if (event.shiftKey) redo(); else undo()
  }

  function handleClose() { flush(); onClose() }

  async function saveImage() {
    const page = documentRef.current?.pages[pageIndexRef.current]
    if (!page) return
    const canvas = window.document.createElement('canvas')
    canvas.width = INK_WIDTH
    canvas.height = INK_HEIGHT
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    drawInkPage(ctx, page)
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const link = window.document.createElement('a')
    link.href = url
    link.download = `plan-${dateISO}-page-${pageIndexRef.current + 1}.png`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return createPortal((
    <div class="ink-editor" role="dialog" aria-modal="true" aria-label={`Handwriting for ${dateISO}`} onKeyDown={handleKeyDown}>
      <header class="ink-toolbar">
        <button class="chip-btn" autoFocus onClick={handleClose}>Done</button>
        <div class="ink-toolbar-title"><strong>Handwriting</strong><span>{dateISO}</span></div>
        <span class="ink-save-status" role="status">{status}</span>
      </header>
      <div class="ink-tools" role="toolbar" aria-label="Drawing tools">
        <button class={`ink-tool ${tool === 'pen' ? 'is-active' : ''}`} aria-pressed={tool === 'pen'} onClick={() => { setTool('pen'); toolRef.current = 'pen' }}>Pen</button>
        <button class={`ink-tool ${tool === 'eraser' ? 'is-active' : ''}`} aria-pressed={tool === 'eraser'} onClick={() => { setTool('eraser'); toolRef.current = 'eraser' }}>Eraser</button>
        <div class="ink-colors" aria-label="Ink color">
          {COLORS.map(value => <button key={value} class={`ink-color ${color === value ? 'is-active' : ''}`} style={{ backgroundColor: value }} aria-label={`${value} ink`} aria-pressed={color === value} onClick={() => { setColor(value); setTool('pen'); toolRef.current = 'pen' }} />)}
        </div>
        <label class="ink-size">Size <input type="range" min="2" max="18" value={size} onInput={event => setSize(Number((event.target as HTMLInputElement).value))} /></label>
        <button class="ink-tool" disabled={!undoRef.current.length} onClick={undo} aria-label="Undo stroke">Undo</button>
        <button class="ink-tool" disabled={!redoRef.current.length} onClick={redo} aria-label="Redo stroke">Redo</button>
      </div>
      <div class="ink-options">
        <label><input type="checkbox" checked={fingerDraw} onChange={event => setFingerDraw((event.target as HTMLInputElement).checked)} /> Draw with finger</label>
        <span>Apple Pencil writes here. Fingers scroll by default.</span>
      </div>
      <div class="ink-scroll scroll-panel" ref={scrollRef}>
        {document ? <canvas ref={canvasRef} class="ink-canvas" role="img" aria-label={`Handwritten page ${pageIndex + 1} of ${document.pages.length}`} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={finishPointer} onPointerCancel={finishPointer} /> : <p>{status}</p>}
      </div>
      <footer class="ink-footer">
        <button class="chip-btn" disabled={pageIndex === 0} onClick={() => setCurrentPage(pageIndex - 1)}>‹ Page</button>
        <span>Page {pageIndex + 1} of {document?.pages.length ?? 1}</span>
        <button class="chip-btn" disabled={!document || pageIndex >= document.pages.length - 1} onClick={() => setCurrentPage(pageIndex + 1)}>Page ›</button>
        <button class="chip-btn" disabled={!document} onClick={() => { if (document) { updateDocument(addInkPage(document)); setCurrentPage(document.pages.length) } }}>+ Page</button>
        <button class="chip-btn" disabled={!document?.pages[pageIndex]?.strokes.length} onClick={() => { if (document) updateDocument(clearInkPage(document, pageIndex)) }}>Clear page</button>
        <button class="chip-btn" disabled={!document || (document.pages.length === 1 && !document.pages[0].strokes.length)} onClick={() => { if (document) { updateDocument(removeInkPage(document, pageIndex)); setCurrentPage(Math.max(0, Math.min(pageIndex, document.pages.length - 2))) } }}>Delete page</button>
        <button class="chip-btn" disabled={!document} onClick={saveImage}>Save image</button>
      </footer>
    </div>
  ), window.document.body)
}
