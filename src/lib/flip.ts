export interface Rect {
  top: number
  left: number
  width: number
  height: number
}

export function getRect(el: Element): Rect {
  const r = el.getBoundingClientRect()
  return { top: r.top, left: r.left, width: r.width, height: r.height }
}

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Animates `el` from `first` to its current (`last`) rect using only transform/opacity (FLIP). */
export function flipAnimate(
  el: HTMLElement,
  first: Rect,
  last: Rect,
  opts: { duration?: number; easing?: string } = {}
): Animation | null {
  const dx = first.left - last.left
  const dy = first.top - last.top
  const sx = first.width / last.width
  const sy = first.height / last.height
  if (![dx, dy, sx, sy].every(Number.isFinite)) return null
  if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && Math.abs(sx - 1) < 0.01 && Math.abs(sy - 1) < 0.01) return null

  if (prefersReducedMotion()) {
    return el.animate([{ opacity: 0.4 }, { opacity: 1 }], { duration: 150, easing: 'ease-out' })
  }

  el.style.transformOrigin = 'top left'
  return el.animate(
    [{ transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` }, { transform: 'none' }],
    { duration: opts.duration ?? 250, easing: opts.easing ?? 'cubic-bezier(0.32, 0.72, 0.33, 1)', fill: 'both' }
  )
}
