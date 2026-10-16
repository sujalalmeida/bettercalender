const flushers = new Map<string, () => Promise<void>>()

export function registerInkFlusher(dateISO: string, flush: () => Promise<void>): () => void {
  flushers.set(dateISO, flush)
  return () => { if (flushers.get(dateISO) === flush) flushers.delete(dateISO) }
}

export async function flushInkForDate(dateISO: string): Promise<void> {
  await flushers.get(dateISO)?.()
}
