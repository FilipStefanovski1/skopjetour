import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { buildCourse } from './course'
import { loadStatues, loadThemes } from './data'
import { t } from './i18n'
import type { Lang, Statue, Theme } from './types'
import { MapView, type Insets } from './components/MapView'
import { CourseSheet } from './components/CourseSheet'
import { StatueCard } from './components/StatueCard'
import { Sheet, type SheetState } from './components/Sheet'

function stored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

function store(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // storage unavailable (private mode): the choice just isn't remembered
  }
}

/** `#/route/<theme>` and `#/s/<statue>` (or both) make every route and statue linkable, and NFC-ready. */
function readHash(): { statue: string | null; route: string | null } {
  const route = location.hash.match(/#\/route\/([^/]+)/)
  const statue = location.hash.match(/\/s\/([^/]+)/)
  return { statue: statue ? decodeURIComponent(statue[1]) : null, route: route ? decodeURIComponent(route[1]) : null }
}

function writeHash(route: string | null, statue: string | null): string {
  const parts = [route && `route/${encodeURIComponent(route)}`, statue && `s/${encodeURIComponent(statue)}`].filter(Boolean)
  return parts.length ? `#/${parts.join('/')}` : ''
}

const WIDE = '(min-width: 900px)'

export default function App() {
  const [statues, setStatues] = useState<Statue[] | null>(null)
  const [themes, setThemes] = useState<Theme[]>([])
  const [failed, setFailed] = useState(false)
  const [lang, setLang] = useState<Lang>(() => (stored<string>('lang', 'mk') === 'en' ? 'en' : 'mk'))
  const [routeId, setRouteId] = useState<string | null>(() => readHash().route)
  const [selectedId, setSelectedId] = useState<string | null>(() => readHash().statue)
  const [seen, setSeen] = useState<Set<string>>(() => new Set(stored<string[]>('seen', [])))
  const [sheet, setSheet] = useState<SheetState>('peek')
  const [wide, setWide] = useState(() => matchMedia(WIDE).matches)
  const [insets, setInsets] = useState<Insets>({ top: 0, bottom: 0, left: 0 })
  const headerRef = useRef<HTMLElement>(null)

  const load = useCallback(() => {
    setFailed(false)
    Promise.all([loadStatues(), loadThemes()])
      .then(([s, th]) => {
        setStatues(s)
        setThemes(th)
      })
      .catch(() => setFailed(true))
  }, [])
  useEffect(load, [load])

  useEffect(() => {
    const mq = matchMedia(WIDE)
    const on = () => setWide(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])

  useEffect(() => {
    document.documentElement.lang = lang
    document.title = t('title', lang)
    store('lang', lang)
  }, [lang])

  useEffect(() => store('seen', [...seen]), [seen])

  useEffect(() => {
    const hash = writeHash(routeId, selectedId)
    if (hash !== location.hash) history.replaceState(null, '', hash || location.pathname)
  }, [selectedId, routeId])

  useEffect(() => {
    const onHash = () => {
      const h = readHash()
      setSelectedId(h.statue)
      setRouteId(h.route)
    }
    addEventListener('hashchange', onHash)
    return () => removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    const active = headerRef.current?.querySelector<HTMLElement>('.routes [aria-pressed="true"]')
    active?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' })
  }, [routeId, themes.length, lang])

  const theme = themes.find((th) => th.id === routeId) ?? null
  const course = useMemo(() => (statues && theme ? buildCourse(theme.id, statues) : null), [statues, theme])
  const courseCounts = useMemo(
    () => Object.fromEntries(themes.map((th) => [th.id, statues?.filter((s) => s.themes.includes(th.id)).length ?? 0])),
    [themes, statues],
  )
  const selected = statues?.find((s) => s.id === selectedId) ?? null

  const select = useCallback((id: string) => {
    setSelectedId(id)
    setSheet((s) => (s === 'full' ? 'full' : 'half'))
  }, [])

  const chooseRoute = (id: string | null) => {
    setRouteId(id)
    setSelectedId(null)
    setSheet('peek')
  }

  const toggleSeen = (id: string) =>
    setSeen((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  // Keep the map's padding in step with what covers it: the header on top, the sheet below.
  useLayoutEffect(() => {
    const header = headerRef.current
    if (!header) return
    const measure = () => {
      const top = wide ? 0 : header.getBoundingClientRect().bottom
      setInsets((i) => (i.top === top ? i : { ...i, top }))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(header)
    return () => ro.disconnect()
  }, [wide])
  const onSheetVisible = useCallback((px: number) => setInsets((i) => (i.bottom === px ? i : { ...i, bottom: px })), [])

  const header = (
    <header ref={headerRef} className="masthead">
      <div className="masthead__row">
        <h1 className="wordmark">
          <svg viewBox="0 0 40 32" width="34" height="27" aria-hidden>
            <path d="M11 4 20 20H2z" />
            <circle cx="27" cy="18" r="9" />
          </svg>
          {t('title', lang)}
        </h1>
        <div className="lang" role="group" aria-label="Language / Јазик">
          {(['mk', 'en'] as const).map((l) => (
            <button key={l} type="button" aria-pressed={lang === l} onClick={() => setLang(l)}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      <nav className="routes" aria-label={t('routes', lang)}>
        <button type="button" aria-pressed={routeId === null} onClick={() => chooseRoute(null)}>
          {t('allStatues', lang)}
          <span className="routes__n">{statues?.length ?? '–'}</span>
        </button>
        {themes.map((th) => (
          <button key={th.id} type="button" aria-pressed={routeId === th.id} onClick={() => chooseRoute(th.id)}>
            {th[lang]}
            <span className="routes__n">{courseCounts[th.id]}</span>
          </button>
        ))}
      </nav>
    </header>
  )

  let body
  if (failed) {
    body = (
      <div className="sheet-body sheet-state">
        <p>{t('loadError', lang)}</p>
        <button type="button" className="button button--secondary" onClick={load}>
          {t('retry', lang)}
        </button>
      </div>
    )
  } else if (!statues) {
    body = <p className="sheet-body sheet-state">{t('loadingStatues', lang)}</p>
  } else if (selected) {
    body = (
      <StatueCard
        statue={selected}
        lang={lang}
        themes={themes}
        course={course}
        seen={seen.has(selected.id)}
        onToggleSeen={() => toggleSeen(selected.id)}
        onSelect={select}
        onBack={() => setSelectedId(null)}
      />
    )
  } else {
    body = <CourseSheet lang={lang} statues={statues} course={course} theme={theme} seen={seen} onSelect={select} />
  }

  return (
    <div
      className={`app${wide ? ' app--wide' : ''}`}
      style={{ '--header-h': `${insets.top}px`, '--sheet-h': `${insets.bottom}px` } as React.CSSProperties}
    >
      {wide ? (
        <aside className="panel">
          {header}
          <div className="panel__scroll">{body}</div>
        </aside>
      ) : (
        <>
          {header}
          <Sheet state={sheet} onState={setSheet} onVisible={onSheetVisible} lang={lang} resetKey={selectedId ?? routeId ?? 'all'}>
            {body}
          </Sheet>
        </>
      )}
      <MapView
        statues={statues ?? []}
        course={course}
        selectedId={selectedId}
        seen={seen}
        lang={lang}
        insets={wide ? { top: 0, bottom: 0, left: 0 } : insets}
        onSelect={select}
      />
    </div>
  )
}
