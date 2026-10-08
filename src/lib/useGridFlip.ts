import { useLayoutEffect, useRef } from 'preact/hooks'
import { flipAnimate, getRect, type Rect } from './flip'

/**
 * Applies a FLIP transition to every `[data-flip-id]` descendant of
 * `containerRef` whenever `dep` changes, animating each from its rect
 * before the change to its rect after (used for the tablet month grid,
 * where expanding one cell reflows its neighbors).
 */
export function useGridFlip(containerRef: { current: HTMLElement | null }, dep: unknown): void {
  const prevRects = useRef<Map<string, Rect>>(new Map())
  const firstRun = useRef(true)

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return
    const items = Array.from(container.querySelectorAll<HTMLElement>('[data-flip-id]'))

    if (firstRun.current) {
      items.forEach((el) => prevRects.current.set(el.dataset.flipId!, getRect(el)))
      firstRun.current = false
      return
    }

    items.forEach((el) => {
      const id = el.dataset.flipId!
      const last = getRect(el)
      const first = prevRects.current.get(id)
      if (first) flipAnimate(el, first, last)
      prevRects.current.set(id, last)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dep])
}
