import { useAppUpdateStatus } from '../lib/pwaUpdate'

export function UpdateToast() {
  const { needRefresh, offlineReady, applyUpdate } = useAppUpdateStatus()

  if (offlineReady) {
    return (
      <div class="update-toast" role="status">
        Ready to work offline.
      </div>
    )
  }

  if (!needRefresh) return null

  return (
    <div class="update-toast" role="status">
      <span>Update available</span>
      <button class="chip-btn chip-btn-primary" onClick={applyUpdate}>
        Tap to refresh
      </button>
    </div>
  )
}
