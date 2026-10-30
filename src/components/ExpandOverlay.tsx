import { useLayoutEffect, useRef, useState } from 'preact/hooks'
import { getRect, prefersReducedMotion } from '../lib/flip'
import { useEscapeKey } from '../lib/useEscapeKey'
import { DayPanelContent } from './DayPanelContent'
import { flushInkForDate } from '../lib/inkSaveCoordinator'

interface Props {
  dateISO: string
  originRect: DOMRect
  onClose: () => void
  onNavigateDay: (delta: 1 | -1) => void
}

const DURATION = 250
const EASING = 'cubic-bezier(0.32, 0.72, 0.33, 1)'

export function ExpandOverlay({ dateISO, originRect, onClose, onNavigateDay }: Props) {
  const cardRef = useRef<HTMLDivElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)
  const [closing, setClosing] = useState(false)
  const dragStart = useRef<{ y: number } | null>(null)
  const [dragY, setDragY] = useState(0)
  const [dragging, setDragging] = useState(false)
  const transitionBusy = useRef(false)
  const [saveError, setSaveError] = useState('')

  useLayoutEffect(() => {
    const card = cardRef.current
    const backdrop = backdropRef.current
    if (!card) return
    const last = getRect(card)
    const reduced = prefersReducedMotion()

    if (reduced) {
      card.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150, easing: 'ease-out' })
      backdrop?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150, easing: 'ease-out' })
      return
    }

    const dx = originRect.left + originRect.width / 2 - (last.left + last.width / 2)
    const dy = originRect.top + originRect.height / 2 - (last.top + last.height / 2)
    const sx = originRect.width / last.width
    const sy = originRect.height / last.height

    card.style.transformOrigin = 'center'
    card.animate(
      [
        { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, borderRadius: '20px', opacity: 0.6 },
        { transform: 'none', borderRadius: '20px', opacity: 1 }
      ],
      { duration: DURATION, easing: EASING }
    )
    backdrop?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: DURATION, easing: 'ease-out' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleClose() {
    if (transitionBusy.current) return
    transitionBusy.current = true
    try { await flushInkForDate(dateISO) }
    catch { transitionBusy.current = false; setSaveError('Your handwriting could not be saved. Keep this day open and try again.'); return }
    const card = cardRef.current
    const backdrop = backdropRef.current
    if (!card || prefersReducedMotion()) {
      onClose()
      return
    }
    setClosing(true)
    const last = getRect(card)
    const dx = originRect.left + originRect.width / 2 - (last.left + last.width / 2)
    const dy = originRect.top + originRect.height / 2 - (last.top + last.height / 2)
    const sx = originRect.width / last.width
    const sy = originRect.height / last.height

    const anim = card.animate(
      [
        { transform: `translateY(${dragY}px)`, opacity: 1 },
        { transform: `translate(${dx}px, ${dy + dragY}px) scale(${sx}, ${sy})`, opacity: 0.4 }
      ],
      { duration: DURATION, easing: EASING }
    )
    backdrop?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: DURATION, easing: 'ease-out' })
    anim.onfinish = () => onClose()
  }

  async function navigateDay(delta: 1 | -1) {
    if (transitionBusy.current) return
    transitionBusy.current = true
    try { await flushInkForDate(dateISO); setSaveError(''); onNavigateDay(delta) }
    catch { setSaveError('Your handwriting could not be saved. Keep this day open and try again.') }
    finally { transitionBusy.current = false }
  }

  useEscapeKey(handleClose)

  function onHeaderPointerDown(e: PointerEvent) {
    dragStart.current = { y: e.clientY }
  }
  function onHeaderPointerMove(e: PointerEvent) {
    if (!dragStart.current) return
    const dy = e.clientY - dragStart.current.y
    if (dy > 0) {
      setDragging(true)
      setDragY(dy)
    }
  }
  function onHeaderPointerUp() {
    if (dragY > 100) {
      handleClose()
    } else {
      setDragY(0)
    }
    setDragging(false)
    dragStart.current = null
  }

  return (
    <div class="expand-overlay">
      <div class="expand-backdrop" ref={backdropRef} onClick={handleClose} />
      <div
        class={`expand-card ${closing ? 'is-closing' : ''}`}
        ref={cardRef}
        style={dragging ? { transform: `translateY(${dragY}px)`, transition: 'none' } : undefined}
        role="dialog"
        aria-modal="true"
        aria-label={`Day details for ${dateISO}`}
      >
        <div
          class="expand-card-drag-handle"
          onPointerDown={onHeaderPointerDown}
          onPointerMove={onHeaderPointerMove}
          onPointerUp={onHeaderPointerUp}
          onPointerCancel={() => { setDragY(0); setDragging(false); dragStart.current = null }}
        >
          <span class="expand-card-grabber" aria-hidden="true" />
        </div>
        {saveError && <p class="workspace-error" role="alert">{saveError}</p>}
        <DayPanelContent dateISO={dateISO} onClose={handleClose} onNavigateDay={navigateDay} />
      </div>
    </div>
  )
}
