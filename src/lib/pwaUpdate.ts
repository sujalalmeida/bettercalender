import { useEffect, useState } from 'preact/hooks'

type Listener = () => void

let needRefresh = false
let offlineReady = false
let updateFn: (() => Promise<void>) | null = null
const listeners = new Set<Listener>()

function notify() {
  listeners.forEach((l) => l())
}

export function initPWAUpdate(): void {
  // Dynamically imported so this is a no-op (and harmless) in dev/test
  // environments where the virtual module isn't generated.
  import('virtual:pwa-register')
    .then(({ registerSW }) => {
      updateFn = registerSW({
        immediate: true,
        onNeedRefresh() {
          needRefresh = true
          notify()
        },
        onOfflineReady() {
          offlineReady = true
          notify()
          setTimeout(() => {
            offlineReady = false
            notify()
          }, 3000)
        }
      })
    })
    .catch(() => {
      // PWA plugin not active (e.g. during `vitest` or plain dev without build) — ignore.
    })
}

export function useAppUpdateStatus(): { needRefresh: boolean; offlineReady: boolean; applyUpdate: () => void } {
  const [, setTick] = useState(0)

  useEffect(() => {
    const listener = () => setTick((t) => t + 1)
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }, [])

  return {
    needRefresh,
    offlineReady,
    applyUpdate: () => updateFn?.()
  }
}
