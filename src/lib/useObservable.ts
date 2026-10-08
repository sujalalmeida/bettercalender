import type { Observable } from 'dexie'
import { useEffect, useRef, useState } from 'preact/hooks'

const UNSET = Symbol('unset')

/**
 * Subscribes to a Dexie liveQuery observable and re-renders when the
 * underlying IndexedDB data it reads changes. `deps` controls when the
 * observable factory is re-created (same semantics as useEffect deps).
 */
export function useObservable<T>(factory: () => Observable<T>, deps: readonly unknown[], initial: T): T {
  const [value, setValue] = useState<T | typeof UNSET>(UNSET)
  const factoryRef = useRef(factory)
  factoryRef.current = factory

  useEffect(() => {
    setValue(UNSET)
    const subscription = factoryRef.current().subscribe({
      next: (v) => setValue(v),
      error: (err) => console.error('useObservable error', err)
    })
    return () => subscription.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return value === UNSET ? initial : value
}
