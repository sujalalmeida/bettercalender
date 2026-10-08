import { liveQuery } from 'dexie'
import { useState } from 'preact/hooks'
import { getUnfinishedPast, moveTasksToToday } from '../db/repository'
import { useObservable } from '../lib/useObservable'

interface Props {
  onReview: (dateISO: string) => void
}

export function RolloverBanner({ onReview }: Props) {
  const [dismissed, setDismissed] = useState(false)
  const unfinished = useObservable(() => liveQuery(getUnfinishedPast), [], [])

  if (dismissed || unfinished.length === 0) return null

  return (
    <div class="rollover-banner ui-chrome" role="status">
      <span>
        {unfinished.length} unfinished task{unfinished.length === 1 ? '' : 's'} from earlier — move to today?
      </span>
      <div class="rollover-banner-actions">
        <button
          class="chip-btn chip-btn-primary"
          onClick={async () => {
            await moveTasksToToday(unfinished)
            setDismissed(true)
          }}
        >
          Move all
        </button>
        <button
          class="chip-btn"
          onClick={() => {
            setDismissed(true)
            onReview(unfinished[0].date)
          }}
        >
          Review
        </button>
        <button class="chip-btn chip-btn-muted" onClick={() => setDismissed(true)} aria-label="Dismiss">
          Dismiss
        </button>
      </div>
    </div>
  )
}
