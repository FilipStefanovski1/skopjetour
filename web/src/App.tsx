import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { buildCourse, CITY_CENTRE, metresBetween } from './course'
import { loadStatues, loadThemes } from './data'
import { t } from './i18n'
import type { Lang, Statue, Theme } from './types'
import { MapView, type Insets, type LatLon } from './components/MapView'
import { Carousel } from './components/Carousel'
import { SearchBar } from './components/SearchBar'
import { StatueDetail } from './components/StatueDetail'

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

/** `#/route/<theme>` and `#/s/<statue>` (or both): every route and statue has a link, ready for NFC/QR plaques. */
function readHash(): { statue: string | null; route: string | null } {
  const route = location.hash.match(/#\/route\/([^/]+)/)
  const statue = location.hash.match(/\/s\/([^/]+)/)
  return { statue: statue ? decodeURIComponent(statue[1]) : null, route: route ? decodeURIComponent(route[1]) : null }
}

function writeHash(route: string | null, statue: string | null): string {
  const parts = [route && `route/${encodeURIComponent(route)}`, statue && `s/${encodeURIComponent(statue)}`].filter(Boolean)
  return parts.length ? `#/${parts.join('/')}` : ''
}

export default function App() {
  const initial = useMemo(readHash, [])
  const [statues, setStatues] = useState<Statue[] | null>(null)
  const [themes, setThemes] = useState<Theme[]>([])
  const [failed, setFailed] = useState(false)
  const [lang, setLang] = useState<Lang>(() => (stored<string>('lang', 'mk') === 'en' ? 'en' : 'mk'))
  const [routeId, setRouteId] = useState<string | null>(initial.route)
  const [activeId, setActiveId] = useState<string | null>(initial.statue)
  const [open, setOpen] = useState(Boolean(initial.statue))
  const [seen, setSeen] = useState<Set<string>>(() => new Set(stored<string[]>('seen', [])))
  const [userPos, setUserPos] = useState<LatLon | null>(null)
  const [insets, setInsets] = useState<Insets>({ top: 0, bottom: 0 })
  const topRef = useRef<HTMLElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

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
    document.documentElement.lang = lang
    document.title = t('title', lang)
    store('lang', lang)
  }, [lang])
  useEffect(() => store('seen', [...seen]), [seen])

  useEffect(() => {
    const hash = writeHash(routeId, open ? activeId : null)
    if (hash !== location.hash) history.replaceState(null, '', hash || location.pathname)
  }, [routeId, activeId, open])

  const theme = themes.find((th) => th.id === routeId) ?? null
  const course = useMemo(() => (statues && theme ? buildCourse(theme.id, statues) : null), [statues, theme])

  // What the cards and pins show: the route in walking order, or every statue nearest first.
  const items = useMemo(() => {
    if (!statues) return []
    if (course) return [...course.controls, ...course.beyond]
    const from = userPos ?? { lat: CITY_CENTRE[0], lon: CITY_CENTRE[1] }
    return [...statues].sort((a, b) => metresBetween(from, a) - metresBetween(from, b))
    // Re-sort only when a location first arrives, not on every GPS tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statues, course, Boolean(userPos)])
  const numbers = useMemo(() => (course ? new Map(course.controls.map((s, i) => [s.id, i + 1])) : null), [course])

  // The card in the middle is always a real statue: start on the first one of each list.
  useEffect(() => {
    if (items.length && !items.some((s) => s.id === activeId)) setActiveId(items[0].id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items])
  const active = statues?.find((s) => s.id === activeId) ?? null

  const chooseRoute = (id: string | null) => {
    setRouteId(id)
    setActiveId(null)
    setOpen(false)
  }

  const openStatue = useCallback((id: string) => {
    setActiveId(id)
    setOpen(true)
  }, [])

  const closeDetail = useCallback(() => setOpen(false), [])

  const toggleSeen = (id: string) =>
    setSeen((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  // Keep the active route chip in view on narrow screens.
  useEffect(() => {
    topRef.current?.querySelector('.chips [aria-pressed="true"]')?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' })
  }, [routeId, themes.length, lang])

  // The map pads around what floats over it: search and chips on top, cards below.
  useLayoutEffect(() => {
    const measure = () =>
      setInsets({
        top: topRef.current?.getBoundingClientRect().bottom ?? 0,
        bottom: bottomRef.current ? window.innerHeight - bottomRef.current.getBoundingClientRect().top : 0,
      })
    measure()
    const ro = new ResizeObserver(measure)
    if (topRef.current) ro.observe(topRef.current)
    if (bottomRef.current) ro.observe(bottomRef.current)
    addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      removeEventListener('resize', measure)
    }
  }, [statues])

  return (
    <div className="app" style={{ '--top-h': `${insets.top}px`, '--bottom-h': `${insets.bottom}px` } as React.CSSProperties}>
      <MapView
        statues={course ? items : statues ?? []}
        course={course}
        activeId={activeId}
        seen={seen}
        lang={lang}
        insets={insets}
        onSelect={setActiveId}
        onUserPosition={setUserPos}
      />

      <header ref={topRef} className="top">
        <SearchBar statues={statues ?? []} lang={lang} onLang={setLang} onPick={openStatue} />
        <nav className="chips" aria-label={t('routes', lang)}>
          <button type="button" aria-pressed={routeId === null} onClick={() => chooseRoute(null)}>
            {t('all', lang)}
          </button>
          {themes.map((th) => (
            <button key={th.id} type="button" aria-pressed={routeId === th.id} onClick={() => chooseRoute(th.id)}>
              {th[lang]}
            </button>
          ))}
        </nav>
      </header>

      <div ref={bottomRef} className="bottom">
        {failed ? (
          <div className="notice">
            <p>{t('loadError', lang)}</p>
            <button type="button" onClick={load}>
              {t('retry', lang)}
            </button>
          </div>
        ) : !statues ? (
          <div className="notice">
            <p>{t('loading', lang)}</p>
          </div>
        ) : (
          <Carousel
            items={items}
            activeId={activeId}
            lang={lang}
            numbers={numbers}
            userPos={userPos}
            seen={seen}
            onActive={setActiveId}
            onOpen={openStatue}
          />
        )}
      </div>

      {open && active && (
        <StatueDetail
          statue={active}
          lang={lang}
          themes={themes}
          list={items}
          numbers={numbers}
          userPos={userPos}
          seen={seen.has(active.id)}
          onToggleSeen={() => toggleSeen(active.id)}
          onNavigate={setActiveId}
          onClose={closeDetail}
        />
      )}
    </div>
  )
}
