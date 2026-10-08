import { useEffect, useState } from 'preact/hooks'
import type { ComponentType } from 'preact'

/**
 * Loads a component's module only once `active` is true, so rarely-used
 * screens (Search, Settings) are code-split via plain dynamic import()
 * instead of pulling in preact/compat's lazy/Suspense (smaller bundle).
 */
export function useLazyComponent<P>(loader: () => Promise<{ default: ComponentType<P> }>, active: boolean): ComponentType<P> | null {
  const [Comp, setComp] = useState<ComponentType<P> | null>(null)

  useEffect(() => {
    if (!active || Comp) return
    let cancelled = false
    loader().then((mod) => {
      if (!cancelled) setComp(() => mod.default)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  return Comp
}
