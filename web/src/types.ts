export type Lang = 'mk' | 'en'

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
}

export interface Statue extends StatueProps {
  lat: number
  lon: number
}

export interface Theme {
  id: string
  mk: string
  en: string
}

/** "Споменик на Даме Груев" / "Monument of Dame Gruev" read as just the person's name. */
const MONUMENT_PREFIX = /^(споменик на|споменик|спомен-обележје на|monument of|monument to|statue of|bust of)\s+/i

function displayName(raw: string): string {
  const stripped = raw.replace(MONUMENT_PREFIX, '').replace(/^[„"“]|[“"”]$/g, '').trim()
  return stripped ? stripped.charAt(0).toUpperCase() + stripped.slice(1) : raw
}

export function statueName(s: Statue, lang: Lang): string {
  const raw = lang === 'en' ? s.name_en ?? s.subject_en ?? s.name_mk ?? '' : s.name_mk ?? s.subject_mk ?? s.name_en ?? ''
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
  const d = lang === 'en' ? s.desc_en : s.desc_mk
  return d ? d.charAt(0).toUpperCase() + d.slice(1) : subjectLine(s, lang)
}

export function subjectName(s: Statue, lang: Lang): string | null {
  return lang === 'en' ? s.subject_en ?? s.subject_mk : s.subject_mk ?? s.subject_en
}
