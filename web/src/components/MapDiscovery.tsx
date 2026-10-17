import { useMemo, useState } from 'react'
import { Check, ChevronRight, CircleAlert, Footprints, List, LoaderCircle, MapPin, X } from 'lucide-react'
import { buildCourse, CITY_CENTRE, formatDistance, metresBetween, nearbyStatues, nextStop } from '../course'
import type { Course } from '../course'
import { photoUrl } from '../data'
import { t } from '../i18n'
import type { Lang, Statue, Theme } from '../types'
import { coverFile, statueName, themeName } from '../types'
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
  const walkTheme = course ? themes.find((th) => th.id === course.id) : undefined
  const walkName = walkTheme ? themeName(walkTheme, lang) : null
  const routeNotice = course && (walking.status === 'loading' ? 'walkLoading' : walking.status === 'error' ? 'walkRoutingError' : routed?.originUnavailable ? 'walkOriginUnavailable' : !routed?.complete ? 'walkPartial' : null)

  return <>
    <section className="discovery" aria-label={t('nearby', lang)}>
      <div className="discovery__toolbar">
        <button type="button" aria-expanded={panel === 'nearby'} aria-controls="map-discovery-panel" onClick={() => setPanel(panel === 'nearby' ? null : 'nearby')}>
          <List size={17} aria-hidden />{t('nearby', lang)}
        </button>
        <button type="button" className={course ? 'discovery__active-walk' : undefined} aria-label={`${t('themedWalks', lang)}${walkName ? `: ${walkName}, ${t('walkProgress', lang, { n: completed, m: course!.controls.length })}` : ''}${routeNotice ? `. ${t(routeNotice, lang)}` : ''}`} aria-expanded={panel === 'walks'} aria-controls="map-discovery-panel" onClick={() => setPanel(panel === 'walks' ? null : 'walks')}>
          {routeNotice ? (walking.status === 'loading' ? <LoaderCircle size={17} aria-hidden /> : <CircleAlert size={17} aria-hidden />) : <Footprints size={17} aria-hidden />}
          <span>{walkName ?? t('walksShort', lang)}</span>
          {course && <small aria-hidden>{completed}/{course.controls.length}</small>}
        </button>
        {next && <button type="button" className="discovery__next-shortcut" title={`${t('nextStop', lang)}: ${statueName(next, lang)}`} aria-label={`${t('nextStop', lang)}: ${statueName(next, lang)}${userPos ? `, ${formatDistance(metresBetween(userPos, next))}` : ''}`} onClick={() => show(next.id)}><MapPin size={19} aria-hidden /><ChevronRight size={13} aria-hidden /></button>}
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
                <span><strong>{statueName(s, lang)}</strong><small>{userPos && <>{formatDistance(metresBetween(userPos, s))} · </>}{seen.has(s.id) ? <><Check size={12} aria-hidden /> {t('visited', lang)}</> : t('unvisited', lang)}</small></span>
              </button>
              <button type="button" className="discovery__map" onClick={() => show(s.id)} aria-label={`${t('showOnMap', lang)}: ${statueName(s, lang)}`}><MapPin size={19} /></button>
            </li>)}
          </ul>
          {!discovered.length && <p className="discovery__hint">{t('noNearby', lang)}</p>}
        </> : <>
          {course && <div className="discovery__walk-summary">
            <div><strong>{walkName}</strong><small>{t('walkProgress', lang, { n: completed, m: course.controls.length })}{routed?.complete && <> · {formatDistance(routed.metres)} · ≈{t('minWalking', lang, { m: routed.minutes })}</>}</small></div>
            <button type="button" className="discovery__end-walk" onClick={() => { onRoute(null); setPanel(null) }}>{t('endWalk', lang)}</button>
            <progress value={completed} max={course.controls.length || 1} aria-label={t('walkProgress', lang, { n: completed, m: course.controls.length })} />
            <p className="discovery__start-hint">{t(routed?.originUnavailable ? 'walkOriginUnavailable' : course.origin ? 'walkFromYou' : 'walkNeedsLocation', lang)}</p>
            <small role="status">{t(walking.status === 'loading' ? 'walkLoading' : walking.status === 'error' ? 'walkRoutingError' : !routed?.complete ? 'walkPartial' : 'walkRouted', lang)}</small>
            {walking.status === 'error' && <button type="button" className="discovery__retry" onClick={walking.retry}>{t('retry', lang)}</button>}
            {course.beyond.length > 0 && <small>{t('outsideWalk', lang, { n: course.beyond.length })}</small>}
          </div>}
          <p className="discovery__hint">{t('walkEstimate', lang)}</p>
          <ul className="discovery__walks">
            {walks.filter(({ walk }) => walk.controls.length > 0).map(({ theme, walk }) => <li key={theme.id}>
              <button type="button" aria-pressed={course?.id === theme.id} aria-label={`${t('startWalk', lang)}: ${themeName(theme, lang)}`} onClick={() => { onRoute(theme.id); setPanel(null) }}>
                <Footprints size={22} aria-hidden /><span><strong>{themeName(theme, lang)}</strong><small>{t('walkStats', lang, { n: walk.controls.length, m: walk.minutes })} · ≈{formatDistance(walk.metres)}</small><small>{t('walkProgress', lang, { n: walk.controls.filter((s) => seen.has(s.id)).length, m: walk.controls.length })}</small></span><ChevronRight size={18} aria-hidden />
              </button>
            </li>)}
          </ul>
        </>}
      </div> : !next && <p className="discovery__complete" role="status"><Check size={18} aria-hidden />{t(course ? 'walkComplete' : 'allVisited', lang)}</p>}
    </section>
    {!panel && <Carousel items={items} activeId={activeId} lang={lang} numbers={numbers} userPos={userPos} seen={seen} onActive={onSelect} onOpen={onOpen} />}
  </>
}
