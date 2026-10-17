import type { ExpressionSpecification, StyleSpecification } from 'maplibre-gl'
import type { Lang } from '../types'

/** A quiet light base map: the statue photos are the colour on screen, the city stays in the background. */
const C = {
  ground: '#f4f4f9',
  park: '#dce8e6',
  wood: '#cededc',
  water: '#b8dbd9',
  waterLine: '#586f7c',
  building: '#e0e4e9',
  buildingEdge: '#cbd3db',
  road: '#ffffff',
  roadCasing: '#dce3e7',
  path: '#586f7c',
  rail: '#586f7c',
  label: '#586f7c',
  labelStrong: '#2f4550',
  waterLabel: '#586f7c',
} as const

export function labelField(lang: Lang): ExpressionSpecification {
  return lang === 'mk'
    ? ['coalesce', ['get', 'name:mk'], ['get', 'name']]
    : ['coalesce', ['get', 'name:en'], ['get', 'name:latin'], ['get', 'name']]
}

const MAJOR = ['motorway', 'trunk', 'primary']
const MID = ['secondary', 'tertiary']

/** Road width by class, growing with zoom (one zoom curve, the class picked inside each stop). */
const roadWidth = (major: number, mid: number, minor: number): ExpressionSpecification => {
  const at = (k: number): ExpressionSpecification => ['match', ['get', 'class'], MAJOR, major * k, MID, mid * k, minor * k]
  return ['interpolate', ['exponential', 1.6], ['zoom'], 12, at(0.5), 15, at(2.4), 18, at(10)]
}

const ROADS: ExpressionSpecification = ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'minor', 'service']]]
const PATHS: ExpressionSpecification = ['in', ['get', 'class'], ['literal', ['path', 'track']]]
const BRIDGES: ExpressionSpecification = ['all', ['==', ['geometry-type'], 'LineString'], ['==', ['get', 'brunnel'], 'bridge'], ['any', ROADS, PATHS]]
const bridgeWidth = (edge: number): ExpressionSpecification => ['interpolate', ['exponential', 1.6], ['zoom'],
  12, 2 + edge, 15, 6 + edge, 18, 24 + edge]

export function cityStyle(lang: Lang): StyleSpecification {
  return {
    version: 8,
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    sources: {
      omt: { type: 'vector', url: 'https://tiles.openfreemap.org/planet', attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>, <a href="https://openfreemap.org/" target="_blank" rel="noopener">OpenFreeMap</a>' },
    },
    layers: [
      { id: 'ground', type: 'background', paint: { 'background-color': C.ground } },
      { id: 'park', type: 'fill', source: 'omt', 'source-layer': 'park', paint: { 'fill-color': C.park } },
      {
        id: 'green', type: 'fill', source: 'omt', 'source-layer': 'landcover',
        filter: ['in', ['get', 'class'], ['literal', ['grass', 'wood']]],
        paint: { 'fill-color': ['match', ['get', 'class'], 'wood', C.wood, C.park] },
      },
      { id: 'water', type: 'fill', source: 'omt', 'source-layer': 'water', paint: { 'fill-color': C.water } },
      {
        id: 'river', type: 'line', source: 'omt', 'source-layer': 'waterway',
        paint: { 'line-color': C.waterLine, 'line-width': ['interpolate', ['linear'], ['zoom'], 12, 0.5, 17, 1.5] },
      },
      {
        id: 'building', type: 'fill', source: 'omt', 'source-layer': 'building', minzoom: 14,
        paint: { 'fill-color': C.building, 'fill-outline-color': C.buildingEdge },
      },
      {
        id: 'pedestrian-area', type: 'fill', source: 'omt', 'source-layer': 'transportation', minzoom: 14,
        filter: ['all', ['==', ['geometry-type'], 'Polygon'], PATHS],
        paint: { 'fill-color': C.road, 'fill-outline-color': C.roadCasing },
      },
      {
        id: 'road-casing', type: 'line', source: 'omt', 'source-layer': 'transportation', filter: ROADS,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': C.roadCasing, 'line-width': roadWidth(1.6, 1.35, 1) },
      },
      {
        id: 'road', type: 'line', source: 'omt', 'source-layer': 'transportation', filter: ROADS,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': C.road, 'line-width': roadWidth(1.3, 1.1, 0.78) },
      },
      {
        id: 'footway', type: 'line', source: 'omt', 'source-layer': 'transportation', minzoom: 15,
        filter: ['all', ['==', ['geometry-type'], 'LineString'], PATHS, ['!=', ['get', 'brunnel'], 'bridge']],
        paint: { 'line-color': C.path, 'line-width': 1, 'line-dasharray': [2, 2] },
      },
      {
        id: 'rail', type: 'line', source: 'omt', 'source-layer': 'transportation',
        filter: ['==', ['get', 'class'], 'rail'],
        paint: { 'line-color': C.rail, 'line-width': 1.2 },
      },
      {
        id: 'bridge-casing', type: 'line', source: 'omt', 'source-layer': 'transportation', filter: BRIDGES,
        layout: { 'line-cap': 'butt', 'line-join': 'round' },
        paint: { 'line-color': C.label, 'line-width': bridgeWidth(2) },
      },
      {
        id: 'bridge-deck', type: 'line', source: 'omt', 'source-layer': 'transportation', filter: BRIDGES,
        layout: { 'line-cap': 'butt', 'line-join': 'round' },
        paint: { 'line-color': C.road, 'line-width': bridgeWidth(0) },
      },
      {
        id: 'bridge-name', type: 'symbol', source: 'omt', 'source-layer': 'transportation_name', minzoom: 15,
        filter: ['==', ['get', 'brunnel'], 'bridge'],
        layout: { 'symbol-placement': 'line', 'text-field': labelField(lang), 'text-font': ['Noto Sans Regular'], 'text-size': 11 },
        paint: { 'text-color': C.labelStrong, 'text-halo-color': C.road, 'text-halo-width': 1.5 },
      },
      {
        id: 'street-name', type: 'symbol', source: 'omt', 'source-layer': 'transportation_name', minzoom: 15,
        filter: ['in', ['get', 'class'], ['literal', ['primary', 'secondary', 'tertiary', 'minor']]],
        layout: {
          'symbol-placement': 'line', 'text-field': labelField(lang), 'text-font': ['Noto Sans Regular'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 15, 10.5, 18, 13],
        },
        paint: { 'text-color': C.label, 'text-halo-color': C.road, 'text-halo-width': 1.4 },
      },
      {
        id: 'water-name', type: 'symbol', source: 'omt', 'source-layer': 'water_name',
        layout: { 'text-field': labelField(lang), 'text-font': ['Noto Sans Italic'], 'text-size': 12, 'symbol-placement': 'line' },
        paint: { 'text-color': C.waterLabel, 'text-halo-color': C.water, 'text-halo-width': 1 },
      },
      {
        id: 'quarter', type: 'symbol', source: 'omt', 'source-layer': 'place', maxzoom: 16,
        filter: ['in', ['get', 'class'], ['literal', ['suburb', 'quarter', 'neighbourhood']]],
        layout: { 'text-field': labelField(lang), 'text-font': ['Noto Sans Bold'], 'text-size': 11, 'text-letter-spacing': 0.06 },
        paint: { 'text-color': C.labelStrong, 'text-halo-color': C.ground, 'text-halo-width': 1.6 },
      },
    ],
  }
}

/** Map layers whose text follows the visitor's language. */
export const LABEL_LAYERS = ['street-name', 'bridge-name', 'water-name', 'quarter'] as const
