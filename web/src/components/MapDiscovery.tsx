import { useMemo, useState } from 'react'
import { Check, ChevronRight, Footprints, List, MapPin, X } from 'lucide-react'
import { buildCourse, CITY_CENTRE, formatDistance, metresBetween, nearbyStatues, nextStop } from '../course'
import type { Course } from '../course'
import { photoUrl } from '../data'
import { t } from '../i18n'
import type { Lang, Statue, Theme } from '../types'
import { coverFile, statueName } from '../types'
import type { LatLon } from './MapView'
import { StatueGlyph } from './StatueGlyph'
import { Carousel } from './Carousel'
import type { RouteState } from '../useWalkingRoute'

interface Props {
  statues: Statue[]
  items: Statue[]
  themes: Theme[]
  course: Course | null
  walking: RouteState & { retry: () => void }
  lang: Lang
  seen: Set<string>
  userPos: LatLon | null
  activeId: string | null
  numbers: Map<string, number> | null
  onSelect: (id: string) => void
  onOpen: (id: string) => void
  onRoute: (id: string | null) => void
}

export function MapDiscovery({ statues, items, themes, course, walking, lang, seen, userPos, activeId, numbers, onSelect, onOpen, onRoute }: Props) {
  const [panel, setPanel] = useState<'nearby' | 'walks' | null>(null)
  const [onlyUnvisited, setOnlyUnvisited] = useState(false)
  const origin = userPos ?? { lat: CITY_CENTRE[0], lon: CITY_CENTRE[1] }
  const nearby = useMemo(() => nearbyStatues(items, origin), [items, origin.lat, origin.lon])
  const walks = useMemo(() => themes.map((theme) => ({ theme, walk: buildCourse(theme.id, statues, userPos) })), [themes, statues, userPos])
  const next = nextStop(nearby, seen, course)
  const discovered = nearby.filter((s) => !onlyUnvisited || !seen.has(s.id))
  const completed = course?.controls.filter((s) => seen.has(s.id)).length ?? 0
  const show = (id: string) => { onSelect(id); setPanel(null) }
  const routed = walking.route

  return <>
    <section className="discovery" aria-label={t('nearby', lang)}>
      <div className="discovery__toolbar">
        <button type="button" aria-expanded={panel === 'nearby'} aria-controls="map-discovery-panel" onClick={() => setPanel(panel === 'nearby' ? null : 'nearby')}>
          <List size={17} aria-hidden />{t('nearby', lang)}
        </button>
        <button type="button" aria-expanded={panel === 'walks'} aria-controls="map-discovery-panel" onClick={() => setPanel(panel === 'walks' ? null : 'walks')}>
          <Footprints size={17} aria-hidden />{t('themedWalks', lang)}
        </button>
      </div>
      {panel ? <div id="map-discovery-panel" className="discovery__panel">
        <div className="discovery__heading">
          <h2>{t(panel === 'nearby' ? 'nearby' : 'themedWalks', lang)}</h2>
          <button type="button" className="discovery__close" aria-label={t('close', lang)} onClick={() => setPanel(null)}><X size={20} /></button>
        </div>
        {panel === 'nearby' ? <>
          <p className="discovery__hint">{t(userPos ? 'straightDistances' : 'centreDistances', lang)}</p>
          <div className="discovery__filters">
            <button type="button" aria-pressed={!onlyUnvisited} onClick={() => setOnlyUnvisited(false)}>{t('all', lang)}</button>
            <button type="button" aria-pressed={onlyUnvisited} onClick={() => setOnlyUnvisited(true)}>{t('unvisited', lang)}</button>
          </div>
          <ul className="discovery__list">
            {discovered.map((s) => <li key={s.id} className={s.id === activeId ? 'is-selected' : ''}>
              <button type="button" className="discovery__place" onClick={() => onOpen(s.id)}>
                <span className="discovery__photo">{coverFile(s) ? <img src={photoUrl(coverFile(s)!, 120)} alt="" loading="lazy" /> : <StatueGlyph />}</span>
                <span><strong>{statueName(s, lang)}</strong><small>{formatDistance(metresBetween(origin, s))} · {seen.has(s.id) ? <><Check size={12} aria-hidden /> {t('visited', lang)}</> : t('unvisited', lang)}</small></span>
              </button>
              <button type="button" className="discovery__map" onClick={() => show(s.id)} aria-label={`${t('showOnMap', lang)}: ${statueName(s, lang)}`}><MapPin size={19} /></button>
            </li>)}
          </ul>
          {!discovered.length && <p className="discovery__hint">{t('noNearby', lang)}</p>}
        </> : <>
          <p className="discovery__hint">{t('walkEstimate', lang)}</p>
          <ul className="discovery__walks">
            {walks.filter(({ walk }) => walk.controls.length > 0).map(({ theme, walk }) => <li key={theme.id}>
              <button type="button" aria-pressed={course?.id === theme.id} aria-label={`${t('startWalk', lang)}: ${theme[lang]}`} onClick={() => { onRoute(theme.id); setPanel(null) }}>
                <Footprints size={22} aria-hidden /><span><strong>{theme[lang]}</strong><small>{t('walkStats', lang, { n: walk.controls.length, m: walk.minutes })} · ≈{formatDistance(walk.metres)}</small><small>{t('walkProgress', lang, { n: walk.controls.filter((s) => seen.has(s.id)).length, m: walk.controls.length })}</small></span><ChevronRight size={18} aria-hidden />
              </button>
            </li>)}
          </ul>
        </>}
      </div> : <>
        {course && <div className="discovery__walk-summary">
          <div><strong>{themes.find((th) => th.id === course.id)?.[lang]}</strong><small>{t('walkProgress', lang, { n: completed, m: course.controls.length })}{routed?.complete && <> · {formatDistance(routed.metres)} · ≈{routed.minutes} {lang === 'en' ? 'min walking' : 'мин пешачење'}</>}</small></div>
          <button type="button" className="discovery__close" onClick={() => onRoute(null)} aria-label={t('endWalk', lang)}><X size={18} /></button>
          <progress value={completed} max={course.controls.length || 1} aria-label={t('walkProgress', lang, { n: completed, m: course.controls.length })} />
          <p className="discovery__start-hint">{t(routed?.originUnavailable ? 'walkOriginUnavailable' : course.origin ? 'walkFromYou' : 'walkNeedsLocation', lang)}</p>
          <small className={`discovery__route-note${walking.status !== 'ready' || !routed?.complete ? ' is-important' : ''}`} role="status">{t(walking.status === 'loading' ? 'walkLoading' : walking.status === 'error' ? 'walkRoutingError' : !routed?.complete ? 'walkPartial' : 'walkRouted', lang)}</small>
          {walking.status === 'error' && <button type="button" onClick={walking.retry}>{t('retry', lang)}</button>}
          {course.beyond.length > 0 && <small>{t('outsideWalk', lang, { n: course.beyond.length })}</small>}
        </div>}
        {next ? <button type="button" className="discovery__next" onClick={() => show(next.id)}>
          <MapPin size={21} aria-hidden />
          <span><small>{t('nextStop', lang)} · {formatDistance(metresBetween(origin, next))}</small><strong>{statueName(next, lang)}</strong><small>{t(course ? 'nextOnWalk' : userPos ? 'nearestUnvisited' : 'centreNext', lang)}</small></span>
          <ChevronRight size={20} aria-hidden />
        </button> : <p className="discovery__complete"><Check size={18} aria-hidden />{t(course ? 'walkComplete' : 'allVisited', lang)}</p>}
      </>}
    </section>
    {!panel && <Carousel items={items} activeId={activeId} lang={lang} numbers={numbers} userPos={userPos} seen={seen} onActive={onSelect} onOpen={onOpen} />}
  </>
}
