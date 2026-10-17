import type { ExpressionSpecification, StyleSpecification } from 'maplibre-gl'
import type { Lang } from '../types'

/**
 * Skopje redrawn in sprint-orienteering inks (after ISSprOM): white runnable ground,
 * light-brown paving, yellow open grass, olive woods, blue water, grey buildings.
 * Course purple is kept off the base map entirely; it belongs to the statues.
 */
export const INK = {
  ground: '#ffffff',
  paved: '#efdcbf',
  pavedEdge: '#c7a57d',
  open: '#ffdf6e',
  wood: '#c3d38f',
  water: '#a3cfec',
  waterEdge: '#3b87c0',
  building: '#a6a39f',
  buildingEdge: '#5f5b57',
  path: '#3a2c20',
  label: '#6b4a2b',
  rail: '#2b2b2b',
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
  return ['interpolate', ['exponential', 1.6], ['zoom'], 12, at(0.4), 15, at(2.2), 18, at(9)]
}

export function sprintMapStyle(lang: Lang): StyleSpecification {
  return {
    version: 8,
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    sources: {
      omt: { type: 'vector', url: 'https://tiles.openfreemap.org/planet', attribution: '© OpenStreetMap contributors, OpenFreeMap' },
    },
    layers: [
      { id: 'ground', type: 'background', paint: { 'background-color': INK.ground } },
      {
        id: 'grass', type: 'fill', source: 'omt', 'source-layer': 'landcover',
        filter: ['in', ['get', 'class'], ['literal', ['grass', 'farmland']]],
        paint: { 'fill-color': INK.open },
      },
      {
        id: 'park', type: 'fill', source: 'omt', 'source-layer': 'park',
        paint: { 'fill-color': INK.open, 'fill-opacity': 0.75 },
      },
      {
        id: 'wood', type: 'fill', source: 'omt', 'source-layer': 'landcover',
        filter: ['==', ['get', 'class'], 'wood'],
        paint: { 'fill-color': INK.wood },
      },
      {
        id: 'pitch', type: 'fill', source: 'omt', 'source-layer': 'landuse',
        filter: ['in', ['get', 'class'], ['literal', ['pitch', 'playground', 'stadium']]],
        paint: { 'fill-color': INK.open, 'fill-outline-color': INK.pavedEdge },
      },
      {
        id: 'water', type: 'fill', source: 'omt', 'source-layer': 'water',
        paint: { 'fill-color': INK.water, 'fill-outline-color': INK.waterEdge },
      },
      {
        id: 'river', type: 'line', source: 'omt', 'source-layer': 'waterway',
        paint: { 'line-color': INK.waterEdge, 'line-width': ['interpolate', ['linear'], ['zoom'], 12, 0.6, 17, 2] },
      },
      {
        id: 'road-edge', type: 'line', source: 'omt', 'source-layer': 'transportation',
        filter: ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'minor', 'service']]],
        layout: { 'line-cap': 'butt', 'line-join': 'round' },
        paint: {
          'line-color': INK.pavedEdge,
          'line-width': roadWidth(1.5, 1.25, 0.9),
        },
      },
      {
        id: 'road', type: 'line', source: 'omt', 'source-layer': 'transportation',
        filter: ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'minor', 'service']]],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': INK.paved,
          'line-width': roadWidth(1.25, 1.05, 0.72),
        },
      },
      {
        id: 'footway', type: 'line', source: 'omt', 'source-layer': 'transportation',
        filter: ['in', ['get', 'class'], ['literal', ['path', 'track']]],
        minzoom: 14,
        paint: { 'line-color': INK.path, 'line-width': ['interpolate', ['linear'], ['zoom'], 14, 0.6, 18, 1.6], 'line-dasharray': [3, 2] },
      },
      {
        id: 'rail', type: 'line', source: 'omt', 'source-layer': 'transportation',
        filter: ['==', ['get', 'class'], 'rail'],
        paint: { 'line-color': INK.rail, 'line-width': 1.4 },
      },
      {
        id: 'building', type: 'fill', source: 'omt', 'source-layer': 'building', minzoom: 13,
        paint: { 'fill-color': INK.building, 'fill-outline-color': INK.buildingEdge },
      },
      {
        id: 'street-name', type: 'symbol', source: 'omt', 'source-layer': 'transportation_name', minzoom: 15,
        filter: ['in', ['get', 'class'], ['literal', ['primary', 'secondary', 'tertiary', 'minor']]],
        layout: {
          'symbol-placement': 'line', 'text-field': labelField(lang), 'text-font': ['Noto Sans Regular'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 15, 10, 18, 13], 'text-letter-spacing': 0.04,
        },
        paint: { 'text-color': INK.label, 'text-halo-color': INK.paved, 'text-halo-width': 1.2 },
      },
      {
        id: 'water-name', type: 'symbol', source: 'omt', 'source-layer': 'water_name',
        layout: { 'text-field': labelField(lang), 'text-font': ['Noto Sans Italic'], 'text-size': 12, 'symbol-placement': 'line' },
        paint: { 'text-color': INK.waterEdge, 'text-halo-color': INK.ground, 'text-halo-width': 1 },
      },
      {
        id: 'quarter', type: 'symbol', source: 'omt', 'source-layer': 'place', maxzoom: 16,
        filter: ['in', ['get', 'class'], ['literal', ['suburb', 'quarter', 'neighbourhood']]],
        layout: {
          'text-field': labelField(lang), 'text-font': ['Noto Sans Bold'], 'text-size': 11,
          'text-transform': 'uppercase', 'text-letter-spacing': 0.18,
        },
        paint: { 'text-color': INK.label, 'text-halo-color': INK.ground, 'text-halo-width': 1.4 },
      },
    ],
  }
}

/** Map layers whose text follows the visitor's language. */
export const LABEL_LAYERS = ['street-name', 'water-name', 'quarter'] as const
