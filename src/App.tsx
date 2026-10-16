import { liveQuery } from 'dexie'
import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import { getBadgeCount } from './db/repository'
import { DueSoonStrip } from './components/DueSoonStrip'
import { ExpandOverlay } from './components/ExpandOverlay'
import { InstallGuide } from './components/InstallGuide'
import { MonthGrid } from './components/MonthGrid'
import { RolloverBanner } from './components/RolloverBanner'
import { UpdateToast } from './components/UpdateToast'
import { WeekView } from './components/WeekView'
import { TodayTimeline } from './components/TodayTimeline'
import { addDaysToDate, fromISODate, isCurrentMonth, toISODate } from './lib/dates'
import { applyThemeClass, useSettings } from './lib/settingsStore'
import { setAppBadgeCount } from './lib/appBadge'
import { useLazyComponent } from './lib/useLazyComponent'
import { useObservable } from './lib/useObservable'
import { transcribeDayAfterClose } from './lib/inkTranscription'

type View = 'today' | 'month' | 'week' | 'revision' | 'skills' | 'milestones'

function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !('MSStream' in window)
}

function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true
}

function fallbackRect(): DOMRect {
  const w = Math.min(window.innerWidth, 420)
  return new DOMRect(window.innerWidth / 2 - w / 4, 120, w / 2, 60)
}

