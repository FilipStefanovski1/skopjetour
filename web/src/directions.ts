import type { Statue } from './types'

export type MapsProvider = 'google' | 'apple'
type Stop = Pick<Statue, 'id' | 'lat' | 'lon'>

/** A monument in the selected walk hands off the whole ordered walk, including visited stops. */
export function directionStops<T extends Stop>(monument: T, walk: readonly T[]): T[] {
  return walk.some((stop) => stop.id === monument.id) ? [...walk] : [monument]
}

export interface DirectionsPart<T extends Stop = Stop> {
  stops: T[]
  startNumber: number
  endNumber: number
  url: string
}

const coordinates = (stop: Stop) => `${stop.lat.toFixed(6)},${stop.lon.toFixed(6)}`

/**
 * No GPS fix is embedded: Maps obtains the visitor's current location for the first part.
 * Later parts start at the preceding part's destination, so every connecting leg is kept.
 * Google mobile browsers support 3 waypoints (+ destination), other platforms support 9.
 * The UI offers app links plus an explicit mobile-browser fallback; neither drops stops.
 * Apple unified URLs support repeated waypoints (iOS 18.4+); we cap our parts at 10 stops.
 * Neither URL format imports our route geometry: providers calculate the paths themselves.
 * https://developers.google.com/maps/documentation/urls/get-started
 * https://developer.apple.com/documentation/mapkit/unified-map-urls
 */
export function directionsParts<T extends Stop>(stops: readonly T[], provider: MapsProvider, googleBrowser = true): DirectionsPart<T>[] {
  const limit = provider === 'google' && googleBrowser ? 4 : 10
  const parts: DirectionsPart<T>[] = []
  for (let offset = 0; offset < stops.length; offset += limit) {
    const section = stops.slice(offset, offset + limit)
    const destination = coordinates(section[section.length - 1])
    const waypoints = section.slice(0, -1).map(coordinates)
    const origin = offset > 0 ? coordinates(stops[offset - 1]) : null
    const url = new URL(provider === 'google' ? 'https://www.google.com/maps/dir/' : 'https://maps.apple.com/directions')
    if (provider === 'google') {
      url.searchParams.set('api', '1')
      url.searchParams.set('travelmode', 'walking')
      if (origin) url.searchParams.set('origin', origin)
      if (waypoints.length) url.searchParams.set('waypoints', waypoints.join('|'))
    } else {
      url.searchParams.set('mode', 'walking')
      if (origin) url.searchParams.set('source', origin)
      for (const waypoint of waypoints) url.searchParams.append('waypoint', waypoint)
    }
    url.searchParams.set('destination', destination)
    parts.push({ stops: section, startNumber: offset + 1, endNumber: offset + section.length, url: url.toString() })
  }
  return parts
}
