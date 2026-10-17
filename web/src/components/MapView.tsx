import { useEffect, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import type { GeoJSONSource, Map as MLMap, MapLayerMouseEvent } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { LocateFixed, Maximize2, Minus, Plus } from 'lucide-react'
import type { Course } from '../course'
import { CITY_CENTRE, metresBetween } from '../course'
import { t } from '../i18n'
import { LABEL_LAYERS, labelField, sprintMapStyle } from '../map/style'
import type { Lang, Statue } from '../types'
import { statueName } from '../types'

// Vite moves MapLibre's code during bundling, so point it at its worker explicitly.
maplibregl.setWorkerUrl(workerUrl)

export const PURPLE = '#7b2cbf'
const CONTOUR = '#8a5728'

export interface Insets {
  top: number
  bottom: number
  left: number
}

interface Props {
  statues: Statue[]
  course: Course | null
  selectedId: string | null
  seen: Set<string>
  lang: Lang
  insets: Insets
  onSelect: (id: string) => void
}

type FC = GeoJSON.FeatureCollection

const empty: FC = { type: 'FeatureCollection', features: [] }

function point(s: Statue, props: Record<string, unknown> = {}): GeoJSON.Feature {
  return { type: 'Feature', geometry: { type: 'Point', coordinates: [s.lon, s.lat] }, properties: { id: s.id, ...props } }
}

function bearing(a: Statue, b: Statue): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const y = Math.sin(toRad(b.lon - a.lon)) * Math.cos(toRad(b.lat))
  const x = Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) - Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lon - a.lon))
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

/** A leg drawn between circle edges, the way a course is printed, revealed up to `progress` metres. */
function legLines(course: Course, progress: number): FC {
  const features: GeoJSON.Feature[] = []
  let walked = 0
  for (const { from, to } of course.legs) {
    const length = metresBetween(from, to)
    const trim = Math.min(14, length / 3)
    const f0 = trim / length
    const f1 = 1 - trim / length
    const visible = Math.min(1, Math.max(0, (progress - walked) / length))
    walked += length
    if (visible <= f0) continue
    const end = Math.min(f1, visible)
    const lerp = (f: number) => [from.lon + (to.lon - from.lon) * f, from.lat + (to.lat - from.lat) * f]
    features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: [lerp(f0), lerp(end)] }, properties: {} })
  }
  return { type: 'FeatureCollection', features }
}

function triangleImage(): ImageData {
  const size = 64
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')!
  g.strokeStyle = PURPLE
  g.lineWidth = 5
  g.lineJoin = 'miter'
  g.beginPath()
  // Points up; the layer rotates it toward the first leg.
  g.moveTo(size / 2, 7)
  g.lineTo(size - 9, size - 12)
  g.lineTo(9, size - 12)
  g.closePath()
  g.stroke()
  return g.getImageData(0, 0, size, size)
}

// Symbols stop growing past street level: on the Art Bridge the statues stand ~6 m apart.
interface NumberMarker {
  marker: maplibregl.Marker
  node: HTMLElement
  lngLat: [number, number]
  dense: boolean
  edge: boolean
}

function ringPx(base: number, zoom: number): number {
  if (zoom <= 12) return base * 0.55
  if (zoom <= 16) return base * (0.55 + ((zoom - 12) / 4) * 0.45)
  return base * (1 - (Math.min(zoom, 18.5) - 16) / 2.5 * 0.1)
}

// Try the printed-map positions in order: up-right first, then round the circle.
const ANGLES = [45, 135, -45, -135, 0, 180, 90, -90].map((a) => (a * Math.PI) / 180)

/**
 * Place each control number beside its circle where it collides with no other number and no
 * other circle, the way a course setter does. Only a number with no free spot at all is hidden.
 */