export function App({ initialStorageNotice }: { initialStorageNotice: string | null }) {
  const settings = useSettings()

  const [view, setView] = useState<View>('today')
  const [timelineDate, setTimelineDate] = useState(new Date())
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [weekAnchor, setWeekAnchor] = useState(new Date())
  const [expandedDate, setExpandedDate] = useState<string | null>(null)
  const [expandOrigin, setExpandOrigin] = useState<DOMRect | null>(null)
  const [showSearch, setShowSearch] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showInstallGuide, setShowInstallGuide] = useState(false)
  const [storageNotice, setStorageNotice] = useState(initialStorageNotice)
  const tabsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    tabsRef.current?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.scrollIntoView({
      block: 'nearest',
      inline: 'center',
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
    })
  }, [view])

  useEffect(() => {
    applyThemeClass(settings.theme)
  }, [settings.theme])

  useEffect(() => {
    if (isIOS() && !isStandalone() && !settings.installGuideDismissed) {
      setShowInstallGuide(true)
    }
  }, [settings.installGuideDismissed])

  const badgeCount = useObservable(() => liveQuery(getBadgeCount), [], 0)
  useEffect(() => {
    setAppBadgeCount(badgeCount)
  }, [badgeCount])

  // Keep the keyboard from covering focused inputs: expose the visual
  // viewport's keyboard inset as a CSS var so panels can pad around it.
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    function update() {
      const inset = Math.max(0, window.innerHeight - vv!.height - vv!.offsetTop)
      document.documentElement.style.setProperty('--keyboard-inset', `${inset}px`)
    }
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])

  const weekStartsOn = settings.weekStartsOn

  function handleExpand(dateISO: string, originRect: DOMRect) {
    setExpandedDate(dateISO)
    setExpandOrigin(originRect)
  }

  function handleCollapse() {
    if (expandedDate) void transcribeDayAfterClose(expandedDate)
    setExpandedDate(null)
    setExpandOrigin(null)
  }

  function handleNavigateDay(delta: 1 | -1) {
    if (!expandedDate) return
    void transcribeDayAfterClose(expandedDate)
    const next = addDaysToDate(fromISODate(expandedDate), delta)
    setExpandedDate(toISODate(next))
    if (!isCurrentMonth(next, currentMonth)) setCurrentMonth(next)
    setWeekAnchor(next)
    setTimelineDate(next)
  }

  function jumpToDate(dateISO: string) {
    const date = fromISODate(dateISO)
    setShowSearch(false)
    setView('month')
    setCurrentMonth(date)
    setExpandOrigin(null)
    setExpandedDate(dateISO)
  }

  const origin = useMemo(() => expandOrigin ?? fallbackRect(), [expandOrigin])

  const SearchOverlay = useLazyComponent(() => import('./components/SearchOverlay'), showSearch)
  const SettingsScreen = useLazyComponent(() => import('./components/SettingsScreen'), showSettings)
  const LearningScreen = useLazyComponent(() => import('./components/LearningScreen'), view === 'revision' || view === 'skills' || view === 'milestones')

  return (
    <div class="app-shell">
      <div class="app-topbar ui-chrome">
        <div class="app-topbar-leading">
          <span class="app-brand"><span class="app-brand-mark">P</span><strong>Plan</strong></span>
          <button class="icon-btn" aria-label="Search" onClick={() => setShowSearch(true)}>⌕</button>
        </div>
        <div class="topbar-tabs" role="tablist" aria-label="App sections" ref={tabsRef}>
          <div class="segmented-control">
            <button role="tab" aria-selected={view === 'today'} class={view === 'today' ? 'is-active' : ''} onClick={() => setView('today')}>Today</button>
            <button role="tab" aria-selected={view === 'month'} class={view === 'month' ? 'is-active' : ''} onClick={() => setView('month')}>Month</button>
            <button role="tab" aria-selected={view === 'week'} class={view === 'week' ? 'is-active' : ''} onClick={() => setView('week')}>Week</button>
          </div>
          <div class="segmented-control learning-tabs">
            {(['revision','skills','milestones'] as const).map(section => <button role="tab" aria-selected={view === section} class={view === section ? 'is-active' : ''} onClick={() => { setExpandedDate(null); setView(section) }}>{section[0].toUpperCase()+section.slice(1)}</button>)}
          </div>
        </div>
        <a class="focus-launch" href="?focus=1" target="plan-focus" aria-label="Open Focus Garden in a separate window">Focus <span aria-hidden="true">↗</span></a>
        <button class="icon-btn" aria-label="Settings" onClick={() => setShowSettings(true)}>
          ⚙
        </button>
      </div>

      {(view === 'today' || view === 'month' || view === 'week') && <DueSoonStrip onJumpToDate={jumpToDate} />}
      {storageNotice && <div class="storage-notice" role="alert"><span>{storageNotice}</span><button class="chip-btn" onClick={() => setStorageNotice(null)}>OK</button></div>}
      {(view === 'today' || view === 'month' || view === 'week') && <RolloverBanner onReview={jumpToDate} />}

      <div class="app-view">
        {view === 'today' ? (
          <TodayTimeline date={timelineDate} onDateChange={setTimelineDate} weekStartsOn={weekStartsOn} onOpenDay={handleExpand} />
        ) : view === 'month' ? (
          <MonthGrid
            currentMonth={currentMonth}
            onMonthChange={setCurrentMonth}
            weekStartsOn={weekStartsOn}
            expandedDate={expandedDate}
            onExpand={handleExpand}
            onCollapse={handleCollapse}
          />
        ) : view === 'week' ? (
          <WeekView
            anchorDate={weekAnchor}
            onAnchorChange={setWeekAnchor}
            weekStartsOn={weekStartsOn}
            onExpand={handleExpand}
          />
        ) : LearningScreen ? <LearningScreen kind={view} /> : null}
      </div>

      {expandedDate && (
        <ExpandOverlay dateISO={expandedDate} originRect={origin} onClose={handleCollapse} onNavigateDay={handleNavigateDay} />
      )}

      <UpdateToast />

      {showSearch && SearchOverlay && <SearchOverlay onClose={() => setShowSearch(false)} onJumpToDate={jumpToDate} />}

      {showSettings && SettingsScreen && <SettingsScreen onClose={() => setShowSettings(false)} />}

      {showInstallGuide && <InstallGuide onDismiss={() => setShowInstallGuide(false)} />}
    </div>
  )
}
