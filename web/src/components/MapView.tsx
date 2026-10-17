import { useEffect, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import type { GeoJSONSource, Map as MLMap } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { LocateFixed } from 'lucide-react'
import type { Course, LocationFix } from '../course'
import { CITY_CENTRE, metresBetween } from '../course'
import type { WalkingRoute } from '../walking'
import { photoUrl } from '../data'
import { t, type StringKey } from '../i18n'
import { LABEL_LAYERS, cityStyle, labelField } from '../map/style'
import type { Lang, Statue } from '../types'
import { statueName } from '../types'

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
  onUserPosition: (p: LocationFix | null) => void
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
  el.innerHTML = s.image
    ? `<img src="${photoUrl(s.image, 160)}" alt="" loading="lazy" decoding="async" draggable="false">`
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

export function MapView({ enabled, focusSequence, statues, course, walkingRoute, activeId, seen, lang, insets, onSelect, onUserPosition }: Props) {
  const el = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MLMap | null>(null)
  const geolocate = useRef<maplibregl.GeolocateControl | null>(null)
  const hasPosition = useRef(false)
  const pins = useRef(new Map<string, { marker: maplibregl.Marker; el: HTMLButtonElement }>())
  const clusters = useRef(new Map<string, maplibregl.Marker>())
  const activePin = useRef<{ id: string; marker: maplibregl.Marker; el: HTMLButtonElement } | null>(null)
  /** A new route shows its whole length first; the first stop is selected without zooming to it. */
  const keepOverview = useRef(false)
  const byId = useRef(new Map<string, Statue>())
  const [ready, setReady] = useState(false)
  const [locateError, setLocateError] = useState<StringKey | null>(null)
  const [following, setFollowing] = useState(false)
  const [locating, setLocating] = useState(false)
  const cb = useRef({ onSelect, onUserPosition })
  cb.current = { onSelect, onUserPosition }
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
                  const withPhoto = leaves.map((l) => byId.current.get(String(l.properties?.id))).find((x) => x?.image)
                  if (withPhoto?.image) node.querySelector('.cluster__photo')!.innerHTML = `<img src="${photoUrl(withPhoto.image, 160)}" alt="" draggable="false">`
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
      map.addSource('route-start', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'route-start', type: 'circle', source: 'route-start', paint: { 'circle-radius': 7, 'circle-color': ACCENT, 'circle-stroke-color': '#f4f4f9', 'circle-stroke-width': 3 } })
      map.addLayer({ id: 'route-start-label', type: 'symbol', source: 'route-start', layout: { 'text-field': t('walkStart', state.current.lang), 'text-font': ['Noto Sans Bold'], 'text-size': 12, 'text-anchor': 'top', 'text-offset': [0, 1.1] }, paint: { 'text-color': ACCENT, 'text-halo-color': '#f4f4f9', 'text-halo-width': 2 } })
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
      map.remove()
      mapRef.current = null
      setReady(false)
    }
  }, [])

  // Location is opt-in and watched only while the map is open. Panning releases
  // the camera lock, while the dot continues to update until tracking is stopped.
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map || !enabled) return
    const geo = new maplibregl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 },
      trackUserLocation: true,
      showAccuracyCircle: true,
      fitBoundsOptions: { maxZoom: 17, padding: padding() },
    })
    geo.on('trackuserlocationstart', () => setFollowing(true))
    geo.on('trackuserlocationend', () => { setFollowing(false); setLocating(false) })
    geo.on('error', (e: { code: number }) => {
      // Non-permission errors leave MapLibre's watch in an error state. Stop it
      // so the next press starts a fresh request rather than toggling it off.
      if (e.code !== 1) geo.trigger()
      setLocateError(e.code === 1 ? 'locationDenied' : e.code === 3 ? 'locationTimeout' : 'locateError')
      hasPosition.current = false
      setLocating(false)
      setFollowing(false)
      cb.current.onUserPosition(null)
    })
    geo.on('geolocate', (e: { coords: GeolocationCoordinates; timestamp: number }) => {
      hasPosition.current = true
      setLocateError(null)
      setLocating(false)
      cb.current.onUserPosition({ lat: e.coords.latitude, lon: e.coords.longitude, accuracy: e.coords.accuracy, timestamp: e.timestamp })
    })
    map.addControl(geo, 'top-left')
    geolocate.current = geo
    return () => {
      if (mapRef.current === map) map.removeControl(geo)
      geolocate.current = null
      hasPosition.current = false
      setFollowing(false)
      setLocating(false)
      setLocateError(null)
      cb.current.onUserPosition(null)
    }
    // Insets are read on activation; GPS updates shouldn't restart the watcher.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, enabled])

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
    if (!ready || !map || !activeId) return
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

  const locate = () => {
    setLocateError(null)
    setLocating(!following && !hasPosition.current)
    const ok = geolocate.current?.trigger()
    if (following) { hasPosition.current = false; cb.current.onUserPosition(null) }
    if (!ok) { setLocateError('locateError'); setLocating(false) }
  }

  return (
    <div className="map-wrap">
      <div ref={el} className="map" role="region" aria-label={t('map', lang)} />
      <div className="map-legend" aria-label={t('statues', lang)}><span><i />{t('unvisited', lang)}</span><span><i className="is-seen">✓</i>{t('visited', lang)}</span></div>
      <button type="button" className="locate" disabled={!ready || locating} onClick={locate} aria-pressed={following} aria-label={t(following ? 'stopFollowing' : 'followMe', lang)}>
        <LocateFixed aria-hidden size={20} strokeWidth={2.2} />
        <span>{t(locating ? 'locating' : following ? 'following' : 'followMe', lang)}</span>
      </button>
      {locateError && (
        <p className="map-toast" role="status">
          {t(locateError, lang)}
        </p>
      )}
    </div>
  )
}
