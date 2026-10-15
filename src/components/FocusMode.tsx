import { useEffect, useState } from 'preact/hooks'
import { EMPTY_FOCUS_TIMER, FOCUS_STORAGE_KEY, focusElapsed, formatFocusTime, parseFocusTimer, pauseFocus, startFocus, type FocusTimerState } from '../lib/focusTimer'
import '../styles/focus.css'

type FlowerKind = 'white rose' | 'red rose' | 'lily'
type Flower = { x: number; y: number; height: number; kind: FlowerKind; seedAt: number }
const BLOOM_MS = 35_000

const FLOWERS: Flower[] = Array.from({ length: 38 }, (_, index) => ({
  x: 82 + ((index * 233) % 830),
  y: 352 + ((index * 109) % 148),
  height: 64 + ((index * 31) % 38),
  kind: (['lily', 'white rose', 'red rose'] as FlowerKind[])[index % 3],
  seedAt: index === 0 ? 0 : index === 1 ? 25_000 : index === 2 ? 50_000 : 50_000 + (index - 2) * 150_000
})).sort((a, b) => a.y - b.y)

const clamp = (value: number) => Math.max(0, Math.min(1, value))

function Rose({ red }: { red: boolean }) {
  const petal = red ? '#c95055' : '#f2f0e8'
  const edge = red ? '#9d343f' : '#c8c9bd'
  const inner = red ? '#a93c47' : '#d8d9cb'
  return <g>
    <ellipse cx="-12" cy="0" rx="13" ry="17" fill={petal} stroke={edge} strokeWidth="1.5" transform="rotate(-26 -12 0)" />
    <ellipse cx="12" cy="0" rx="13" ry="17" fill={petal} stroke={edge} strokeWidth="1.5" transform="rotate(26 12 0)" />
    <ellipse cx="0" cy="-9" rx="14" ry="16" fill={petal} stroke={edge} strokeWidth="1.5" />
    <ellipse cx="0" cy="8" rx="13" ry="11" fill={inner} stroke={edge} strokeWidth="1.5" />
    <path d="M-7 5 C-4 -3 9 -4 8 4 C7 10 -3 11 -3 5 C-3 1 3 1 3 5" fill="none" stroke={edge} strokeWidth="2" strokeLinecap="round" />
  </g>
}

function Lily() {
  return <g>
    <path d="M0 1 Q-8 -11 -8 -29 Q0 -25 4 -10 Z" fill="#f4f0e5" stroke="#d7d6c5" strokeWidth="1.5" />
    <path d="M1 2 Q7 -15 17 -23 Q17 -11 8 -2 Z" fill="#faf6eb" stroke="#d7d6c5" strokeWidth="1.5" />
    <path d="M1 3 Q18 -5 26 2 Q16 9 6 8 Z" fill="#f0ede2" stroke="#d7d6c5" strokeWidth="1.5" />
    <path d="M0 4 Q-13 1 -24 8 Q-14 16 -3 9 Z" fill="#faf6eb" stroke="#d7d6c5" strokeWidth="1.5" />
    <path d="M0 2 Q-19 -8 -22 -19 Q-9 -19 3 -5 Z" fill="#f0ede2" stroke="#d7d6c5" strokeWidth="1.5" />
    <path d="M1 3 Q6 15 0 25 Q-8 16 -5 6 Z" fill="#f4f0e5" stroke="#d7d6c5" strokeWidth="1.5" />
    <circle cy="2" r="5" fill="#d4ab55" />
    <path d="M-3 1 L-6 -10 M2 0 L8 -8 M1 5 L11 10" stroke="#9b7d40" strokeWidth="1.6" strokeLinecap="round" />
  </g>
}

