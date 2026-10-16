import type { Lang } from './types'

const strings = {
  title: { mk: 'Споменици на Скопје', en: 'Statues of Skopje' },
  all: { mk: 'Сите', en: 'All' },
  statues: { mk: 'споменици', en: 'statues' },
  close: { mk: 'Затвори', en: 'Close' },
  depicts: { mk: 'Прикажува', en: 'Depicts' },
  readMore: { mk: 'Прочитај на Википедија', en: 'Read on Wikipedia' },
  noStory: {
    mk: 'Приказната за овој споменик сè уште се пишува.',
    en: "This statue's story is still being written.",
  },
  approximate: {
    mk: 'Приближна позиција на Мостот на уметноста: ќе се прецизира по теренската проверка.',
    en: 'Approximate position on the Art Bridge: to be confirmed on site.',
  },
  estimated: {
    mk: 'Позицијата е проценета од фотографии и може да отстапува за неколку десетици метри.',
    en: 'Position estimated from photos; it may be off by a few dozen metres.',
  },
  loading: { mk: 'Се вчитува…', en: 'Loading…' },
  photo: { mk: 'Фотографија: Wikimedia Commons', en: 'Photo: Wikimedia Commons' },
} satisfies Record<string, Record<Lang, string>>

export type StringKey = keyof typeof strings

export function t(key: StringKey, lang: Lang): string {
  return strings[key][lang]
}
