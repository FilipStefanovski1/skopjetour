import { dataLang, type DataLang, type Lang, type Statue, type StatueProps, type Theme } from './types'
import { NARRATION } from './extras'

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
  source: 'curated' | 'generated' | 'wikipedia'
}

/**
 * Use the bundled tour story when available so reading and listening tell the same story.
 * Otherwise try /content/<id>.<lang>.json, then the Wikipedia summary.
 */
let written: Promise<Set<string>> | null = null

/** The reviewed stories that exist (public/content/index.json), as "<id>.<lang>". */
function writtenStories(): Promise<Set<string>> {
  written ??= fetch('/content/index.json')
    .then((r) => (r.ok && r.headers.get('content-type')?.includes('json') ? r.json() : []))
    .then((names: string[]) => new Set(names))
    .catch(() => new Set<string>())
  return written
}

export async function loadStory(s: Statue, screenLang: Lang): Promise<Story | null> {
  // Stories exist in Macedonian and English; the other languages read the English.
  const lang = dataLang(screenLang)
  const scripted = s.statue_qid ? NARRATION[s.statue_qid]?.[lang] : undefined
  if (scripted) return { text: scripted, source: 'curated' }
  try {
    if (!(await writtenStories()).has(`${s.id}.${lang}`)) throw new Error('no written story')
    const res = await fetch(`/content/${s.id}.${lang}.json`)
    if (res.ok && res.headers.get('content-type')?.includes('json')) {
      const c: { bio: string; audio?: string } = await res.json()
      return { text: c.bio, audio: c.audio, source: 'generated' }
    }
  } catch {
    // no generated content yet
  }
  // The visitor's language first; if that Wikipedia has no article, the other one.
  const other: DataLang = lang === 'en' ? 'mk' : 'en'
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