function GardenPlant({ flower, elapsedMs }: { flower: Flower; elapsedMs: number }) {
  const progress = clamp((elapsedMs - flower.seedAt) / BLOOM_MS)
  if (progress <= 0) return null
  const stem = flower.height * clamp(.14 + progress * 1.7)
  const bloom = clamp((progress - .42) / .58)
  const depth = .8 + (flower.y - 352) / 540
  return <g transform={`translate(${flower.x} ${flower.y}) scale(${depth})`}>
    <ellipse cx="0" cy="3" rx="22" ry="7" fill="#153823" opacity=".55" />
    <path d={`M0 0 Q${flower.x % 2 ? 9 : -9} -${stem * .5} 0 -${stem}`} fill="none" stroke="#70a675" strokeWidth="4" strokeLinecap="round" />
    {progress > .3 && <g opacity={clamp((progress - .3) * 4)}>
      <path d={`M2 -${stem * .44} Q21 -${stem * .7} 28 -${stem * .49} Q14 -${stem * .33} 2 -${stem * .44}`} fill="#5f9a67" />
      <path d={`M-2 -${stem * .62} Q-23 -${stem * .84} -28 -${stem * .59} Q-15 -${stem * .46} -2 -${stem * .62}`} fill="#79ae76" />
    </g>}
    {bloom > 0 && <g transform={`translate(0 -${stem}) scale(${bloom})`} class="focus-flower-head">
      {flower.kind === 'lily' ? <Lily /> : <Rose red={flower.kind === 'red rose'} />}
    </g>}
  </g>
}

function GardenScene({ elapsedMs, running }: { elapsedMs: number; running: boolean }) {
  const growing = FLOWERS.filter(flower => elapsedMs > flower.seedAt).length
  const bloomed = FLOWERS.filter(flower => elapsedMs >= flower.seedAt + BLOOM_MS).length
  return <div class="focus-garden-scene">
    <svg viewBox="0 0 1000 560" preserveAspectRatio="xMidYMid meet" role="img" aria-label={`Green focus garden with ${bloomed} ${bloomed === 1 ? 'flower' : 'flowers'} in bloom and ${Math.max(0, growing - bloomed)} growing`}>
      <rect width="1000" height="560" fill="#173b29" />
      <path d="M0 205 Q150 157 290 199 T590 190 T1000 174 L1000 560 L0 560 Z" fill="#20482f" />
      <path d="M0 305 Q200 263 415 300 T1000 265 L1000 560 L0 560 Z" fill="#285438" />
      <path d="M0 445 Q190 402 400 443 T1000 401 L1000 560 L0 560 Z" fill="#315f3d" />
      {Array.from({ length: 82 }, (_, index) => {
        const x = (index * 137) % 1000
        const y = 310 + ((index * 73) % 245)
        return <path key={index} d={`M${x} ${y} l-3 -8 M${x} ${y} l4 -10`} fill="none" stroke={index % 3 ? '#4e8054' : '#6b9a61'} strokeWidth="1.4" opacity=".55" />
      })}
      {FLOWERS.map((flower, index) => <GardenPlant key={index} flower={flower} elapsedMs={elapsedMs} />)}
    </svg>
    {elapsedMs === 0 && <div class="focus-garden-empty">A quiet place to begin.</div>}
    {running && <span class="focus-garden-live"><span /> GROWING WITH YOU</span>}
  </div>
}

function readSavedTimer(): FocusTimerState {
  try { return parseFocusTimer(localStorage.getItem(FOCUS_STORAGE_KEY)) }
  catch { return { ...EMPTY_FOCUS_TIMER } }
}

function saveTimer(state: FocusTimerState): void {
  try { localStorage.setItem(FOCUS_STORAGE_KEY, JSON.stringify(state)) }
  catch { /* Timer still works in memory if storage is unavailable. */ }
}

