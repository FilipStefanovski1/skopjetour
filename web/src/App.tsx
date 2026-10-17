import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { buildCourse, CITY_CENTRE, metresBetween } from './course'
import { loadStatues, loadThemes } from './data'
import { t } from './i18n'
import type { Lang, Statue, Theme } from './types'
import { MapView, type Insets, type LatLon } from './components/MapView'
import { NavBanner, NavPanel, type NavStatus } from './components/Navigation'
import { fetchRoute, progress as routeProgress, type Route } from './directions'
import { enableCompass, locationErrorText, useCompass, useDemoLocation, useLiveLocation } from './location'
import { statueName } from './types'
import { Check, X } from 'lucide-react'
import { MapDiscovery } from './components/MapDiscovery'
import { useWalkingRoute } from './useWalkingRoute'
import { SearchBar } from './components/SearchBar'
import { StatueDetail } from './components/StatueDetail'
import { BottomNav, type Tab } from './components/BottomNav'
import { ScanPage } from './components/ScanPage'
import { CollectionPage } from './components/CollectionPage'
import { PhotoMatch } from './components/PhotoMatch'
import { loadMyPhotos, saveMyPhoto } from './myPhotos'

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
  /** Arrived from a plaque's NFC tag: the visitor is standing at the statue. */
  tagged?: boolean
}

/**
 * `#/map`, `#/collection`, `#/route/<theme>` and `#/s/<statue>`, which only opens a statue.
 * A plaque's NFC tag holds `#/tag/<statue>`: opening that is a scan, so it collects the statue.
 */
