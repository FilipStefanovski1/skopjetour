import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ARRIVAL_DWELL_MS, buildCourse, CITY_CENTRE, metresBetween, updateArrival, type ArrivalState, type LocationFix } from './course'
import { loadStatues, loadThemes } from './data'
import { t } from './i18n'
import type { Lang, Statue, Theme } from './types'
import { statueName } from './types'
import { Check, X } from 'lucide-react'
import { MapView, type Insets, type LatLon } from './components/MapView'
import { MapDiscovery } from './components/MapDiscovery'
import { useWalkingRoute } from './useWalkingRoute'
import { SearchBar } from './components/SearchBar'
import { StatueDetail } from './components/StatueDetail'
import { BottomNav, type Tab } from './components/BottomNav'
import { ScanPage } from './components/ScanPage'
import { CollectionPage } from './components/CollectionPage'
import { PhotoMatch } from './components/PhotoMatch'

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

interface Place {
  tab: Tab
  route: string | null
  statue: string | null
}

/**
 * `#/map`, `#/collection`, `#/route/<theme>` and `#/s/<statue>`. A plaque's NFC tag holds a
 * `#/s/<statue>` link: opening one is a scan, so it lands on the statue and collects it.
 */
function readHash(): Place {
  const h = location.hash
  const route = h.match(/#\/(?:map\/)?route\/([^/]+)/)
  const statue = h.match(/\/s\/([^/?#]+)/)
  const tab: Tab = h.startsWith('#/collection') ? 'collection' : h.startsWith('#/map') || route ? 'map' : 'scan'
  return { tab, route: route ? decodeURIComponent(route[1]) : null, statue: statue ? decodeURIComponent(statue[1]) : null }
}

function writeHash({ tab, route, statue }: Place): string {
  const parts = [
    tab === 'map' && 'map',
    tab === 'collection' && 'collection',
    tab === 'map' && route && `route/${encodeURIComponent(route)}`,
    statue && `s/${encodeURIComponent(statue)}`,
  ].filter(Boolean)
  return parts.length ? `#/${parts.join('/')}` : ''
}

export default function App() {
  const initial = useMemo(readHash, [])
  const [statues, setStatues] = useState<Statue[] | null>(null)
  const [themes, setThemes] = useState<Theme[]>([])
  const [failed, setFailed] = useState(false)
  const [lang, setLang] = useState<Lang>(() => (stored<string>('lang', 'mk') === 'en' ? 'en' : 'mk'))
  const [tab, setTab] = useState<Tab>(initial.tab)
  const [routeId, setRouteId] = useState<string | null>(initial.route)
  const [activeId, setActiveId] = useState<string | null>(initial.statue)
  const [openId, setOpenId] = useState<string | null>(initial.statue)
  const [justCollected, setJustCollected] = useState<string | null>(initial.tab === 'scan' ? initial.statue : null)
  const [seen, setSeen] = useState<Set<string>>(() => {
    const s = new Set(stored<string[]>('seen', []))
    if (initial.statue && initial.tab === 'scan') s.add(initial.statue) // arrived from a plaque
    return s
  })
  const [userPos, setUserPos] = useState<LocationFix | null>(null)
  const [routeStart, setRouteStart] = useState<{ id: string; position: LatLon | null } | null>(null)
  const [visitNotice, setVisitNotice] = useState<{ id: string; key: number } | null>(null)
  const arrival = useRef<ArrivalState>({ candidateId: null, since: 0, blocked: new Set() })
  const seenRef = useRef(seen)
  seenRef.current = seen
  const markVisited = useCallback((id: string) => {
    if (seenRef.current.has(id)) return
    const next = new Set(seenRef.current).add(id)
    seenRef.current = next
    setSeen(next)
    setVisitNotice({ id, key: Date.now() })
  }, [])
  const [focusSequence, setFocusSequence] = useState(0)
  const selectOnMap = useCallback((id: string) => {
    setActiveId(id)
    setFocusSequence((n) => n + 1)
  }, [])
  const [photo, setPhoto] = useState<File | null>(null)
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
    if (tab !== 'map' || !statues) {
      arrival.current = { ...arrival.current, candidateId: null, since: 0 }
      return
    }
    const check = () => {
      const result = updateArrival(statues, userPos, seenRef.current, arrival.current, Date.now())
      arrival.current = result.state
      if (result.visit) markVisited(result.visit)
    }
    check()
    // GPS fixes can be infrequent when standing still. Recheck the dwell time,
    // but updateArrival rejects a fix once it is too old or inaccurate.
    if (!arrival.current.candidateId) return
    const timer = window.setTimeout(check, Math.max(0, arrival.current.since + ARRIVAL_DWELL_MS - Date.now()))
    return () => window.clearTimeout(timer)
  }, [userPos, statues, seen, tab, markVisited])

  useEffect(() => {
    if (!visitNotice) return
    const timer = window.setTimeout(() => setVisitNotice(null), 12000)
    return () => window.clearTimeout(timer)
  }, [visitNotice])

  useEffect(() => {
    const hash = writeHash({ tab, route: routeId, statue: openId })
    if (hash !== location.hash) history.replaceState(null, '', hash || location.pathname)
  }, [tab, routeId, openId])

  /** A scan (NFC, a plaque link or the demo): open the statue and add it to the collection. */
  const collect = useCallback((id: string) => {
    markVisited(id)
    setActiveId(id)
    setOpenId(id)
    setJustCollected(id)
  }, [markVisited])

  // A plaque scanned while the app is already open arrives as a new hash.
  useEffect(() => {
    const onHash = () => {
      const place = readHash()
      setTab(place.tab)
      setRouteId(place.route)
      if (place.statue && place.tab === 'scan') collect(place.statue)
      else {
        setOpenId(place.statue)
        setActiveId(place.statue)
        setJustCollected(null)
      }
    }
    addEventListener('hashchange', onHash)
    return () => removeEventListener('hashchange', onHash)
  }, [collect])

  const theme = themes.find((th) => th.id === routeId) ?? null
  // Freeze the starting point for this walk so moving GPS fixes do not shuffle
  // its numbered stops. A walk chosen before GPS is available adopts the first fix.
  useEffect(() => {
    if (!routeId || !userPos) return
    setRouteStart((previous) => previous?.id === routeId && previous.position
      ? previous : { id: routeId, position: { lat: userPos.lat, lon: userPos.lon } })
  }, [routeId, userPos])
  const course = useMemo(() => (statues && theme ? buildCourse(theme.id, statues, routeStart?.id === theme.id ? routeStart.position : null) : null), [statues, theme, routeStart])
  const walking = useWalkingRoute(course)
  useEffect(() => {
    if (course?.controls.length) setActiveId(course.controls[0].id)
  }, [course])

  // What the map cards show: the route in walking order, or every statue nearest first.
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

  const open = statues?.find((s) => s.id === openId) ?? null
  // In the story, next/previous follow the map's list; elsewhere, nearest first.
  const storyList = items

  const openStatue = useCallback((id: string) => {
    setActiveId(id)
    setOpenId(id)
    setJustCollected(null)
  }, [])

  const demoScan = () => {
    if (!statues) return
    const good = statues.filter((s) => s.image && (s.wiki_mk || s.wiki_en))
    const fresh = good.filter((s) => !seen.has(s.id))
    const pool = fresh.length ? fresh : good
    collect(pool[Math.floor(Math.random() * pool.length)].id)
  }

  const chooseRoute = (id: string | null) => {
    if (id === routeId) return
    setRouteId(id)
    setRouteStart(id ? { id, position: userPos ? { lat: userPos.lat, lon: userPos.lon } : null } : null)
    setActiveId(null)
  }

  const closeDetail = useCallback(() => {
    setOpenId(null)
    setJustCollected(null)
  }, [])

  const unvisit = (id: string) => {
    arrival.current.blocked.add(id)
    const next = new Set(seenRef.current)
    next.delete(id)
    seenRef.current = next
    setSeen(next)
    setVisitNotice(null)
  }
  const toggleSeen = (id: string) => seen.has(id) ? unvisit(id) : markVisited(id)

  // Keep the active route chip in view on narrow screens.
  useEffect(() => {
    topRef.current?.querySelector('.chips [aria-pressed="true"]')?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' })
  }, [routeId, themes.length, lang, tab])

  // The map pads around what floats over it: search and chips on top, cards and tab bar below.
  useLayoutEffect(() => {
    const measure = () => {
      if (!topRef.current || !bottomRef.current) return
      setInsets({
        top: topRef.current.getBoundingClientRect().bottom,
        bottom: window.innerHeight - bottomRef.current.getBoundingClientRect().top,
      })
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (topRef.current) ro.observe(topRef.current)
    if (bottomRef.current) ro.observe(bottomRef.current)
    addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      removeEventListener('resize', measure)
    }
  }, [statues, tab])

  return (
    <div className="app" data-tab={tab} style={{ '--top-h': `${insets.top}px`, '--bottom-h': `${insets.bottom}px` } as React.CSSProperties}>
      <div className="screen screen--map" aria-hidden={tab !== 'map'}>
        <MapView
          enabled={tab === 'map'}
          focusSequence={focusSequence}
          statues={course ? items : statues ?? []}
          course={course}
          walkingRoute={walking.route}
          activeId={activeId}
          seen={seen}
          lang={lang}
          insets={insets}
          onSelect={selectOnMap}
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
            <MapDiscovery
              statues={statues}
              themes={themes}
              course={course}
              walking={walking}
              items={items}
              activeId={activeId}
              lang={lang}
              numbers={numbers}
              userPos={userPos}
              seen={seen}
              onSelect={selectOnMap}
              onOpen={openStatue}
              onRoute={chooseRoute}
            />
          )}
        </div>
      </div>

      {tab === 'scan' && (
        <div className="screen screen--page">
          <ScanPage
            lang={lang}
            onLang={setLang}
            seenCount={seen.size}
            total={statues?.length ?? 0}
            onStatue={collect}
            onPhoto={setPhoto}
            onDemo={demoScan}
            onOpenMap={() => setTab('map')}
          />
        </div>
      )}

      {tab === 'collection' && (
        <div className="screen screen--page">
          <CollectionPage
            statues={statues ?? []}
            themes={themes}
            seen={seen}
            lang={lang}
            onLang={setLang}
            onOpen={openStatue}
            onScan={() => setTab('scan')}
          />
        </div>
      )}

      <BottomNav tab={tab} lang={lang} seenCount={seen.size} onTab={setTab} />

      {visitNotice && <div className="visit-toast" key={visitNotice.key}>
        <Check size={22} aria-hidden />
        <div role="status"><strong>{t('markedVisited', lang)}</strong><span>{statues?.find((s) => s.id === visitNotice.id) ? statueName(statues.find((s) => s.id === visitNotice.id)!, lang) : t('visited', lang)}</span></div>
        <button type="button" onClick={() => unvisit(visitNotice.id)}>{t('undo', lang)}</button>
        <button type="button" aria-label={t('close', lang)} onClick={() => setVisitNotice(null)}><X size={18} /></button>
      </div>}

      {photo && statues && (
        <PhotoMatch
          photo={photo}
          statues={statues}
          near={userPos}
          lang={lang}
          onPick={(id) => {
            setPhoto(null)
            collect(id)
          }}
          onRetake={() => {
            setPhoto(null)
            document.querySelector<HTMLInputElement>('.scan input[type=file]')?.click()
          }}
          onClose={() => setPhoto(null)}
        />
      )}

      {open && (
        <StatueDetail
          statue={open}
          lang={lang}
          themes={themes}
          list={storyList}
          numbers={tab === 'map' ? numbers : null}
          userPos={userPos}
          seen={seen.has(open.id)}
          collected={justCollected === open.id}
          onToggleSeen={() => toggleSeen(open.id)}
          onNavigate={openStatue}
          onClose={closeDetail}
        />
      )}
    </div>
  )
}