function layoutNumbers(map: MLMap, markers: NumberMarker[]) {
  const zoom = map.getZoom()
  const circles = markers.map((m) => ({ p: map.project(m.lngLat), r: ringPx(m.dense ? 5.5 : 11, zoom) + 2 }))
  const placed: { x: number; y: number; w: number; h: number }[] = []
  const hits = (b: { x: number; y: number; w: number; h: number }, own: number) =>
    placed.some((o) => b.x < o.x + o.w && b.x + b.w > o.x && b.y < o.y + o.h && b.y + b.h > o.y) ||
    circles.some((c, j) => {
      if (j === own) return false
      const nx = Math.max(b.x, Math.min(c.p.x, b.x + b.w))
      const ny = Math.max(b.y, Math.min(c.p.y, b.y + b.h))
      return (nx - c.p.x) ** 2 + (ny - c.p.y) ** 2 < c.r ** 2
    })
  markers.forEach((m, i) => {
    const w = m.node.offsetWidth || 14
    const h = m.node.offsetHeight || 18
    const { p, r } = circles[i]
    let spot: { x: number; y: number; w: number; h: number; dx: number; dy: number } | null = null
    for (const a of ANGLES) {
      const dx = Math.cos(a) * (r + 2 + w / 2)
      const dy = -Math.sin(a) * (r + 1 + h / 2)
      const box = { x: p.x + dx - w / 2, y: p.y + dy - h / 2, w, h }
      if (!hits(box, i)) {
        spot = { ...box, dx, dy }
        break
      }
    }
    if (!spot && m.edge) {
      const dx = Math.cos(ANGLES[0]) * (r + 2 + w / 2)
      const dy = -Math.sin(ANGLES[0]) * (r + 1 + h / 2)
      spot = { x: p.x + dx - w / 2, y: p.y + dy - h / 2, w, h, dx, dy }
    }
    m.node.style.visibility = spot ? 'visible' : 'hidden'
    if (spot) {
      m.marker.setOffset([spot.dx, spot.dy])
      placed.push({ x: spot.x, y: spot.y, w, h })
    }
  })
}

const ring = (base: number) =>
  ['interpolate', ['linear'], ['zoom'], 12, base * 0.55, 16, base, 18.5, base * 0.9] as maplibregl.ExpressionSpecification

/** A control closer than this to its nearest neighbour is drawn small, its number shown only up close. */
const DENSE_M = 18

const controlRing = (base: number, dense: number) => {
  const at = (k: number): maplibregl.ExpressionSpecification => ['case', ['get', 'dense'], dense * k, base * k]
  return ['interpolate', ['linear'], ['zoom'], 12, at(0.55), 16, at(1), 18.5, at(0.9)] as maplibregl.ExpressionSpecification
}

