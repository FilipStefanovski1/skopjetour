import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { featureFilter, validateStyleMin } from '@maplibre/maplibre-gl-style-spec'
import { cityStyle } from '../src/map/style.ts'
import { buildCourse, CITY_CENTRE, courseCoordinates, metresBetween, nearbyStatues, nextStop } from '../src/course.ts'

const statue = (id, lat, lon, themes = ['walk']) => ({ id, lat, lon, themes })
const origin = { lat: CITY_CENTRE[0], lon: CITY_CENTRE[1] }
const a = statue('a', origin.lat, origin.lon)
const b = statue('b', origin.lat + 0.001, origin.lon)
const c = statue('c', origin.lat + 0.002, origin.lon)

test('nearby ordering follows a moving visitor without mutating source data', () => {
  const input = [c, a, b]
  assert.deepEqual(nearbyStatues(input, a).map(s => s.id), ['a', 'b', 'c'])
  assert.deepEqual(nearbyStatues(input, c).map(s => s.id), ['c', 'b', 'a'])
  assert.deepEqual(input.map(s => s.id), ['c', 'a', 'b'])
})

test('next suggestion skips visits and returns null when everything is visited', () => {
  assert.equal(nextStop([a, b, c], new Set(['a']), null)?.id, 'b')
  assert.equal(nextStop([a, b, c], new Set(['a', 'b', 'c']), null), null)
  assert.equal(nextStop([], new Set(), null), null)
  assert.equal(nextStop([a, b, c], new Set(), null)?.id, 'a')
})

test('walk suggestions preserve route order even when GPS proximity differs', () => {
  const course = buildCourse('walk', [c, a, b])
  assert.equal(nextStop([c, b, a], new Set(['a']), course)?.id, 'b')
  assert.equal(nextStop([c, b, a], new Set(['a', 'b', 'c']), course), null)
})

test('distant themed monuments are listed separately, never suggested as walk stops', () => {
  const distant = statue('distant', origin.lat + 0.1, origin.lon)
  const course = buildCourse('walk', [a, b, distant])
  assert.deepEqual(course.beyond.map(s => s.id), ['distant'])
  assert.equal(nextStop([distant, a, b], new Set(['a', 'b']), course), null)
  assert.equal(buildCourse('missing', [a]).controls.length, 0)
})

test('real themed walks contain unique matching stops within the walking radius', () => {
  const data = JSON.parse(readFileSync(new URL('../public/statues.geojson', import.meta.url)))
  const statues = data.features.map(f => ({ ...f.properties, lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1] }))
  const themes = JSON.parse(readFileSync(new URL('../public/themes.json', import.meta.url)))
  for (const theme of themes) {
    const course = buildCourse(theme.id, statues)
    assert.ok(course.controls.length > 0, theme.id)
    assert.equal(new Set(course.controls.map(s => s.id)).size, course.controls.length)
    assert.ok(course.controls.every(s => s.themes.includes(theme.id) && metresBetween(origin, s) <= 1500))
    assert.ok(Number.isFinite(course.minutes) && course.minutes > 0)
  }
})

test('a personalised walk starts at the visitor, selects their nearest stop, and includes the approach distance', () => {
  const position = { lat: c.lat + 0.001, lon: c.lon }
  const course = buildCourse('walk', [a, b, c], position)
  assert.equal(course.controls[0].id, 'c')
  assert.deepEqual(courseCoordinates(course), [[position.lon, position.lat], [c.lon, c.lat], [b.lon, b.lat], [a.lon, a.lat]])
  const single = buildCourse('walk', [a], position)
  assert.ok(Math.abs(single.metres - metresBetween(position, a) * 1.25) < 0.01)
  assert.equal(courseCoordinates(buildCourse('absent', [a], position)).length, 0)
})

test('map style renders pedestrian bridge lines and surfaces above the water', () => {
  const style = cityStyle('en')
  assert.deepEqual(validateStyleMin(style), [])
  const deck = style.layers.find((l) => l.id === 'bridge-deck')
  const area = style.layers.find((l) => l.id === 'pedestrian-area')
  const path = style.layers.find((l) => l.id === 'footway')
  const bridge = { type: 2, properties: { class: 'path', subclass: 'pedestrian', brunnel: 'bridge' } }
  assert.ok(featureFilter(deck.filter, 'layers.bridge-deck.filter').filter({ zoom: 16 }, bridge))
  assert.ok(featureFilter(area.filter, 'layers.pedestrian-area.filter').filter({ zoom: 16 }, { type: 3, properties: { class: 'path', subclass: 'pedestrian' } }))
  assert.equal(featureFilter(path.filter, 'layers.footway.filter').filter({ zoom: 16 }, bridge), false)
  assert.ok(style.layers.indexOf(deck) > style.layers.findIndex((l) => l.id === 'water'))
  assert.ok(style.layers.indexOf(area) > style.layers.findIndex((l) => l.id === 'water'))
})
