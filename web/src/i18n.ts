import type { Lang } from './types'

const strings = {
  title: { mk: 'Споменици на Скопје', en: 'Skopje Statues' },
  all: { mk: 'Сите', en: 'All' },
  routes: { mk: 'Рути', en: 'Routes' },
  statues: { mk: 'Споменици', en: 'Statues' },
  search: { mk: 'Пребарај споменик', en: 'Find a statue' },
  clearSearch: { mk: 'Исчисти', en: 'Clear' },
  noMatch: { mk: 'Нема споменик „{q}“.', en: 'No statue matches “{q}”.' },
  stopOf: { mk: '{n} од {m}', en: '{n} of {m}' },
  away: { mk: '{d} од тебе', en: '{d} away' },
  next: { mk: 'Следен', en: 'Next' },
  previous: { mk: 'Претходен', en: 'Previous' },
  endOfList: { mk: 'Тоа е последниот', en: 'That was the last one' },
  backToMap: { mk: 'Назад кон мапата', en: 'Back to the map' },
  walk: { mk: 'Прошетка', en: 'Walk' },
  markSeen: { mk: 'Означи како видено', en: 'Mark as seen' },
  seen: { mk: 'Видено', en: 'Seen' },
  readMore: { mk: 'Цела приказна на Википедија', en: 'Full story on Wikipedia' },
  noStory: {
    mk: 'За овој споменик сè уште нема приказна.',
    en: "There's no story for this statue yet.",
  },
  approximate: {
    mk: 'Точната позиција на Мостот на уметноста ќе се провери на терен.',
    en: 'Its exact spot on the Art Bridge is still to be confirmed on site.',
  },
  estimated: {
    mk: 'Позицијата е проценета од фотографии и може да отстапува.',
    en: 'Position estimated from photos; it may be a little off.',
  },
  photo: { mk: 'Фото', en: 'Photo' },
  textWikipedia: { mk: 'Текст: Википедија', en: 'Text: Wikipedia' },
  loading: { mk: 'Се вчитува…', en: 'Loading…' },
  loadError: { mk: 'Спомениците не се вчитаа.', en: "The statues didn't load." },
  retry: { mk: 'Обиди се пак', en: 'Try again' },
  locate: { mk: 'Каде сум', en: 'Where am I' },
  locateError: { mk: 'Локацијата не е достапна.', en: 'Your location is unavailable.' },
  map: { mk: 'Мапа на спомениците', en: 'Map of the statues' },
} satisfies Record<string, Record<Lang, string>>

export type StringKey = keyof typeof strings

export function t(key: StringKey, lang: Lang, vars?: Record<string, string | number>): string {
  let s: string = strings[key][lang]
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v))
  return s
}
