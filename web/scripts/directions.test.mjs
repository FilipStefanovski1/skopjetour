import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { directionStops, directionsParts } from '../src/directions.ts'
import { buildCourse } from '../src/course.ts'

const stop = (id, n) => ({ id, lat: 41.99 + n / 1000, lon: 21.43 + n / 1000 })
const walk = Array.from({ length: 31 }, (_, i) => stop(`stop-${i}`, i))
const coord = (s) => `${s.lat.toFixed(6)},${s.lon.toFixed(6)}`
const decode = (part, provider) => {
  const p = new URL(part.url).searchParams
  const via = provider === 'google' ? (p.get('waypoints')?.split('|') ?? []) : p.getAll('waypoint')
  return [...via, p.get('destination')]
}

test('a middle monument exports the whole decided walk from its first stop without reordering', () => {
  assert.deepEqual(directionStops(walk[14], walk), walk)
  assert.notEqual(directionStops(walk[14], walk), walk)
})

test('standalone and outlying monuments never attach an unrelated themed walk', () => {
  const other = stop('outside', 99)
  assert.deepEqual(directionStops(other, walk), [other])
  assert.deepEqual(directionStops(walk[0], []), [walk[0]])
})

for (const provider of ['google', 'apple']) {
  test(`${provider}: single destination starts at Maps current location and requests walking`, () => {
    const parts = directionsParts([walk[0]], provider)
    assert.equal(parts.length, 1)
    const p = new URL(parts[0].url).searchParams
    assert.equal(p.get('destination'), coord(walk[0]))
    assert.equal(p.get('origin'), null)
    assert.equal(p.get('source'), null)
    assert.equal(p.get(provider === 'google' ? 'travelmode' : 'mode'), 'walking')
    assert.deepEqual(decode(parts[0], provider), [coord(walk[0])])
  })

  test(`${provider}: a long walk preserves every stop and connecting leg across numbered parts`, () => {
    const parts = directionsParts(walk, provider)
    assert.deepEqual(parts.flatMap((part) => decode(part, provider)), walk.map(coord))
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      const u = new URL(part.url)
      assert.equal(u.protocol, 'https:')
      assert.ok(part.url.length <= 2048)
      assert.equal(part.startNumber, i ? parts[i - 1].endNumber + 1 : 1)
      const previous = i ? walk[part.startNumber - 2] : null
      assert.equal(u.searchParams.get(provider === 'google' ? 'origin' : 'source'), previous ? coord(previous) : null)
      if (provider === 'google') {
        assert.equal(u.searchParams.get('api'), '1')
        assert.ok((u.searchParams.get('waypoints')?.split('|') ?? []).length <= 3)
      }
    }
    assert.equal(parts.at(-1).endNumber, walk.length)
  })
}

test('Apple receives all six demo walk destinations in a single ordered multistop link', () => {
  const parts = directionsParts(walk.slice(0, 6), 'apple')
  assert.equal(parts.length, 1)
  assert.equal(new URL(parts[0].url).searchParams.getAll('waypoint').length, 5)
  assert.deepEqual(decode(parts[0], 'apple'), walk.slice(0, 6).map(coord))
})

test('Google app links carry the entire six-stop demo while longer walks respect its nine-waypoint limit', () => {
  const demo = directionsParts(walk.slice(0, 6), 'google', false)
  assert.equal(demo.length, 1)
  assert.deepEqual(decode(demo[0], 'google'), walk.slice(0, 6).map(coord))
  const parts = directionsParts(walk, 'google', false)
  assert.deepEqual(parts.flatMap((part) => decode(part, 'google')), walk.map(coord))
  for (const part of parts) assert.ok((new URL(part.url).searchParams.get('waypoints')?.split('|') ?? []).length <= 9)
})

test('all real themed walks export every mapped control in the same order', () => {
  const features = JSON.parse(readFileSync(new URL('../public/statues.geojson', import.meta.url))).features
  const statues = features.map((f) => ({ ...f.properties, lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1] }))
  for (const theme of JSON.parse(readFileSync(new URL('../public/themes.json', import.meta.url)))) {
    const course = buildCourse(theme.id, statues)
    for (const provider of ['google', 'apple']) {
      assert.deepEqual(directionsParts(course.controls, provider).flatMap((part) => decode(part, provider)), course.controls.map(coord), `${theme.id}: ${provider}`)
    }
  }
})

test('an empty walk creates no external link', () => {
  assert.deepEqual(directionsParts([], 'google'), [])
  assert.deepEqual(directionsParts([], 'apple'), [])
})
