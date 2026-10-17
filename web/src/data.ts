import type { Lang, Statue, StatueProps, Theme } from './types'

interface Feature {
  geometry: { coordinates: [number, number] }
  properties: StatueProps
}

export async function loadStatues(): Promise<Statue[]> {
  const res = await fetch('/statues.geojson')
  const fc: { features: Feature[] } = await res.json()
  return fc.features.map((f) => ({
    ...f.properties,
    lon: f.geometry.coordinates[0],
    lat: f.geometry.coordinates[1],
  }))
}

export async function loadThemes(): Promise<Theme[]> {
  const res = await fetch('/themes.json')
  return res.json()
}

export function photoUrl(file: string, width = 640): string {
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=${width}`
}

export function photoPageUrl(file: string): string {
  return `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file.replace(/ /g, '_'))}`
}

export function wikiUrl(lang: Lang, title: string): string {
  return `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`
}

export interface Story {
  text: string
  audio?: string
  source: 'generated' | 'wikipedia'
}

/**
 * A statue's story in the visitor's language. Pre-generated biographies in
 * /content/<id>.<lang>.json win; until those exist, fall back to the Wikipedia summary.
 */
export async function loadStory(s: Statue, lang: Lang): Promise<Story | null> {
  try {
    const res = await fetch(`/content/${s.id}.${lang}.json`)
    if (res.ok && res.headers.get('content-type')?.includes('json')) {
      const c: { bio: string; audio?: string } = await res.json()
      return { text: c.bio, audio: c.audio, source: 'generated' }
    }
  } catch {
    // no generated content yet
  }
  // The visitor's language first; if that Wikipedia has no article, the other one.
  const other: Lang = lang === 'en' ? 'mk' : 'en'
  for (const l of [lang, other]) {
    const title = l === 'en' ? s.wiki_en : s.wiki_mk
    if (!title) continue
    try {
      const res = await fetch(`https://${l}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`)
      if (!res.ok) continue
      const summary: { extract?: string } = await res.json()
      if (summary.extract) return { text: summary.extract, source: 'wikipedia' }
    } catch {
      // offline or blocked: try the other language, then give up
    }
  }
  return null
}
