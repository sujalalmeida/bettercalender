import { useMemo, useState } from 'preact/hooks'
import { liveQuery } from 'dexie'
import { buildSearchIndex, searchIndex, type SearchResult } from '../db/repository'
import { fromISODate, formatDayTitle } from '../lib/dates'
import { useEscapeKey } from '../lib/useEscapeKey'
import { useObservable } from '../lib/useObservable'

interface Props {
  onClose: () => void
  onJumpToDate: (dateISO: string) => void
}

export default function SearchOverlay({ onClose, onJumpToDate }: Props) {
  const [query, setQuery] = useState('')
  const index = useObservable(() => liveQuery(buildSearchIndex), [], null as SearchResult[] | null)
  const loading = index === null

  useEscapeKey(onClose)

  const results = useMemo(() => searchIndex(index ?? [], query), [index, query])

  const grouped = new Map<string, SearchResult[]>()
  for (const r of results) {
    if (!grouped.has(r.date)) grouped.set(r.date, [])
    grouped.get(r.date)!.push(r)
  }

  return (
    <div class="search-overlay" role="dialog" aria-modal="true" aria-label="Search">
      <header class="search-header">
        <input
          type="search"
          autoFocus
          placeholder="Search notes and tasks…"
          value={query}
          onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
        />
        <button class="chip-btn" onClick={onClose}>
          Cancel
        </button>
      </header>

      <div class="search-results scroll-panel">
        {query.trim() && loading && <p class="search-empty">Searching…</p>}
        {query.trim() && !loading && grouped.size === 0 && <p class="search-empty">No results for "{query}"</p>}
        {[...grouped.entries()].map(([date, items]) => (
          <div class="search-group" key={date}>
            <h3 class="search-group-title">{formatDayTitle(fromISODate(date))}</h3>
            {items.map((item, i) => (
              <button class="search-result" key={i} onClick={() => onJumpToDate(date)}>
                <span class="search-result-kind">{item.kind === 'note' ? 'Note' : 'Task'}</span>
                <span class="search-result-snippet">{item.snippet}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
