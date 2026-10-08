import { useEffect, useRef, useState } from 'preact/hooks'
import { saveDayNotes } from '../db/repository'

const DEBOUNCE_MS = 400

interface Props {
  dateISO: string
  initialNotes: string
  autoFocus?: boolean
}

export function NotesEditor({ dateISO, initialNotes, autoFocus }: Props) {
  const [value, setValue] = useState(initialNotes)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestValue = useRef(value)
  const dirty = useRef(false)

  useEffect(() => {
    if (!dirty.current) {
      setValue(initialNotes)
      latestValue.current = initialNotes
    }
  }, [initialNotes])

  useEffect(() => {
    latestValue.current = value
    autoResize()
  }, [value])

  function flush() {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
    if (!dirty.current) return
    dirty.current = false
    saveDayNotes(dateISO, latestValue.current).catch((err) => {
      dirty.current = true
      console.error('Failed to save notes', err)
    })
  }

  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') flush() }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', onHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', onHide)
      flush()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function autoResize() {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }

  function handleInput(e: Event) {
    const next = (e.target as HTMLTextAreaElement).value
    latestValue.current = next
    dirty.current = true
    setValue(next)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(flush, DEBOUNCE_MS)
  }

  return (
    <textarea
      ref={textareaRef}
      class="notes-editor"
      placeholder="Type or use Scribble with Apple Pencil…"
      aria-label="Day notes; type or use Apple Pencil Scribble"
      value={value}
      onInput={handleInput}
      onBlur={flush}
      autoFocus={autoFocus}
      rows={3}
    />
  )
}
