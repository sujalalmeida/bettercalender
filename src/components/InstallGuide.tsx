import { updateSetting } from '../lib/settingsStore'

interface Props {
  onDismiss: () => void
}

export function InstallGuide({ onDismiss }: Props) {
  function dismiss() {
    updateSetting('installGuideDismissed', true)
    onDismiss()
  }

  return (
    <div class="install-guide-overlay" role="dialog" aria-modal="true" aria-label="Install Plan">
      <div class="install-guide-card">
        <h2>Install Plan on your Home Screen</h2>
        <p>Add Plan to your Home Screen for a full-screen, offline-ready app — no App Store needed.</p>
        <ol class="install-guide-steps">
          <li>
            <span class="install-guide-step-icon" aria-hidden="true">
              ⬆︎
            </span>
            Tap the <strong>Share</strong> button in Safari's toolbar.
          </li>
          <li>
            <span class="install-guide-step-icon" aria-hidden="true">
              ➕
            </span>
            Scroll down and tap <strong>Add to Home Screen</strong>.
          </li>
          <li>
            <span class="install-guide-step-icon" aria-hidden="true">
              ✓
            </span>
            Tap <strong>Add</strong> — Plan now opens like any other app.
          </li>
        </ol>
        <button class="chip-btn chip-btn-primary" onClick={dismiss}>
          Got it
        </button>
      </div>
    </div>
  )
}
