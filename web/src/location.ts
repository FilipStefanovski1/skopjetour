import { useEffect, useState } from 'react'

export interface Fix {
  lat: number
  lon: number
  accuracy: number
  timestamp: number
  /** Direction of travel from GPS (degrees from north), when moving. */
  course: number | null
}

export type LocationError = 'insecure' | 'denied' | 'unavailable' | 'unsupported'

/** What to tell the visitor when there's no position. */
export function locationErrorText(e: LocationError) {
  return e === 'insecure' ? 'locationInsecure' : e === 'denied' ? 'locationDenied' : 'locateError'
}

/** The visitor's live position while `enabled`; stops listening (and saves battery) otherwise. */
export function useLiveLocation(enabled: boolean, attempt = 0): { fix: Fix | null; error: LocationError | null } {
  const [fix, setFix] = useState<Fix | null>(null)
  const [error, setError] = useState<LocationError | null>(null)

  useEffect(() => {
    if (!enabled) {
      setFix(null)
      setError(null)
      return
    }
    // Browsers never share location with a plain-http page (other than localhost): say so,
    // rather than letting it look like the visitor said no.
    if (!window.isSecureContext) {
      setError('insecure')
      return
    }
    if (!('geolocation' in navigator)) {
      setError('unsupported')
      return
    }
    setError(null)
    const id = navigator.geolocation.watchPosition(
      (p) => {
        setError(null)
        setFix({
          lat: p.coords.latitude,
          lon: p.coords.longitude,
          accuracy: p.coords.accuracy,
          timestamp: p.timestamp,
          course: p.coords.speed && p.coords.speed > 0.6 && p.coords.heading != null && !Number.isNaN(p.coords.heading) ? p.coords.heading : null,
        })
      },
      (e) => {
        setFix(null)
        setError(e.code === e.PERMISSION_DENIED ? 'denied' : 'unavailable')
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 },
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [enabled, attempt])

  return { fix, error }
}

// ------------------------------------------------------------------ demo location

/** Open paving on Macedonia Square, about 60 m from the Warrior on Horseback. */
export const DEMO_START = { lat: 41.9955, lon: 21.432 }

/** Metres per tick and ticks per second: about nine times walking pace, so a route plays in a minute. */
const DEMO_STEP = 6
const DEMO_TICK = 500

const rad = (d: number) => (d * Math.PI) / 180

function bearing(a: [number, number], b: [number, number]): number {
  const y = Math.sin(rad(b[0] - a[0])) * Math.cos(rad(b[1]))
  const x = Math.cos(rad(a[1])) * Math.sin(rad(b[1])) - Math.sin(rad(a[1])) * Math.cos(rad(b[1])) * Math.cos(rad(b[0] - a[0]))
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

function metres(a: [number, number], b: [number, number]): number {
  const x = rad(b[0] - a[0]) * Math.cos(rad((a[1] + b[1]) / 2))
  return Math.hypot(x, rad(b[1] - a[1])) * 6371000
}

/**
 * A pretend position for demos away from the statues: standing on Macedonia Square, and walking
 * along `path` ([lon, lat] pairs) when there is one, the way a visitor following directions would.
 */
export function useDemoLocation(enabled: boolean, path: [number, number][] | null): Fix | null {
  const [fix, setFix] = useState<Fix | null>(null)

  useEffect(() => {
    setFix(enabled ? { ...DEMO_START, accuracy: 8, course: null, timestamp: Date.now() } : null)
  }, [enabled])

  useEffect(() => {
    if (!enabled || !path || path.length < 2) return
    let i = 1
    let into = 0
    let timer = 0
    const tick = () => {
      let left = DEMO_STEP
      while (i < path.length) {
        const seg = metres(path[i - 1], path[i])
        if (into + left < seg) {
          into += left
          break
        }
        left -= seg - into
        into = 0
        i++
      }
      if (i >= path.length) {
        const [lon, lat] = path[path.length - 1]
        setFix({ lat, lon, accuracy: 8, course: null, timestamp: Date.now() })
        return
      }
      const [a, b] = [path[i - 1], path[i]]
      const u = into / (metres(a, b) || 1)
      setFix({ lon: a[0] + (b[0] - a[0]) * u, lat: a[1] + (b[1] - a[1]) * u, accuracy: 8, course: bearing(a, b), timestamp: Date.now() })
      timer = window.setTimeout(tick, DEMO_TICK)
    }
    // A moment on the overview of the whole route before setting off.
    timer = window.setTimeout(tick, 1500)
    return () => clearTimeout(timer)
  }, [enabled, path])

  return fix
}

// ------------------------------------------------------------------ compass

type OrientationEvent = DeviceOrientationEvent & { webkitCompassHeading?: number }

let compass: number | null = null
const listeners = new Set<(h: number) => void>()
let listening = false

function onOrientation(e: OrientationEvent) {
  const h = e.webkitCompassHeading ?? (e.absolute && e.alpha != null ? (360 - e.alpha) % 360 : null)
  if (h == null) return
  compass = h
  listeners.forEach((l) => l(h))
}

/**
 * Turn on the compass. iPhones ask permission for it, and only during a tap, so call this from
 * a click handler (Directions, Where am I).
 */
export async function enableCompass(): Promise<boolean> {
  if (listening) return true
  const D = (window as unknown as { DeviceOrientationEvent?: { requestPermission?: () => Promise<string> } }).DeviceOrientationEvent
  if (!D) return false
  if (typeof D.requestPermission === 'function') {
    try {
      if ((await D.requestPermission()) !== 'granted') return false
    } catch {
      return false
    }
  }
  addEventListener('deviceorientationabsolute', onOrientation as EventListener)
  addEventListener('deviceorientation', onOrientation as EventListener)
  listening = true
  return true
}

/** The way the phone points (degrees from north), updated a few times a second at most. */
export function useCompass(): number | null {
  const [heading, setHeading] = useState<number | null>(compass)
  useEffect(() => {
    let last = 0
    const l = (h: number) => {
      const now = performance.now()
      if (now - last > 120) {
        last = now
        setHeading(h)
      }
    }
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  }, [])
  return heading
}
