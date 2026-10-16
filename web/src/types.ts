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
  sources: string[]
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

export function statueName(s: Statue, lang: Lang): string {
  return lang === 'en'
    ? s.name_en ?? s.subject_en ?? s.name_mk ?? ''
    : s.name_mk ?? s.subject_mk ?? s.name_en ?? ''
}
