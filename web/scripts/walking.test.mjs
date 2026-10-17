import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createWalkingRouter } from '../src/walking.ts'
import { buildCourse, metresBetween } from '../src/course.ts'

const position = ([lon, lat]) => ({ lat, lon })
const graph = (nodes, edges) => ({ version: 1, bounds: [41, 21, 43, 22], nodes, edges })
const a = [21.43, 41.996], b = [21.431, 41.996], c = [21.431, 41.997], d = [21.43, 41.997]

test('walking follows connected streets around a barrier instead of the direct line', () => {
  const router = createWalkingRouter(graph([a, b, c, d], [[0, 1, 0], [1, 2, 0], [2, 3, 0]]))
  const result = router.between(router.snap(position(a)), router.snap(position(d)))
  assert.deepEqual(result.coordinates, [a, b, c, d])
  assert.ok(result.metres > metresBetween(position(a), position(d)) * 2)
})

test('points on the same street use the segment between their projections, without a detour', () => {
  const router = createWalkingRouter(graph([a, b], [[0, 1, 0]]))
  const from = router.snap({ lon: 21.4302, lat: 41.99601 })
  const to = router.snap({ lon: 21.4308, lat: 41.99599 })
  const result = router.between(from, to)
  assert.deepEqual(result.coordinates, [[21.4302, 41.996], [21.4308, 41.996]])
  assert.ok(Math.abs(result.metres - metresBetween(position(from.point), position(to.point))) < .1)
})

test('explicit pedestrian one-way restrictions apply in both snapping and pathfinding', () => {
  const router = createWalkingRouter(graph([a, b], [[0, 1, 1]]))
  const from = router.snap({ lon: 21.4302, lat: 41.996 }), to = router.snap({ lon: 21.4308, lat: 41.996 })
  assert.ok(router.between(from, to))
  assert.equal(router.between(to, from), null)
})

test('disconnected paths and positions outside coverage never produce straight-line fallbacks', () => {
  const router = createWalkingRouter(graph([a, b, c, d], [[0, 1, 0], [2, 3, 0]]))
  assert.equal(router.between(router.snap(position(a)), router.snap(position(d))), null)
  assert.equal(router.snap({ lon: 10, lat: 40 }), null)
  assert.equal(router.snap({ lon: 21.9, lat: 42.5 }), null)
})

const network = JSON.parse(readFileSync(new URL('../src/map/walking-network.json', import.meta.url)))
const data = JSON.parse(readFileSync(new URL('../public/statues.geojson', import.meta.url)))
const statues = data.features.map(f => ({ ...f.properties, ...position(f.geometry.coordinates) }))
const themes = JSON.parse(readFileSync(new URL('../public/themes.json', import.meta.url)))
const router = createWalkingRouter(network)

test('every real themed walk has a complete pedestrian route, including a city-centre GPS approach', () => {
  for (const theme of themes) {
    const course = buildCourse(theme.id, statues, { lat: 41.9961, lon: 21.4314 })
    const route = router.route(course)
    assert.equal(route.complete, true, theme.id)
    assert.equal(route.originUnavailable, false, theme.id)
    assert.ok(route.metres > 0 && route.lines.length > 0, theme.id)
    assert.ok(route.lines.flat().length > course.controls.length, theme.id)
  }
})

test('crossing the Vardar uses mapped Stone Bridge edges', () => {
  const south = router.snap({ lat: 41.9964541, lon: 21.4322609 })
  const north = router.snap({ lat: 41.9977777, lon: 21.4342189 })
  const route = router.between(south, north)
  assert.ok(route)
  const coordinates = new Set(route.coordinates.map(p => p.join(',')))
  assert.ok(network.edges.some(([a, b, , bridge]) => bridge && coordinates.has(network.nodes[a].join(',')) && coordinates.has(network.nodes[b].join(','))))
  assert.ok(route.metres > 150 && route.metres < 350)
})

test('a distant user keeps the monument walk and is explicitly told the approach is unavailable', () => {
  const course = buildCourse(themes[0].id, statues, { lat: 41, lon: 21 })
  const route = router.route(course)
  assert.equal(route.originUnavailable, true)
  assert.equal(route.complete, true)
  assert.ok(route.lines.length > 0)
})

test('Art Bridge stops stay on the bridge deck instead of detouring to paths underneath', () => {
  const bridgeStatues = statues.filter(s => s.group === 'art-bridge')
  for (const statue of bridgeStatues) assert.equal(router.snap(statue, 60, true).edge.bridge, true)
  const route = router.route(buildCourse('artists', statues))
  assert.ok(route.complete)
  assert.ok(route.metres < 1000, `Unexpected bridge detours: ${route.metres} m`)
})

test('a disconnected GPS approach leaves the routed monument walk intact', () => {
  const local = createWalkingRouter(graph([a, b, c, d], [[0, 1, 0], [2, 3, 0]]))
  const course = { controls: [{ ...position(c) }, { ...position(d) }], origin: position(a) }
  const route = local.route(course)
  assert.equal(route.complete, true)
  assert.equal(route.originUnavailable, true)
  assert.deepEqual(route.lines, [[c, d]])
})
