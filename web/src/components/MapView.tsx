import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet.markercluster'
import type { Lang, Statue } from '../types'
import { statueName } from '../types'

const SKOPJE_CENTRE: L.LatLngTuple = [41.9965, 21.4314]

interface Props {
  statues: Statue[]
  lang: Lang
  selectedId: string | null
  onSelect: (id: string) => void
}

function icon(s: Statue, selected: boolean): L.DivIcon {
  const cls = ['pin', s.group === 'art-bridge' ? 'pin--bridge' : '', selected ? 'pin--selected' : '']
  return L.divIcon({ className: cls.join(' '), iconSize: [18, 18], iconAnchor: [9, 9] })
}

export function MapView({ statues, lang, selectedId, onSelect }: Props) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const cluster = useRef<L.MarkerClusterGroup | null>(null)
  const markers = useRef(new Map<string, L.Marker>())

  useEffect(() => {
    if (!el.current || map.current) return
    const m = L.map(el.current, { zoomControl: false }).setView(SKOPJE_CENTRE, 16)
    L.control.zoom({ position: 'bottomright' }).addTo(m)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(m)
    cluster.current = L.markerClusterGroup({ maxClusterRadius: 40, disableClusteringAtZoom: 18 }).addTo(m)
    map.current = m
    return () => {
      m.remove()
      map.current = null
    }
  }, [])

  // Rebuild markers when the visible set or language changes.
  useEffect(() => {
    const group = cluster.current
    if (!group) return
    group.clearLayers()
    markers.current.clear()
    for (const s of statues) {
      const marker = L.marker([s.lat, s.lon], { icon: icon(s, s.id === selectedId), title: statueName(s, lang) })
        .bindTooltip(statueName(s, lang), { direction: 'top', offset: [0, -8] })
        .on('click', () => onSelect(s.id))
      markers.current.set(s.id, marker)
      group.addLayer(marker)
    }
    // selectedId is applied by the effect below without rebuilding every marker.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statues, lang, onSelect])

  useEffect(() => {
    for (const s of statues) markers.current.get(s.id)?.setIcon(icon(s, s.id === selectedId))
    const selected = statues.find((s) => s.id === selectedId)
    if (selected && map.current) {
      map.current.flyTo([selected.lat, selected.lon], Math.max(map.current.getZoom(), 17), { duration: 0.6 })
    }
  }, [selectedId, statues])

  return <div ref={el} className="map" />
}
