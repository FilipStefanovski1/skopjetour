import { t } from './i18n'
import type { Lang } from './types'

/**
 * Walking directions from the FOSSGIS OSRM foot router (the one openstreetmap.org uses):
 * free, keyless, OpenStreetMap data. Instructions are written here, in Macedonian or English.
 */
const ROUTER = 'https://routing.openstreetmap.de/routed-foot/route/v1/foot'

export interface Point {
  lat: number
  lon: number
}

export interface Step {
  type: string
  modifier?: string
  exit?: number
  name: string
  /** Where the manoeuvre happens, and how far along the route that is. */
  at: Point
  along: number
}

export interface Route {
  line: [number, number][]
  /** Running distance (m) at each vertex of the line. */
  cum: number[]
  steps: Step[]
  distance: number
}

const R = 6371000
const rad = (d: number) => (d * Math.PI) / 180

function metres(a: Point, b: Point): number {
  const x = rad(b.lon - a.lon) * Math.cos(rad((a.lat + b.lat) / 2))
  const y = rad(b.lat - a.lat)
  return Math.sqrt(x * x + y * y) * R
}

export async function fetchRoute(from: Point, to: Point, signal?: AbortSignal): Promise<Route> {
  const url = `${ROUTER}/${from.lon},${from.lat};${to.lon},${to.lat}?overview=full&geometries=geojson&steps=true`
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`router ${res.status}`)
  const data = await res.json()
  if (data.code !== 'Ok' || !data.routes?.length) throw new Error(data.code ?? 'no route')
  const r = data.routes[0]
  const line: [number, number][] = r.geometry.coordinates
  const cum = [0]
  for (let i = 1; i < line.length; i++) {
    cum.push(cum[i - 1] + metres({ lon: line[i - 1][0], lat: line[i - 1][1] }, { lon: line[i][0], lat: line[i][1] }))
  }
  const steps: Step[] = []
  for (const s of r.legs[0].steps) {
    const [lon, lat] = s.maneuver.location as [number, number]
    steps.push({
      type: s.maneuver.type,
      modifier: s.maneuver.modifier,
      exit: s.maneuver.exit,
      name: s.name ?? '',
      at: { lat, lon },
      along: locate(line, cum, { lat, lon }).along,
    })
  }
  return { line, cum, steps, distance: cum[cum.length - 1] }
}

/** The closest point on the route to `p`: how far along it is, and how far off it `p` stands. */
export function locate(line: [number, number][], cum: number[], p: Point): { along: number; off: number } {
  let best = { along: 0, off: Infinity }
  const k = Math.cos(rad(p.lat)) * R * (Math.PI / 180)
  const m = R * (Math.PI / 180)
  for (let i = 1; i < line.length; i++) {
    const ax = line[i - 1][0] * k, ay = line[i - 1][1] * m
    const bx = line[i][0] * k, by = line[i][1] * m
    const px = p.lon * k, py = p.lat * m
    const dx = bx - ax, dy = by - ay
    const len2 = dx * dx + dy * dy || 1
    const u = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2))
    const off = Math.hypot(px - (ax + u * dx), py - (ay + u * dy))
    if (off < best.off) best = { along: cum[i - 1] + u * (cum[i] - cum[i - 1]), off }
  }
  return best
}

export interface Progress {
  /** Metres still to walk. */
  remaining: number
  /** The next manoeuvre and how far away it is. */
  next: Step | null
  toNext: number
  /** Metres from the route line: large means the walker has left it. */
  off: number
}

export function progress(route: Route, p: Point): Progress {
  const { along, off } = locate(route.line, route.cum, p)
  // The next manoeuvre is the first one still ahead (a few metres of slack for GPS jitter).
  const next = route.steps.find((s, i) => i > 0 && s.along > along + 3) ?? null
  return { remaining: Math.max(0, route.distance - along), next, toNext: next ? Math.max(0, next.along - along) : 0, off }
}

/** About 4.8 km/h: an unhurried sightseeing pace. */
export function walkMinutes(m: number): number {
  return Math.max(1, Math.round(m / 80))
}

export function instruction(step: Step, lang: Lang, destination: string): string {
  const onto = step.name ? ` ${t('onto', lang, { street: step.name })}` : ''
  switch (step.type) {
    case 'depart':
      return step.name ? t('depart', lang, { street: step.name }) : t('departPlain', lang)
    case 'arrive':
      return t('arrive', lang, { place: destination })
    case 'roundabout':
    case 'rotary':
      return t('roundabout', lang, { n: step.exit ?? 1 }) + onto
    default: {
      const turn = turnWords(step.modifier, lang)
      return turn + onto
    }
  }
}

function turnWords(modifier: string | undefined, lang: Lang): string {
  switch (modifier) {
    case 'left':
      return t('turnLeft', lang)
    case 'right':
      return t('turnRight', lang)
    case 'slight left':
      return t('bearLeft', lang)
    case 'slight right':
      return t('bearRight', lang)
    case 'sharp left':
      return t('sharpLeft', lang)
    case 'sharp right':
      return t('sharpRight', lang)
    case 'uturn':
      return t('uturn', lang)
    default:
      return t('straight', lang)
  }
}

export function formatMetres(m: number): string {
  if (m < 1000) return `${Math.max(5, Math.round(m / 10) * 10)} m`
  return `${(m / 1000).toFixed(1)} km`
}
