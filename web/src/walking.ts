import { metresBetween } from './course.ts'
import type { Course } from './course.ts'

type Point = [number, number]
type Position = { lat: number; lon: number }
export interface WalkingNetwork {
  version: number
  bounds: number[]
  nodes: number[][]
  // from, to, foot direction (0 = both), bridge
  edges: number[][]
}
interface Edge { a: number; b: number; direction: number; metres: number; bridge: boolean }
interface Snap { point: Point; edge: Edge; fraction: number; distance: number }
export interface WalkingRoute {
  lines: Point[][]
  metres: number
  minutes: number
  complete: boolean
  originUnavailable: boolean
}
const position = (p: number[]): Position => ({ lon: p[0], lat: p[1] })

/** Binary min-heap for Dijkstra, keeping route calculation cheap on phones. */
class Queue {
  private items: [number, number][] = []
  push(item: [number, number]) {
    const a = this.items
    let i = a.length
    a.push(item)
    while (i > 0) {
      const parent = (i - 1) >> 1
      if (a[parent][1] <= item[1]) break
      a[i] = a[parent]
      i = parent
    }
    a[i] = item
  }
  pop(): [number, number] | undefined {
    const a = this.items, first = a[0], last = a.pop()
    if (a.length && last) {
      let i = 0
      while (i * 2 + 1 < a.length) {
        let child = i * 2 + 1
        if (child + 1 < a.length && a[child + 1][1] < a[child][1]) child++
        if (a[child][1] >= last[1]) break
        a[i] = a[child]
        i = child
      }
      a[i] = last
    }
    return first
  }
}

export function createWalkingRouter(network: WalkingNetwork) {
  const nodes = network.nodes as Point[]
  const adjacency: { to: number; metres: number }[][] = nodes.map(() => [])
  const edges: Edge[] = network.edges.map(([a, b, direction, bridge]) => {
    const metres = metresBetween(position(nodes[a]), position(nodes[b]))
    if (direction !== -1) adjacency[a].push({ to: b, metres })
    if (direction !== 1) adjacency[b].push({ to: a, metres })
    return { a, b, direction, metres, bridge: Boolean(bridge) }
  })
  const [south, west, north, east] = network.bounds
  function snap(p: Position, maxDistance = 60, bridgeOnly = false): Snap | null {
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lon) || p.lat < south || p.lat > north || p.lon < west || p.lon > east) return null
    let best: Snap | null = null
    const xScale = Math.cos(p.lat * Math.PI / 180)
    for (const edge of edges) {
      if (bridgeOnly && !edge.bridge) continue
      const a = nodes[edge.a], b = nodes[edge.b]
      const dx = (b[0] - a[0]) * xScale, dy = b[1] - a[1]
      const fraction = Math.max(0, Math.min(1, (((p.lon - a[0]) * xScale * dx + (p.lat - a[1]) * dy) / (dx * dx + dy * dy)) || 0))
      const point: Point = [a[0] + (b[0] - a[0]) * fraction, a[1] + (b[1] - a[1]) * fraction]
      const distance = metresBetween(p, position(point))
      if (distance <= maxDistance && (!best || distance < best.distance)) best = { point, edge, fraction, distance }
    }
    return best
  }

  function between(start: Snap, end: Snap): { coordinates: Point[]; metres: number } | null {
    const distances = new Float64Array(nodes.length).fill(Infinity)
    const previous = new Int32Array(nodes.length).fill(-1)
    const queue = new Queue()
    const seed = (node: number, distance: number) => {
      if (distance < distances[node]) { distances[node] = distance; queue.push([node, distance]) }
    }
    if (start.edge.direction !== 1 || start.fraction === 0) seed(start.edge.a, start.edge.metres * start.fraction)
    if (start.edge.direction !== -1 || start.fraction === 1) seed(start.edge.b, start.edge.metres * (1 - start.fraction))
    const targets = new Map<number, number>()
    if (end.edge.direction !== -1 || end.fraction === 0) targets.set(end.edge.a, end.edge.metres * end.fraction)
    if (end.edge.direction !== 1 || end.fraction === 1) targets.set(end.edge.b, end.edge.metres * (1 - end.fraction))
    let best = Infinity, target = -1
    // Two points on the same edge can walk directly along that mapped segment.
    if (start.edge === end.edge && (start.edge.direction === 0 ||
      (end.fraction - start.fraction) * start.edge.direction >= 0)) best = Math.abs(end.fraction - start.fraction) * start.edge.metres
    let entry: [number, number] | undefined
    while ((entry = queue.pop())) {
      const [node, distance] = entry
      if (distance > distances[node]) continue
      if (distance >= best) break
      const finish = targets.get(node)
      if (finish !== undefined && distance + finish < best) { best = distance + finish; target = node }
      for (const edge of adjacency[node]) {
        const next = distance + edge.metres
        if (next < distances[edge.to] && next < best) {
          distances[edge.to] = next
          previous[edge.to] = node
          queue.push([edge.to, next])
        }
      }
    }
    if (!Number.isFinite(best)) return null
    const path: Point[] = []
    for (let node = target; node !== -1; node = previous[node]) path.push(nodes[node])
    path.reverse()
    const coordinates = [start.point, ...path, end.point].filter((p, i, all) => i === 0 || p[0] !== all[i - 1][0] || p[1] !== all[i - 1][1])
    return { coordinates, metres: best }
  }

  function route(course: Course): WalkingRoute {
    // These statues stand on the deck, not the riverside paths underneath it.
    const stops = course.controls.map(s => snap(s, 60, s.group === 'art-bridge'))
    const origin = course.origin ? snap(course.origin) : null
    let originUnavailable = Boolean(course.origin && !origin)
    const points = origin ? [origin, ...stops] : stops
    const lines: Point[][] = []
    let metres = 0, complete = stops.every(Boolean)
    for (let i = 1; i < points.length; i++) {
      const from = points[i - 1], to = points[i]
      const leg = from && to ? between(from, to) : null
      if (!leg) {
        if (origin && i === 1) originUnavailable = true
        else complete = false
        continue
      }
      metres += leg.metres
      if (leg.coordinates.length > 1) lines.push(leg.coordinates)
    }
    return { lines, metres, minutes: Math.max(1, Math.round(metres / 75)), complete, originUnavailable }
  }
  return { route, snap, between }
}
