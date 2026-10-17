/** The languages the app's screens speak. */
export type Lang = 'mk' | 'en' | 'sq' | 'tr' | 'sr' | 'es' | 'de'

/** Statue names, descriptions and stories exist in Macedonian and English; every other language reads the English. */
export type DataLang = 'mk' | 'en'

export const dataLang = (lang: Lang): DataLang => (lang === 'mk' ? 'mk' : 'en')

/** In each language's own name, for the language picker. */
export const LANGS: { code: Lang; name: string }[] = [
  { code: 'mk', name: 'Македонски' },
  { code: 'en', name: 'English' },
  { code: 'sq', name: 'Shqip' },
  { code: 'tr', name: 'Türkçe' },
  { code: 'sr', name: 'Srpski' },
  { code: 'es', name: 'Español' },
  { code: 'de', name: 'Deutsch' },
]

export const isLang = (code: unknown): code is Lang => LANGS.some((l) => l.code === code)

export interface StatueProps {
  id: string
  name_mk: string | null
  name_en: string | null
  subject_qid: string | null
  subject_mk: string | null
  subject_en: string | null
  statue_qid: string | null
  image: string | null
  wiki_mk: string | null
  wiki_en: string | null
  group: string | null
  order: number | null
  side: 'left' | 'right' | 'centre' | null
  position: 'mapped' | 'walked' | 'approximate'
  themes: string[]
  aliases: string[]
  sources: string[]
  desc_mk?: string | null
  desc_en?: string | null
  person_image?: string | null
  /** Collection number, like a field guide's. */
  no: number
  /** From the plaque details mapped in OpenStreetMap, where there are any. */
  year: number | null
  height: number | null
  material: string | null
  artist_mk: string | null
  artist_en: string | null
}

export interface Statue extends StatueProps {
  lat: number
  lon: number
}

export interface Theme {
  id: string
  mk: string
  en: string
  sq?: string
  tr?: string
  sr?: string
  es?: string
  de?: string
}

export function themeName(th: Theme, lang: Lang): string {
  return th[lang] ?? th.en
}

/** "Споменик на Даме Груев" / "Monument of Dame Gruev" read as just the person's name. */
const MONUMENT_PREFIX = /^(споменик на|споменик|спомен-обележје на|monument of|monument to|statue of|bust of)\s+/i

function displayName(raw: string): string {
  const stripped = raw.replace(MONUMENT_PREFIX, '').replace(/^[„"“]|[“"”]$/g, '').trim()
  return stripped ? stripped.charAt(0).toUpperCase() + stripped.slice(1) : raw
}

/** The picture for a statue's thumbnail: a photo of it, else a portrait of the person it shows. */
export function coverFile(s: Statue): string | null {
  return s.image ?? s.person_image ?? null
}

export function statueName(s: Statue, lang: Lang): string {
  const raw = dataLang(lang) === 'en' ? s.name_en ?? s.subject_en ?? s.name_mk ?? '' : s.name_mk ?? s.subject_mk ?? s.name_en ?? ''
  return displayName(raw)
}

function fold(s: string): string {
  return s.toLowerCase().normalize('NFKD').replace(/[\p{Diacritic}\p{P}\s]/gu, '')
}

/** The depicted person, only when it says something the statue's name does not. */
export function subjectLine(s: Statue, lang: Lang): string | null {
  const subject = subjectName(s, lang)
  return subject && !fold(statueName(s, lang)).startsWith(fold(subject)) ? subject : null
}

/** One line on who or what this is ("Macedonian writer (1935–1987)"), in the visitor's language. */
export function describe(s: Statue, lang: Lang): string | null {
  const d = dataLang(lang) === 'en' ? s.desc_en : s.desc_mk
  return d ? d.charAt(0).toUpperCase() + d.slice(1) : subjectLine(s, lang)
}

export function subjectName(s: Statue, lang: Lang): string | null {
  return dataLang(lang) === 'en' ? s.subject_en ?? s.subject_mk : s.subject_mk ?? s.subject_en
}