function readHash(): Place {
  const h = location.hash
  const route = h.match(/#\/(?:map\/)?route\/([^/]+)/)
  const statue = h.match(/\/(s|tag)\/([^/?#]+)/)
  const tab: Tab = h.startsWith('#/collection') ? 'collection' : h.startsWith('#/map') || route ? 'map' : 'scan'
  return {
    tab,
    route: route ? decodeURIComponent(route[1]) : null,
    statue: statue ? decodeURIComponent(statue[2]) : null,
    tagged: statue?.[1] === 'tag',
  }
}

/** Once a tag's scan is counted, its address becomes a plain link, so a reload isn't another scan. */
function forgetTag() {
  if (location.hash.includes('/tag/')) history.replaceState(null, '', location.hash.replace('/tag/', '/s/'))
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
  const initial = useMemo(() => {
    const place = readHash()
    forgetTag()
    return place
  }, [])
  const [statues, setStatues] = useState<Statue[] | null>(null)
  const [themes, setThemes] = useState<Theme[]>([])
  const [failed, setFailed] = useState(false)
  const [lang, setLang] = useState<Lang>(() => (stored<string>('lang', 'mk') === 'en' ? 'en' : 'mk'))
  const [tab, setTab] = useState<Tab>(initial.tab)
  const [routeId, setRouteId] = useState<string | null>(initial.route)
  const [activeId, setActiveId] = useState<string | null>(initial.statue)
  const [openId, setOpenId] = useState<string | null>(initial.statue)
  const [justCollected, setJustCollected] = useState<string | null>(initial.tagged ? initial.statue : null)
  // Visits come from a scan, a photo, or a nearby GPS arrival with Undo.
  const [seen, setSeen] = useState<Set<string>>(() => {
    const s = new Set(stored<string[]>('seen', []))
    if (initial.tagged && initial.statue) s.add(initial.statue)
    return s
  })
  // Live location: on while the visitor asked "where am I" or is walking somewhere.
  const [locating, setLocating] = useState(false)
  const [navTo, setNavTo] = useState<string | null>(null)
  const [route, setRoute] = useState<Route | null>(null)
  const [routeFailed, setRouteFailed] = useState(false)
  const [follow, setFollow] = useState(true)
  // On stage, far from the statues, a pretend position on Macedonia Square (also `?demo` in the link).
  const [demoLoc, setDemoLoc] = useState(() => new URLSearchParams(location.search).has('demo') || stored('demoLocation', false))
  const [locationAttempt, setLocationAttempt] = useState(0)
  const live = useLiveLocation(tab === 'map' && (locating || navTo !== null) && !demoLoc, locationAttempt)
  const compass = useCompass()
  const target = statues?.find((s) => s.id === navTo) ?? null
  // The demo walker follows the route, then steps up to the statue itself.
  const demoPath = useMemo<[number, number][] | null>(() => (route && target ? [...route.line, [target.lon, target.lat]] : null), [route]) // eslint-disable-line react-hooks/exhaustive-deps
  const demoFix = useDemoLocation(demoLoc, demoPath)
  const fix = demoLoc ? demoFix : live.fix
  const locationError = demoLoc ? null : live.error
  const userPos = fix
  const [routeStart, setRouteStart] = useState<{ id: string; position: LatLon | null } | null>(null)
  const [focusSequence, setFocusSequence] = useState(0)
  const selectOnMap = useCallback((id: string) => {
    setFollow(false)
    setActiveId(id)
    setFocusSequence((n) => n + 1)
  }, [])
  const [photo, setPhoto] = useState<File | null>(null)
  // Photos the visitor took to collect statues: their own picture on those tiles.
  const [myPhotos, setMyPhotos] = useState<Record<string, string>>(loadMyPhotos)
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
  useEffect(() => store('demoLocation', demoLoc), [demoLoc])

  useEffect(() => {
    const hash = writeHash({ tab, route: routeId, statue: openId })
    if (hash !== location.hash) history.replaceState(null, '', hash || location.pathname)
  }, [tab, routeId, openId])

  /** A scan (NFC, a plaque's link, a photo or the demo): open the statue and add it to the collection. */
  // Only these collect a statue; being near it on the map does not.
  const collect = useCallback((id: string) => {
    setSeen((prev) => (prev.has(id) ? prev : new Set(prev).add(id)))
    setActiveId(id)
    setOpenId(id)
    setJustCollected(id)
  }, [])

  // A plaque scanned while the app is already open arrives as a new hash.
  useEffect(() => {
    const onHash = () => {
      const place = readHash()
      setTab(place.tab)
      setRouteId(place.route)
      if (place.statue && place.tagged) {
        forgetTag()
        collect(place.statue)
      } else {
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
    if (!navTo && course?.controls.length) setActiveId(course.controls[0].id)
  }, [course, navTo])

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

  // ---------------------------------------------------------------- walking directions

  /** Directions to a statue: off to the map, following the visitor along a walking route. */
  const startDirections = (id: string) => {
    enableCompass() // iPhones only allow this during a tap
    setNavTo(id)
    setRoute(null)
    setRouteFailed(false)
    setFollow(true)
    setActiveId(id)
    setOpenId(null)
    setTab('map')
  }

  const endDirections = () => {
    setNavTo(null)
    setRoute(null)
    setRouteFailed(false)
  }

  const prog = useMemo(() => (route && fix ? routeProgress(route, fix) : null), [route, fix])
  const arrived = Boolean(target && fix && metresBetween(fix, target) < 25)

  // Fetch the route once a position is known, and again if the walker strays well off it.
  const lastFetch = useRef(0)
  const fetching = useRef(false)
  useEffect(() => {
    if (!target || !fix || arrived || fetching.current) return
    const stray = prog ? prog.off > Math.max(40, fix.accuracy) : false
    if (route && !stray) return
    if (route && Date.now() - lastFetch.current < 15000) return
    fetching.current = true
    lastFetch.current = Date.now()
    const ctrl = new AbortController()
    fetchRoute(fix, target, ctrl.signal)
      .then((r) => {
        setRoute(r)
        setRouteFailed(false)
      })
      .catch(() => !ctrl.signal.aborted && setRouteFailed(true))
      .finally(() => (fetching.current = false))
    return () => ctrl.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, fix, prog?.off, arrived])

  const navStatus: NavStatus = arrived ? 'arrived' : !fix ? 'locating' : routeFailed ? 'error' : route ? 'ready' : 'routing'
  const heading = compass ?? fix?.course ?? null
  const mapUser = useMemo(() => fix ? { ...fix, heading } : null, [fix, heading])
  const following = (locating || Boolean(target) || demoLoc) && follow
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
    setFollow(false)
    setRouteId(id)
    setRouteStart(id ? { id, position: userPos ? { lat: userPos.lat, lon: userPos.lon } : null } : null)
    setActiveId(null)
  }

  const closeDetail = useCallback(() => {
    setOpenId(null)
    setJustCollected(null)
  }, [])

  // One camera for the whole app: a photo from the story, or another try after a poor match.
  const camera = useRef<HTMLInputElement>(null)
  const snap = () => {
    camera.current?.click()
    import('./recognize').then((m) => m.loadRecognizer()).catch(() => {})
  }

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
          statues={target ? statues ?? [] : course ? items : statues ?? []}
          course={target ? null : course}
          walkingRoute={target ? null : walking.route}
          activeId={activeId}
          seen={seen}
          lang={lang}
          insets={insets}
          onSelect={selectOnMap}
          user={mapUser}
          navLine={target ? route?.line ?? null : null}
          follow={following}
          locating={(locating || Boolean(target)) && !fix && !locationError}
          onUserPan={() => setFollow(false)}
          onLocate={() => {
            if (following && !locationError) {
              setFollow(false)
              if (!target) setLocating(false)
            } else {
              enableCompass()
              setLocating(true)
              setFollow(true)
              if (locationError) setLocationAttempt(n => n + 1)
            }
          }}
          locateError={locating && !target && locationError ? t(locationErrorText(locationError), lang) : null}
          demo={demoLoc}
          onDemo={(on) => {
            setDemoLoc(on)
            setFollow(on)
            setRouteStart(null)
            setRoute(null) // routes are planned again from wherever the visitor now is
          }}
        />

        <header ref={topRef} className={`top${target ? ' top--nav' : ''}`}>
          {target ? (
            <NavBanner lang={lang} status={navStatus} locationError={locationError} progress={prog} destination={statueName(target, lang)} />
          ) : (
          <>
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
          </>
          )}
        </header>

        <div ref={bottomRef} className="bottom">
          {target ? (
            <NavPanel
              lang={lang}
              target={target}
              status={navStatus}
              route={route}
              progress={prog}
              following={follow}
              onDemo={locationError ? () => setDemoLoc(true) : null}
              onRecenter={() => setFollow(true)}
              onEnd={endDirections}
              onOpenStory={() => {
                const id = target.id
                endDirections()
                openStatue(id)
              }}
            />
          ) : failed ? (
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
            myPhotos={myPhotos}
            lang={lang}
            onLang={setLang}
            onOpen={openStatue}
            onScan={() => setTab('scan')}
          />
        </div>
      )}

      <BottomNav tab={tab} lang={lang} seenCount={seen.size} onTab={setTab} />

      <input
        ref={camera}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) setPhoto(file)
        }}
      />

      {photo && statues && (
        <PhotoMatch
          photo={photo}
          statues={statues}
          near={userPos}
          lang={lang}
          onPick={(id) => {
            const taken = photo
            setPhoto(null)
            collect(id)
            saveMyPhoto(id, taken).then((url) => url && setMyPhotos((prev) => ({ ...prev, [id]: url })))
          }}
          onRetake={() => {
            setPhoto(null)
            snap()
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
          myPhoto={myPhotos[open.id]}
          collected={justCollected === open.id}
          onSnap={snap}
          onNavigate={openStatue}
          onDirections={() => startDirections(open.id)}
          onClose={closeDetail}
        />
      )}
    </div>
  )
}
