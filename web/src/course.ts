import type { Statue } from './types'

/** Macedonia Square: fallback start when the visitor has not shared a location. */
export const CITY_CENTRE: [number, number] = [41.9961, 21.4314]
/** Controls further than this from the square are listed but not put on the course. */
const COURSE_RADIUS_M = 1500
/** Streets add roughly a quarter to straight-line distance in the centre. */
const STREET_FACTOR = 1.25
const WALK_M_PER_MIN = 75

export interface Leg {
  from: Statue
  to: Statue
  metres: number
  minutes: number
}

export interface Course {
  id: string
  origin: { lat: number; lon: number } | null
  controls: Statue[]
  legs: Leg[]
  metres: number
  minutes: number
  /** Statues on this theme too far out to walk as part of the course. */
  beyond: Statue[]
}

export function metresBetween(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

function tourLength(order: Statue[]): number {
  let total = 0
  for (let i = 1; i < order.length; i++) total += metresBetween(order[i - 1], order[i])
  return total
}

/** Nearest-neighbour walk from the start, then 2-opt until no swap shortens it. */
function walkingOrder(points: Statue[], start: Statue): Statue[] {
  const rest = points.filter((p) => p !== start)
  const order = [start]
  while (rest.length) {
    const last = order[order.length - 1]
    let best = 0
    for (let i = 1; i < rest.length; i++) {
      if (metresBetween(last, rest[i]) < metresBetween(last, rest[best])) best = i
    }
    order.push(rest.splice(best, 1)[0])
  }
  let improved = true
  while (improved) {
    improved = false
    for (let i = 1; i < order.length - 2; i++) {
      for (let j = i + 1; j < order.length - 1; j++) {
        const before = metresBetween(order[i - 1], order[i]) + metresBetween(order[j], order[j + 1])
        const after = metresBetween(order[i - 1], order[j]) + metresBetween(order[i], order[j + 1])
        if (after + 0.5 < before) {
          order.splice(i, j - i + 1, ...order.slice(i, j + 1).reverse())
          improved = true
        }
      }
    }
  }
  return order
}

export function buildCourse(id: string, statues: Statue[], origin: { lat: number; lon: number } | null = null): Course {
  const centre = { lat: CITY_CENTRE[0], lon: CITY_CENTRE[1] }
  const onTheme = statues.filter((s) => s.themes.includes(id))
  const near = onTheme.filter((s) => metresBetween(centre, s) <= COURSE_RADIUS_M)
  const beyond = onTheme.filter((s) => metresBetween(centre, s) > COURSE_RADIUS_M)
  if (near.length === 0) return { id, origin, controls: [], legs: [], metres: 0, minutes: 0, beyond }

  const from = origin ?? centre
  const start = near.reduce((a, b) => (metresBetween(from, a) <= metresBetween(from, b) ? a : b))
  const controls = walkingOrder(near, start)
  const legs = controls.slice(1).map((to, i) => {
    const metres = metresBetween(controls[i], to) * STREET_FACTOR
    return { from: controls[i], to, metres, minutes: Math.max(1, Math.round(metres / WALK_M_PER_MIN)) }
  })
  const metres = (tourLength(controls) + (origin ? metresBetween(origin, start) : 0)) * STREET_FACTOR
  return { id, origin, controls, legs, metres, minutes: Math.max(1, Math.round(metres / WALK_M_PER_MIN)), beyond }
}

export function formatDistance(metres: number): string {
  return metres < 1000 ? `${Math.round(metres / 10) * 10} m` : `${(metres / 1000).toFixed(1)} km`
}

/** Straight-line proximity, deliberately separate from the fixed order of a themed walk. */
export function nearbyStatues(statues: Statue[], from: { lat: number; lon: number }): Statue[] {
  return [...statues].sort((a, b) => metresBetween(from, a) - metresBetween(from, b) || a.id.localeCompare(b.id))
}

export function nextStop(nearby: Statue[], seen: Set<string>, course: Course | null): Statue | null {
  return (course ? course.controls : nearby).find((s) => !seen.has(s.id)) ?? null
}

export interface LocationFix { lat: number; lon: number; accuracy: number; timestamp: number }
export interface ArrivalState { candidateId: string | null; since: number; blocked: Set<string> }
export const ARRIVAL_DWELL_MS = 6000

/** Only the closest monument can be collected; standing still must not collect a whole cluster. */
export function updateArrival(statues: Statue[], fix: LocationFix | null, seen: Set<string>, previous: ArrivalState, now: number): { state: ArrivalState; visit: string | null } {
  const reset = { ...previous, candidateId: null, since: 0 }
  if (!fix || ![fix.lat, fix.lon, fix.accuracy, fix.timestamp].every(Number.isFinite) ||
    fix.accuracy < 0 || fix.accuracy > 25 || now - fix.timestamp > 15000 || fix.timestamp > now + 1000) {
    return { state: reset, visit: null }
  }
  const blocked = new Set([...previous.blocked].filter((id) => {
    const s = statues.find((s) => s.id === id)
    return s && metresBetween(fix, s) < 50
  }))
  const nearest = nearbyStatues(statues, fix)[0]
  if (!nearest || metresBetween(fix, nearest) > 25 || seen.has(nearest.id) || blocked.has(nearest.id)) {
    return { state: { ...reset, blocked }, visit: null }
  }
  if (previous.candidateId !== nearest.id) {
    return { state: { candidateId: nearest.id, since: now, blocked }, visit: null }
  }
  if (now - previous.since < ARRIVAL_DWELL_MS) return { state: { ...previous, blocked }, visit: null }
  blocked.add(nearest.id)
  return { state: { candidateId: null, since: 0, blocked }, visit: nearest.id }
}

export function courseCoordinates(course: Course): [number, number][] {
  if (!course.controls.length) return []
  return [
    ...(course.origin ? [[course.origin.lon, course.origin.lat] as [number, number]] : []),
    ...course.controls.map((s): [number, number] => [s.lon, s.lat]),
  ]
}