export function MapView({ statues, course, selectedId, seen, lang, insets, onSelect }: Props) {
  const el = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MLMap | null>(null)
  const geolocate = useRef<maplibregl.GeolocateControl | null>(null)
  const numberMarkers = useRef<NumberMarker[]>([])
  const relayoutRef = useRef<() => void>(() => {})
  const [ready, setReady] = useState(false)
  const [locateError, setLocateError] = useState(false)
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect
  const insetsRef = useRef(insets)
  insetsRef.current = insets

  const padding = (extra = 40) => ({
    top: insetsRef.current.top + extra,
    bottom: insetsRef.current.bottom + extra,
    left: insetsRef.current.left + extra,
    right: 72,
  })

  // Map and static layers, once.
  useEffect(() => {
    if (!el.current) return
    const map = new maplibregl.Map({
      container: el.current,
      style: sprintMapStyle(lang),
      center: [CITY_CENTRE[1], CITY_CENTRE[0]],
      zoom: 15.2,
      minZoom: 11,
      maxZoom: 20,
      attributionControl: { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
    })
    map.touchZoomRotate.disableRotation()
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric', maxWidth: 96 }), 'bottom-left')
    const geo = new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: false, showAccuracyCircle: true })
    geo.on('error', () => setLocateError(true))
    geo.on('geolocate', () => setLocateError(false))
    map.addControl(geo, 'top-left')
    geolocate.current = geo

    map.on('load', () => {
      map.addImage('start-triangle', triangleImage(), { pixelRatio: 2 })
      map.addSource('statues', { type: 'geojson', data: empty, cluster: true, clusterRadius: 36, clusterMaxZoom: 16 })
      map.addSource('others', { type: 'geojson', data: empty })
      map.addSource('legs', { type: 'geojson', data: empty })
      map.addSource('controls', { type: 'geojson', data: empty })
      map.addSource('selected', { type: 'geojson', data: empty })

      map.addLayer({
        id: 'others', type: 'circle', source: 'others',
        paint: { 'circle-radius': ring(4), 'circle-color': '#ffffff', 'circle-stroke-color': PURPLE, 'circle-stroke-width': 1.5, 'circle-opacity': 0.75, 'circle-stroke-opacity': 0.45 },
      })
      // A group of statues: two stacked contour-brown rings with a ×count, never a purple control.
      const clusterRadius: maplibregl.ExpressionSpecification = ['step', ['get', 'point_count'], 13, 10, 16, 25, 19]
      map.addLayer({
        id: 'cluster-back', type: 'circle', source: 'statues', filter: ['has', 'point_count'],
        paint: { 'circle-radius': clusterRadius, 'circle-color': '#ffffff', 'circle-stroke-color': CONTOUR, 'circle-stroke-width': 1.5, 'circle-translate': [4, -4] },
      })
      map.addLayer({
        id: 'cluster', type: 'circle', source: 'statues', filter: ['has', 'point_count'],
        paint: { 'circle-radius': clusterRadius, 'circle-color': '#ffffff', 'circle-stroke-color': CONTOUR, 'circle-stroke-width': 2 },
      })
      map.addLayer({
        id: 'cluster-count', type: 'symbol', source: 'statues', filter: ['has', 'point_count'],
        layout: { 'text-field': ['concat', '×', ['get', 'point_count_abbreviated']], 'text-font': ['Noto Sans Bold'], 'text-size': 11.5, 'text-allow-overlap': true },
        paint: { 'text-color': CONTOUR },
      })
      map.addLayer({
        id: 'statue', type: 'circle', source: 'statues', filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-radius': ring(7), 'circle-stroke-width': 2.2, 'circle-stroke-color': PURPLE,
          'circle-color': ['case', ['get', 'seen'], PURPLE, '#ffffff'], 'circle-opacity': ['case', ['get', 'seen'], 0.85, 0.55],
        },
      })
      map.addLayer({
        id: 'legs', type: 'line', source: 'legs',
        layout: { 'line-cap': 'butt' },
        paint: { 'line-color': PURPLE, 'line-width': ['interpolate', ['linear'], ['zoom'], 13, 1.6, 17, 3] },
      })
      map.addLayer({
        id: 'finish-outer', type: 'circle', source: 'controls', filter: ['get', 'last'],
        paint: { 'circle-radius': controlRing(15, 9), 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': PURPLE, 'circle-stroke-width': 2.2 },
      })
      map.addLayer({
        id: 'control', type: 'circle', source: 'controls', filter: ['!', ['get', 'first']],
        paint: {
          'circle-radius': controlRing(11, 5.5), 'circle-stroke-width': ['case', ['get', 'dense'], 2, 2.6], 'circle-stroke-color': PURPLE,
          'circle-color': ['case', ['get', 'seen'], PURPLE, 'rgba(255,255,255,0.35)'], 'circle-opacity': ['case', ['get', 'seen'], 0.8, 1],
        },
      })
      map.addLayer({
        id: 'start', type: 'symbol', source: 'controls', filter: ['get', 'first'],
        layout: {
          'icon-image': 'start-triangle', 'icon-size': ['interpolate', ['linear'], ['zoom'], 12, 0.55, 16, 0.95, 18.5, 0.9],
          'icon-rotate': ['get', 'bearing'], 'icon-rotation-alignment': 'map', 'icon-allow-overlap': true,
        },
      })
      map.addLayer({
        id: 'selected', type: 'circle', source: 'selected',
        paint: { 'circle-radius': ring(17), 'circle-color': 'rgba(123,44,191,0.12)', 'circle-stroke-color': PURPLE, 'circle-stroke-width': 3.2 },
      })

      const pick = (e: MapLayerMouseEvent) => {
        const id = e.features?.[0]?.properties?.id
        if (typeof id === 'string') onSelectRef.current(id)
      }
      for (const layer of ['statue', 'control', 'start', 'others']) {
        map.on('click', layer, pick)
        map.on('mouseenter', layer, () => (map.getCanvas().style.cursor = 'pointer'))
        map.on('mouseleave', layer, () => (map.getCanvas().style.cursor = ''))
      }
      map.on('click', 'cluster', async (e: MapLayerMouseEvent) => {
        const f = e.features?.[0]
        if (!f) return
        const zoom = await (map.getSource('statues') as GeoJSONSource).getClusterExpansionZoom(f.properties!.cluster_id)
        map.easeTo({ center: (f.geometry as GeoJSON.Point).coordinates as [number, number], zoom: zoom + 0.3 })
      })
      map.on('mouseenter', 'cluster', () => (map.getCanvas().style.cursor = 'zoom-in'))
      map.on('mouseleave', 'cluster', () => (map.getCanvas().style.cursor = ''))
      setReady(true)
    })

    let queued = 0
    const relayout = () => {
      if (queued) return
      queued = requestAnimationFrame(() => {
        queued = 0
        layoutNumbers(map, numberMarkers.current)
      })
    }
    map.on('move', relayout)
    relayoutRef.current = relayout

    const ro = new ResizeObserver(() => map.resize())
    ro.observe(el.current)
    mapRef.current = map
    if (import.meta.env.DEV) {
      const mark = () => el.current?.setAttribute('data-debug', JSON.stringify({ c: map.getCenter(), z: map.getZoom(), loaded: map.loaded() }))
      map.on('moveend', mark)
      map.on('error', (e) => el.current?.setAttribute('data-error', String(e.error?.message ?? e.error)))
      map.on('load', mark)
    }
    return () => {
      ro.disconnect()
      numberMarkers.current.forEach((m) => m.marker.remove())
      map.remove()
      mapRef.current = null
      setReady(false)
    }
    // The style is built once; language changes are applied below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    for (const id of LABEL_LAYERS) map.setLayoutProperty(id, 'text-field', labelField(lang))
    map.getCanvas().setAttribute('aria-label', t('map', lang))
  }, [lang, ready])

  // Statues, course and the punched state.
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    const inCourse = new Set(course?.controls.map((c) => c.id))
    ;(map.getSource('statues') as GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: course ? [] : statues.map((s) => point(s, { seen: seen.has(s.id) })),
    })
    ;(map.getSource('others') as GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: course ? statues.filter((s) => !inCourse.has(s.id)).map((s) => point(s)) : [],
    })
    const controls = course?.controls ?? []
    const dense = controls.map((s) => controls.some((o) => o !== s && metresBetween(s, o) < DENSE_M))
    ;(map.getSource('controls') as GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: controls.map((s, i) =>
        point(s, {
          n: i + 1, seen: seen.has(s.id), first: i === 0, last: i === controls.length - 1 && i > 0, dense: dense[i],
          bearing: i === 0 && controls[1] ? bearing(s, controls[1]) : 0,
        }),
      ),
    })

    // Control numbers sit up and to the right of their circles, set in the UI face.
    numberMarkers.current.forEach((m) => m.marker.remove())
    numberMarkers.current = controls.map((s, i) => {
      const node = document.createElement('button')
      node.type = 'button'
      node.className = `control-number${dense[i] ? ' control-number--dense' : ''}`
      node.textContent = String(i + 1)
      node.setAttribute('aria-label', `${i + 1}. ${statueName(s, lang)}`)
      node.addEventListener('click', () => onSelectRef.current(s.id))
      const marker = new maplibregl.Marker({ element: node, anchor: 'center' }).setLngLat([s.lon, s.lat]).addTo(map)
      return { marker, node, lngLat: [s.lon, s.lat] as [number, number], dense: dense[i], edge: i === 0 || i === controls.length - 1 }
    })
    relayoutRef.current()
  }, [ready, statues, course, seen, lang])

  // Draw the legs in, start to finish, whenever the course changes.
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    const source = map.getSource('legs') as GeoJSONSource
    if (!course || course.legs.length === 0) {
      source.setData(empty)
      return
    }
    const total = course.legs.reduce((sum, l) => sum + metresBetween(l.from, l.to), 0)
    // When most stops stand shoulder to shoulder (the Art Bridge), open on that group, close
    // enough for each circle and number to separate; the whole-route button shows the rest.
    const packed = course.controls.filter((s) => course.controls.some((o) => o !== s && metresBetween(s, o) < DENSE_M))
    const focus = packed.length >= course.controls.length / 2 ? packed : course.controls
    const bounds = new maplibregl.LngLatBounds()
    focus.forEach((c) => bounds.extend([c.lon, c.lat]))
    map.fitBounds(bounds, { padding: padding(), maxZoom: focus === packed ? 19.4 : 18.5, duration: 700 })

    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      source.setData(legLines(course, total))
      return
    }
    let frame = 0
    const startAt = performance.now() + 450
    const duration = Math.min(2200, 600 + course.legs.length * 70)
    const tick = (now: number) => {
      const p = Math.min(1, Math.max(0, (now - startAt) / duration))
      const eased = 1 - Math.pow(1 - p, 3)
      source.setData(legLines(course, total * eased))
      if (p < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
    // padding reads the latest insets through a ref
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, course])

  // The selected statue: ring it and bring it into the visible part of the map.
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    const s = statues.find((x) => x.id === selectedId)
    ;(map.getSource('selected') as GeoJSONSource).setData(s ? { type: 'FeatureCollection', features: [point(s)] } : empty)
    if (!s) return
    // Wait a beat so the phone sheet has risen and reported the space it now covers.
    const timer = setTimeout(
      () => map.easeTo({ center: [s.lon, s.lat], zoom: Math.max(map.getZoom(), 16.5), padding: padding(0), duration: 600 }),
      90,
    )
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, selectedId, statues])

  const fitCourse = () => {
    const map = mapRef.current
    if (!map || !course?.controls.length) return
    const bounds = new maplibregl.LngLatBounds()
    course.controls.forEach((c) => bounds.extend([c.lon, c.lat]))
    map.fitBounds(bounds, { padding: padding(), maxZoom: 18.5, duration: 600 })
  }

  return (
    <div className="map-wrap">
      <div ref={el} className="map" role="region" aria-label={t('map', lang)} />
      <div className="map-tools" role="group">
        <button type="button" onClick={() => mapRef.current?.zoomIn()} aria-label={t('zoomIn', lang)} title={t('zoomIn', lang)}>
          <Plus aria-hidden size={18} strokeWidth={2.25} />
        </button>
        <button type="button" onClick={() => mapRef.current?.zoomOut()} aria-label={t('zoomOut', lang)} title={t('zoomOut', lang)}>
          <Minus aria-hidden size={18} strokeWidth={2.25} />
        </button>
        <button type="button" onClick={() => geolocate.current?.trigger()} aria-label={t('locate', lang)} title={t('locate', lang)}>
          <LocateFixed aria-hidden size={18} strokeWidth={2.25} />
        </button>
        {course && (
          <button type="button" onClick={fitCourse} aria-label={t('fitCourse', lang)} title={t('fitCourse', lang)}>
            <Maximize2 aria-hidden size={17} strokeWidth={2.25} />
          </button>
        )}
      </div>
      {locateError && (
        <p className="map-toast" role="status">
          {t('locateError', lang)}
        </p>
      )}
    </div>
  )
}
