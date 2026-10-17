import { useEffect, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import type { GeoJSONSource, Map as MLMap } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { LocateFixed, MapPin, X } from 'lucide-react'
import type { Course } from '../course'
import { CITY_CENTRE, metresBetween } from '../course'
import type { WalkingRoute } from '../walking'
import { photoUrl } from '../data'
import { t } from '../i18n'
import { LABEL_LAYERS, cityStyle, labelField } from '../map/style'
import type { Lang, Statue } from '../types'
import { coverFile, statueName } from '../types'

// Vite moves MapLibre's code during bundling, so point it at its worker explicitly.
maplibregl.setWorkerUrl(workerUrl)

const ACCENT = '#2f4550'

export interface Insets {
  top: number
  bottom: number
}

export interface LatLon {
  lat: number
  lon: number
}

interface Props {
  enabled: boolean
  focusSequence: number
  statues: Statue[]
  course: Course | null
  walkingRoute: WalkingRoute | null
  activeId: string | null
  seen: Set<string>
  lang: Lang
  insets: Insets
  onSelect: (id: string) => void
  /** The visitor's live position and the way they face. */
  user: (LatLon & { heading: number | null; accuracy: number }) | null
  /** The walking route being followed, as [lon, lat] pairs. */
  navLine: [number, number][] | null
  /** Keep the camera on the visitor while they walk. */
  follow: boolean
  locating: boolean
  onUserPan: () => void
  /** A tap on the map itself (not a pin): shows or hides the cards over it. */
  onMapTap: () => void
  onLocate: () => void
  locateError: string | null
  /** Pretending to stand on Macedonia Square, for demos away from the statues. */
  demo: boolean
  onDemo: (on: boolean) => void
}

const STATUE_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="6.2" r="2.6"/><path d="M8.6 20v-6.2c0-2.3 1.5-4.4 3.4-4.4s3.4 2.1 3.4 4.4V20z"/><path d="M6.5 20h11v1.6h-11z"/></svg>'

/** MapLibre positions the wrapper (absolute + transform); the visible pin lives inside it. */
function wrap(inner: HTMLElement): HTMLDivElement {
  const anchor = document.createElement('div')
  anchor.className = 'marker'
  anchor.appendChild(inner)
  return anchor
}

function pinElement(s: Statue, lang: Lang, onClick: () => void): HTMLButtonElement {
  const el = document.createElement('button')
  el.type = 'button'
  el.className = 'pin'
  el.setAttribute('aria-label', statueName(s, lang))
  const cover = coverFile(s)
  el.innerHTML = cover
    ? `<img src="${photoUrl(cover, 160)}" alt="" loading="lazy" decoding="async" draggable="false">`
    : `<span class="pin__blank">${STATUE_SVG}</span>`
  const badge = document.createElement('span')
  badge.className = 'pin__n'
  el.appendChild(badge)
  const tick = document.createElement('span')
  tick.className = 'pin__seen'
  tick.innerHTML = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 6.3l2.2 2.2 4.8-5"/></svg>'
  el.appendChild(tick)
  el.addEventListener('click', (e) => {
    e.stopPropagation()
    onClick()
  })
  return el
}

/** A group of nearby statues: one of their photos, with how many are there. */
function clusterElement(count: number, onClick: () => void): HTMLButtonElement {
  const el = document.createElement('button')
  el.type = 'button'
  el.className = 'cluster'
  el.innerHTML = `<span class="cluster__photo">${STATUE_SVG}</span><span class="cluster__n">${count}</span>`
  el.addEventListener('click', (e) => {
    e.stopPropagation()
    onClick()
  })
  return el
}

/** Statues closer than this to a neighbour need a very close zoom to tell apart (the Art Bridge). */
const CROWDED_M = 15

export function MapView({ enabled, focusSequence, walkingRoute, locating, statues, course, activeId, seen, lang, insets, onSelect, user, navLine, follow, onUserPan, onMapTap, onLocate, locateError, demo, onDemo }: Props) {
  const el = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MLMap | null>(null)
  const me = useRef<{ marker: maplibregl.Marker; el: HTMLDivElement } | null>(null)
  const flyToUser = useRef(false)
  const pins = useRef(new Map<string, { marker: maplibregl.Marker; el: HTMLButtonElement }>())
  const clusters = useRef(new Map<string, maplibregl.Marker>())
  const activePin = useRef<{ id: string; marker: maplibregl.Marker; el: HTMLButtonElement } | null>(null)
  /** A new route shows its whole length first; the first stop is selected without zooming to it. */
  const keepOverview = useRef(false)
  const byId = useRef(new Map<string, Statue>())
  const [ready, setReady] = useState(false)
  const cb = useRef({ onSelect, onUserPan, onMapTap })
  cb.current = { onSelect, onUserPan, onMapTap }
  const insetsRef = useRef(insets)
  insetsRef.current = insets
  const state = useRef({ activeId, seen, course, lang })
  state.current = { activeId, seen, course, lang }

  const padding = () => {
    const container = mapRef.current?.getContainer()
    const height = container?.clientHeight ?? window.innerHeight
    const width = container?.clientWidth ?? window.innerWidth
    const top = insetsRef.current.top + 36
    const bottom = insetsRef.current.bottom + 36
    // Keep a usable camera viewport even when panels fill a short phone screen.
    const scale = Math.min(1, Math.max(0, height - 120) / (top + bottom))
    const side = Math.min(56, Math.max(0, (width - 120) / 2))
    return { top: top * scale, bottom: bottom * scale, left: side, right: side }
  }

  /** Paint each pin's state: active, seen, route number. */
  const paintPins = () => {
    const { activeId: active, seen: seenSet, course: c } = state.current
    const order = new Map(c?.controls.map((s, i) => [s.id, i + 1]))
    const all = [...pins.current]
    if (activePin.current) all.push([activePin.current.id, activePin.current])
    for (const [id, { el: node, marker }] of all) {
      const n = order.get(id)
      node.classList.toggle('is-active', id === active)
      node.classList.toggle('is-seen', seenSet.has(id))
      const s = byId.current.get(id)
      if (s) node.setAttribute('aria-label', `${statueName(s, state.current.lang)} · ${t(seenSet.has(id) ? 'visited' : 'unvisited', state.current.lang)}`)
      node.querySelector<HTMLElement>('.pin__n')!.textContent = n ? String(n) : ''
      node.classList.toggle('has-n', Boolean(n))
      marker.getElement().style.zIndex = id === active ? '5' : n ? '2' : '1'
    }
  }

  // Map, once.
  useEffect(() => {
    if (!el.current) return
    const map = new maplibregl.Map({
      container: el.current,
      style: cityStyle(state.current.lang),
      center: [CITY_CENTRE[1], CITY_CENTRE[0]],
      zoom: 15.4,
      minZoom: 11,
      maxZoom: 20,
      attributionControl: { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
    })
    map.touchZoomRotate.disableRotation()
    // A drag or pinch by the visitor means "let me look around": stop following them.
    map.on('dragstart', () => cb.current.onUserPan())
    map.on('click', (e) => {
      // Pins and clusters are DOM markers over the canvas; their taps are their own.
      if ((e.originalEvent.target as Element | null)?.closest('.maplibregl-marker, button')) return
      cb.current.onMapTap()
    })

    // HTML photo pins for single statues and count bubbles for groups, rebuilt as the view changes.
    let queued = 0
    const syncMarkers = () => {
      if (queued) return
      queued = requestAnimationFrame(() => {
        queued = 0
        if (!map.getSource('statues') || !map.isSourceLoaded('statues')) return
        const seenPins = new Set<string>()
        const seenClusters = new Set<string>()
        for (const f of map.querySourceFeatures('statues')) {
          const coords = (f.geometry as GeoJSON.Point).coordinates as [number, number]
          const p = f.properties as Record<string, unknown>
          if (p.cluster) {
            // Cluster ids are reused when the data changes, so key by place and size.
            const key = `${coords[0].toFixed(6)},${coords[1].toFixed(6)},${p.point_count},${p.visited},${state.current.lang}`
            if (seenClusters.has(key)) continue
            seenClusters.add(key)
            if (!clusters.current.has(key)) {
              const clusterId = Number(p.cluster_id)
              const source = map.getSource('statues') as GeoJSONSource
              const node = clusterElement(Number(p.point_count), async () => {
                try {
                  const zoom = await source.getClusterExpansionZoom(clusterId)
                  if (mapRef.current === map) map.easeTo({ center: coords, zoom: zoom + 0.4, padding: padding() })
                } catch { /* The source can change while a cluster is being expanded. */ }
              })
              node.setAttribute('aria-label', t('clusterLabel', state.current.lang, { n: Number(p.point_count), m: Number(p.visited) }))
              node.classList.toggle('is-seen', Number(p.visited) === Number(p.point_count))
              if (Number(p.visited) > 0) {
                const visited = document.createElement('span')
                visited.className = 'cluster__visited'
                visited.textContent = `✓ ${p.visited}/${p.point_count}`
                node.appendChild(visited)
              }
              source
                .getClusterLeaves(clusterId, 12, 0)
                .then((leaves) => {
                  const members = leaves.map((l) => byId.current.get(String(l.properties?.id)))
                  // A statue's own photo on the cluster if any member has one, else a portrait.
                  const cover = members.find((x) => x?.image)?.image ?? members.map((x) => x && coverFile(x)).find(Boolean)
                  if (cover) node.querySelector('.cluster__photo')!.innerHTML = `<img src="${photoUrl(cover, 160)}" alt="" draggable="false">`
                })
                .catch(() => {})
              clusters.current.set(key, new maplibregl.Marker({ element: wrap(node) }).setLngLat(coords).addTo(map))
            }
          } else {
            const id = String(p.id)
            if (seenPins.has(id)) continue
            seenPins.add(id)
            const s = byId.current.get(id)
            if (s && !pins.current.has(id)) {
              const node = pinElement(s, state.current.lang, () => cb.current.onSelect(id))
              pins.current.set(id, { el: node, marker: new maplibregl.Marker({ element: wrap(node) }).setLngLat(coords).addTo(map) })
            }
          }
        }
        for (const [k, m] of clusters.current) if (!seenClusters.has(k)) (m.remove(), clusters.current.delete(k))
        for (const [k, m] of pins.current) if (!seenPins.has(k)) (m.marker.remove(), pins.current.delete(k))
        paintPins()
      })
    }

    map.on('load', () => {
      map.addSource('statues', { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, cluster: true, clusterRadius: 38, clusterMaxZoom: 16, clusterProperties: { visited: ['+', ['get', 'visited']] } })
      // An invisible layer, so MapLibre loads the statue tiles the HTML pins are read from.
      map.addLayer({ id: 'statues-anchor', type: 'circle', source: 'statues', paint: { 'circle-radius': 1, 'circle-opacity': 0 } })
      map.addSource('route', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({
        id: 'route', type: 'line', source: 'route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': ACCENT, 'line-width': ['interpolate', ['linear'], ['zoom'], 13, 2, 18, 4], 'line-dasharray': [0.1, 1.8], 'line-opacity': 0.9 },
      })
      map.addSource('nav', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({
        id: 'nav-casing', type: 'line', source: 'nav',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#ffffff', 'line-width': ['interpolate', ['linear'], ['zoom'], 13, 6, 18, 13] },
      })
      map.addLayer({
        id: 'nav', type: 'line', source: 'nav',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#2563eb', 'line-width': ['interpolate', ['linear'], ['zoom'], 13, 3.5, 18, 8] },
      })
      map.addSource('route-start', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'route-start', type: 'circle', source: 'route-start', paint: { 'circle-radius': 7, 'circle-color': ACCENT, 'circle-stroke-color': '#f4f4f9', 'circle-stroke-width': 3 } })
      map.addLayer({ id: 'route-start-label', type: 'symbol', source: 'route-start', layout: { 'text-field': t('walkStart', state.current.lang), 'text-font': ['Noto Sans Bold'], 'text-size': 12, 'text-anchor': 'top', 'text-offset': [0, 1.1] }, paint: { 'text-color': ACCENT, 'text-halo-color': '#f4f4f9', 'text-halo-width': 2 } })
      map.addSource('user-accuracy', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'user-accuracy', type: 'fill', source: 'user-accuracy', paint: { 'fill-color': '#586f7c', 'fill-opacity': 0.12, 'fill-outline-color': '#586f7c' } })
      map.on('render', syncMarkers)
      setReady(true)
    })
    if (import.meta.env.DEV) map.on('idle', () => el.current?.setAttribute('data-ready', '1'))

    const ro = new ResizeObserver(() => map.resize())
    ro.observe(el.current)
    mapRef.current = map
    const pinMap = pins.current
    const clusterMap = clusters.current
    return () => {
      ro.disconnect()
      pinMap.forEach((p) => p.marker.remove())
      pinMap.clear()
      clusterMap.forEach((m) => m.remove())
      clusterMap.clear()
      if (queued) cancelAnimationFrame(queued)
      activePin.current?.marker.remove()
      activePin.current = null
      me.current?.marker.remove()
      me.current = null
      map.remove()
      mapRef.current = null
      setReady(false)
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    for (const id of LABEL_LAYERS) map.setLayoutProperty(id, 'text-field', labelField(lang))
    map.setLayoutProperty('route-start-label', 'text-field', t('walkStart', lang))
    map.getCanvas().setAttribute('aria-label', t('map', lang))
    paintPins()
  }, [lang, ready])

  // The statues on the map: everything, or just the chosen route. The active one stands apart,
  // on its own pin, so it can never be swallowed by a group.
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    byId.current = new Map(statues.map((s) => [s.id, s]))
    for (const [id, p] of pins.current) if (!byId.current.has(id) || id === activeId) (p.marker.remove(), pins.current.delete(id))
    ;(map.getSource('statues') as GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: statues
        .filter((s) => s.id !== activeId)
        .map((s) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [s.lon, s.lat] }, properties: { id: s.id, visited: seen.has(s.id) ? 1 : 0 } })),
    })
    activePin.current?.marker.remove()
    activePin.current = null
    const a = activeId ? byId.current.get(activeId) : undefined
    if (a) {
      const node = pinElement(a, lang, () => cb.current.onSelect(a.id))
      activePin.current = { id: a.id, el: node, marker: new maplibregl.Marker({ element: wrap(node) }).setLngLat([a.lon, a.lat]).addTo(map) }
    }
    paintPins()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, statues, activeId, seen])

  // The route line, and fit the view to it when a route is chosen.
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    const lines = walkingRoute?.lines ?? []
    ;(map.getSource('route') as GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: lines.map(coordinates => ({ type: 'Feature', geometry: { type: 'LineString', coordinates }, properties: {} })),
    })
    ;(map.getSource('route-start') as GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: course?.origin && lines.length && !walkingRoute?.originUnavailable ? [{ type: 'Feature', geometry: { type: 'Point', coordinates: [course.origin.lon, course.origin.lat] }, properties: {} }] : [],
    })
    if (course?.controls.length) {
      keepOverview.current = true
      const bounds = new maplibregl.LngLatBounds()
      course.controls.forEach((point) => bounds.extend([point.lon, point.lat]))
      lines.flat().forEach((point) => bounds.extend(point))
      if (course.origin && walkingRoute && !walkingRoute.originUnavailable) bounds.extend([course.origin.lon, course.origin.lat])
      map.fitBounds(bounds, { padding: padding(), maxZoom: 17, duration: 700 })
    }
    // padding reads the latest insets through a ref
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, course, walkingRoute])

  useEffect(paintPins, [activeId, seen, course])

  // Bring the active statue into the clear part of the map.
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map || !activeId || navLine) return
    const s = byId.current.get(activeId) ?? statues.find((x) => x.id === activeId)
    if (!s) return
    if (keepOverview.current && course?.controls[0]?.id === activeId) {
      keepOverview.current = false
      return
    }
    keepOverview.current = false
    // On a route, packed stops (the Art Bridge) need a close zoom to tell neighbours apart;
    // otherwise the active statue has its own pin, so a street-level view is enough.
    const crowded = state.current.course && statues.some((o) => o.id !== s.id && metresBetween(o, s) < CROWDED_M)
    const zoom = crowded ? Math.max(map.getZoom(), 18.3) : Math.min(Math.max(map.getZoom(), 15.8), 17.2)
    map.easeTo({ center: [s.lon, s.lat], zoom, padding: padding(), duration: 550 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, activeId, focusSequence])

  // The visitor: a blue dot, with a cone showing the way they face.
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map || !enabled) return
    const ring = user && Number.isFinite(user.accuracy) ? Array.from({ length: 49 }, (_, i) => {
      const angle = i * Math.PI / 24
      return [user.lon + Math.cos(angle) * user.accuracy / (111320 * Math.cos(user.lat * Math.PI / 180)), user.lat + Math.sin(angle) * user.accuracy / 111320]
    }) : null
    ;(map.getSource('user-accuracy') as GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: ring ? [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } }] : [],
    })
    if (!user) {
      me.current?.marker.remove()
      me.current = null
      return
    }
    if (!me.current) {
      const node = document.createElement('div')
      node.className = 'me'
      node.setAttribute('role', 'img')
      node.setAttribute('aria-label', t('youAreHere', lang))
      node.innerHTML = '<span class="me__cone"></span><span class="me__pulse"></span><span class="me__dot"></span>'
      me.current = { el: node, marker: new maplibregl.Marker({ element: node }).setLngLat([user.lon, user.lat]).addTo(map) }
      node.style.zIndex = '20' // always above the statue pins
    }
    me.current.marker.setLngLat([user.lon, user.lat])
    me.current.el.setAttribute('aria-label', t('youAreHere', lang))
    me.current.el.classList.toggle('has-heading', user.heading != null)
    if (user.heading != null) me.current.el.style.setProperty('--heading', `${user.heading}deg`)
    if (flyToUser.current) {
      flyToUser.current = false
      map.easeTo({ center: [user.lon, user.lat], zoom: Math.max(map.getZoom(), 16.5), padding: padding(), duration: 700 })
    } else if (follow) {
      map.easeTo({ center: [user.lon, user.lat], padding: padding(), duration: 600 })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, enabled, user, follow])

  // The walking route: drawn, and framed once when it first appears.
  const framed = useRef<string | null>(null)
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    el.current?.classList.toggle('is-navigating', Boolean(navLine && navLine.length > 1))
    ;(map.getSource('nav') as GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: navLine && navLine.length > 1 ? [{ type: 'Feature', geometry: { type: 'LineString', coordinates: navLine }, properties: {} }] : [],
    })
    if (!navLine || navLine.length < 2) {
      framed.current = null
      return
    }
    const key = `${navLine[0]}|${navLine[navLine.length - 1]}`
    if (framed.current?.split('|')[1] === key.split('|')[1]) return // a reroute to the same place keeps the view
    framed.current = key
    const bounds = new maplibregl.LngLatBounds()
    navLine.forEach((c) => bounds.extend(c))
    map.fitBounds(bounds, { padding: padding(), maxZoom: 17.5, duration: 700 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, navLine])

  const locate = () => {
    flyToUser.current = !follow
    if (user && !follow) {
      flyToUser.current = false
      mapRef.current?.easeTo({ center: [user.lon, user.lat], zoom: Math.max(mapRef.current.getZoom(), 16.5), padding: padding(), duration: 700 })
    }
    onLocate()
  }

  return (
    <div className="map-wrap">
      <div ref={el} className="map" role="region" aria-label={t('map', lang)} />
      <div className="map-legend" aria-label={t('statues', lang)}><span><i />{t('unvisited', lang)}</span><span><i className="is-seen">✓</i>{t('visited', lang)}</span></div>
      <button type="button" className="locate" disabled={!ready || locating} onClick={locate} aria-pressed={follow} aria-label={t(follow ? 'stopFollowing' : 'followMe', lang)}>
        <LocateFixed aria-hidden size={20} strokeWidth={2.2} />
        <span>{t(locating ? 'locating' : follow ? 'following' : 'followMe', lang)}</span>
      </button>
      {locateError ? (
        <div className="map-toast" role="status">
          <p>{locateError}</p>
          <button type="button" onClick={() => onDemo(true)}>
            <MapPin aria-hidden size={16} strokeWidth={2.4} />
            {t('useDemoLocation', lang)}
          </button>
        </div>
      ) : (
        demo && (
          <button type="button" className="demo-pill" onClick={() => onDemo(false)} aria-label={t('demoLocationOff', lang)}>
            {t('demoLocationOn', lang)}
            <X aria-hidden size={15} strokeWidth={2.6} />
          </button>
        )
      )}
    </div>
  )
}