export function FocusMode() {
  const plannerUrl = new URL(window.location.href)
  plannerUrl.searchParams.delete('focus')
  const [timer, setTimer] = useState(readSavedTimer)
  const [now, setNow] = useState(Date.now())
  const elapsedMs = focusElapsed(timer, now)
  const running = timer.startedAt !== null
  const bloomed = FLOWERS.filter(flower => elapsedMs >= flower.seedAt + BLOOM_MS).length
  const nextSeed = FLOWERS.filter(flower => flower.seedAt > elapsedMs).sort((a, b) => a.seedAt - b.seedAt)[0]

  useEffect(() => {
    const previousTitle = document.title
    document.title = 'Focus Garden · Plan'
    return () => { document.title = previousTitle }
  }, [])

  useEffect(() => {
    const interval = window.setInterval(() => {
      const tick = Date.now()
      setNow(tick)
      if (timer.startedAt !== null) saveTimer({ ...timer, lastSeenAt: tick })
    }, 1000)
    const onStorage = (event: StorageEvent) => {
      if (event.key !== FOCUS_STORAGE_KEY) return
      const incoming = parseFocusTimer(event.newValue)
      setTimer(current => current.startedAt === incoming.startedAt && current.elapsedMs === incoming.elapsedMs ? current : incoming)
      setNow(Date.now())
    }
    const onPageHide = () => {
      if (timer.startedAt !== null) saveTimer(pauseFocus(timer, Date.now()))
    }
    window.addEventListener('storage', onStorage)
    window.addEventListener('pagehide', onPageHide)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('pagehide', onPageHide)
    }
  }, [timer])

  function update(next: FocusTimerState) {
    saveTimer(next)
    setTimer(next)
    setNow(Date.now())
  }

  function resetGarden() {
    if (elapsedMs > 0 && !window.confirm('Start a new garden? This clears the current stopwatch and flowers.')) return
    update({ ...EMPTY_FOCUS_TIMER })
  }

  return <div class="focus-shell">
    <header class="focus-header">
      <span class="focus-brand"><span>P</span> PLAN / FOCUS</span>
      <a href={plannerUrl.toString()} class="focus-return">Back to planner <span aria-hidden="true">↗</span></a>
    </header>
    <main class="focus-layout">
      <section class="focus-control-panel" aria-label="Focus stopwatch">
        <div class="focus-intro">
          <span class="focus-eyebrow">YOUR QUIET SPACE</span>
          <h1>GROW YOUR<br />FOCUS.</h1>
          <p>Start the stopwatch and let your garden grow as you study. Take your time; every minute counts.</p>
        </div>
        <div class="focus-clock-stack">
          <div class="focus-clock-card">
            <div class="focus-clock-top"><span>FOCUS TIME</span><span class={running ? 'focus-status is-running' : 'focus-status'}><i />{running ? 'IN PROGRESS' : elapsedMs > 0 ? 'PAUSED' : 'READY'}</span></div>
            <div class="focus-clock" role="timer" aria-label={`Focused for ${formatFocusTime(elapsedMs)}`}>{formatFocusTime(elapsedMs)}</div>
            <div class="focus-clock-actions">
              <button class="focus-main-action" onClick={() => update(running ? pauseFocus(timer, Date.now()) : startFocus(timer, Date.now()))}>{running ? 'Pause focus' : elapsedMs > 0 ? 'Continue focusing' : 'Start focusing'} <span aria-hidden="true">{running ? 'Ⅱ' : '→'}</span></button>
              <button class="focus-reset" onClick={resetGarden} disabled={elapsedMs === 0}>New garden</button>
            </div>
          </div>
          <div class="focus-progress-note"><span>{bloomed} {bloomed === 1 ? 'flower' : 'flowers'} in bloom</span><span>{nextSeed ? `Next seed in ${Math.max(1, Math.ceil((nextSeed.seedAt - elapsedMs) / 60_000))} min` : 'Garden in full bloom'}</span></div>
        </div>
      </section>
      <section class="focus-garden-panel" aria-label="Growing focus garden">
        <div class="focus-garden-top"><span>THE GARDEN</span><span>WHITE ROSES / RED ROSES / LILIES</span></div>
        <GardenScene elapsedMs={elapsedMs} running={running} />
        <div class="focus-garden-bottom"><span>01 / GROWTH</span><span>Stay with the work. The garden will follow.</span></div>
      </section>
    </main>
  </div>
}
