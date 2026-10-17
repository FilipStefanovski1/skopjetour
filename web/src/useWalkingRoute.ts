import { useEffect, useState } from 'react'
import type { Course } from './course'
import { createWalkingRouter } from './walking'
import type { WalkingRoute } from './walking'
import networkUrl from './map/walking-network.json?url'

export interface RouteState {
  status: 'loading' | 'ready' | 'error'
  route: WalkingRoute | null
}
let routerPromise: Promise<ReturnType<typeof createWalkingRouter>> | null = null
function loadRouter() {
  if (!routerPromise) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)
    routerPromise = fetch(networkUrl, { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('Walking network unavailable')
        const data = await response.json()
        if (data.version !== 1 || !data.nodes?.length || !data.edges?.length) throw new Error('Invalid walking network')
        return createWalkingRouter(data)
      })
      .catch(error => { routerPromise = null; throw error })
      .finally(() => clearTimeout(timeout))
  }
  return routerPromise
}

export function useWalkingRoute(course: Course | null) {
  const [result, setResult] = useState<{ course: Course; state: RouteState } | null>(null)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!course) return
    let cancelled = false
    loadRouter().then(router => {
      if (!cancelled) setResult({ course, state: { status: 'ready', route: router.route(course) } })
    }).catch(() => {
      if (!cancelled) setResult({ course, state: { status: 'error', route: null } })
    })
    return () => { cancelled = true }
  }, [course, attempt])
  const state: RouteState = result?.course === course && result ? result.state : { status: 'loading', route: null }
  return { ...state, retry: () => { setResult(null); setAttempt(value => value + 1) } }
}
