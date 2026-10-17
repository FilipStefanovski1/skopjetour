import { readFile, writeFile } from 'node:fs/promises'

// Download once when refreshing data, never from visitors' browsers.
const bounds = [41.967, 21.39, 42.025, 21.47] // south, west, north, east
const rawPath = new URL('../../data/raw/walking-network.json', import.meta.url)
if (!process.argv.includes('--offline')) {
  const query = `[out:json][timeout:60];way[highway](${bounds.join(',')});(._;>;);out body;`
  const endpoint = process.env.OVERPASS_URL || 'https://overpass-api.de/api/interpreter'
  const response = await fetch(`${endpoint}?${new URLSearchParams({ data: query })}`, {
    headers: { 'User-Agent': 'SkopjeStatues-data-builder (https://github.com/FilipStefanovski1/skopjetour)' },
    signal: AbortSignal.timeout(90000),
  })
  if (!response.ok) throw new Error(`Overpass: ${response.status} ${(await response.text()).slice(0, 2000)}`)
  const raw = await response.json()
  if (raw.remark || !raw.elements?.length) throw new Error(raw.remark || 'Empty network')
  await writeFile(rawPath, JSON.stringify(raw))
}
const raw = JSON.parse(await readFile(rawPath, 'utf8'))
const allowed = new Set(['footway', 'pedestrian', 'path', 'steps', 'living_street', 'residential', 'service', 'track', 'unclassified', 'tertiary', 'tertiary_link', 'secondary', 'secondary_link', 'primary', 'primary_link', 'cycleway'])
const publicFoot = new Set(['yes', 'designated', 'permissive'])
const denied = new Set(['no', 'private', 'customers', 'delivery', 'destination', 'permit'])
function accessible(tags = {}) {
  if (tags['foot:conditional'] || tags['access:conditional']) return false
  if (publicFoot.has(tags.foot)) return true
  return !denied.has(tags.foot) && !denied.has(tags.access)
}
const sourceNodes = new Map(raw.elements.filter(e => e.type === 'node').map(n => [n.id, n]))
const nodes = [], edges = [], nodeIndex = new Map(), unique = new Set()
function index(id) {
  if (!nodeIndex.has(id)) {
    const n = sourceNodes.get(id)
    nodeIndex.set(id, nodes.length)
    nodes.push([n.lon, n.lat])
  }
  return nodeIndex.get(id)
}
for (const way of raw.elements.filter(e => e.type === 'way')) {
  const t = way.tags ?? {}
  if (!allowed.has(t.highway) || !accessible(t) || t.indoor === 'yes' || t.conveying ||
      (t.highway === 'cycleway' && !publicFoot.has(t.foot)) ||
      (t.sidewalk === 'separate' && !publicFoot.has(t.foot))) continue
  // OSM areas use their mapped perimeter; never invent shortcuts across a polygon.
  for (let i = 1; i < way.nodes.length; i++) {
    const left = sourceNodes.get(way.nodes[i - 1]), right = sourceNodes.get(way.nodes[i])
    if (!left || !right || !accessible(left.tags) || !accessible(right.tags)) continue
    if ([left, right].some(n => ['wall', 'fence', 'retaining_wall'].includes(n.tags?.barrier) && !publicFoot.has(n.tags?.foot))) continue
    const a = index(left.id), b = index(right.id)
    if (a === b) continue
    // Vehicle one-way rules do not apply to walkers. Only explicit foot rules do.
    const direction = ['yes', '1', 'true'].includes(t['oneway:foot']) ? 1 : t['oneway:foot'] === '-1' ? -1 : 0
    const key = `${a},${b},${direction}`
    if (unique.has(key)) continue
    unique.add(key)
    edges.push([a, b, direction, t.bridge && t.bridge !== 'no' ? 1 : 0])
  }
}
const network = {
  version: 1, source: 'OpenStreetMap contributors', license: 'ODbL-1.0',
  sourceUrl: 'https://www.openstreetmap.org/copyright',
  timestamp: raw.osm3s.timestamp_osm_base, bounds, nodes, edges,
}
await writeFile(new URL('../src/map/walking-network.json', import.meta.url), JSON.stringify(network))
console.log(`${nodes.length} nodes, ${edges.length} walking edges; OSM ${network.timestamp}`)
