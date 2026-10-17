import type { Lang } from './types'

const strings = {
  title: { mk: 'Споменици на Скопје', en: 'Skopje Statues' },
  allStatues: { mk: 'Сите споменици', en: 'All statues' },
  statues: { mk: 'споменици', en: 'statues' },
  minutes: { mk: 'мин', en: 'min' },
  walk: { mk: 'пешки', en: 'walk' },
  search: { mk: 'Пребарај споменик', en: 'Find a statue' },
  clearSearch: { mk: 'Исчисти пребарување', en: 'Clear search' },
  noMatch: { mk: 'Нема споменик „{q}“.', en: 'No statue matches “{q}”.' },
  beyond: { mk: 'Подалеку од центарот', en: 'Further out' },
  seenOf: { mk: '{n} од {m} видени', en: '{n} of {m} seen' },
  start: { mk: 'Старт', en: 'Start' },
  finish: { mk: 'Цел', en: 'Finish' },
  next: { mk: 'Следен споменик', en: 'Next statue' },
  previous: { mk: 'Претходен', en: 'Previous' },
  markSeen: { mk: 'Означи како видено', en: 'Mark as seen' },
  seen: { mk: 'Видено', en: 'Seen' },
  backToList: { mk: 'Назад кон списокот', en: 'Back to the list' },
  close: { mk: 'Затвори', en: 'Close' },
  depicts: { mk: 'Прикажува', en: 'Depicts' },
  route: { mk: 'Рута', en: 'Route' },
  fromLast: { mk: 'Од претходниот', en: 'From last stop' },
  position: { mk: 'Позиција', en: 'Position' },
  mapped: { mk: 'Мапирана', en: 'Mapped' },
  sources: { mk: 'Извори', en: 'Sources' },
  readMore: { mk: 'Прочитај на Википедија', en: 'Read on Wikipedia' },
  noStory: {
    mk: 'Приказната за овој споменик сè уште се пишува.',
    en: "This statue's story is still being written.",
  },
  approximate: {
    mk: 'Приближна позиција на Мостот на уметноста: ќе се прецизира на терен.',
    en: 'Approximate position on the Art Bridge, to be confirmed on site.',
  },
  estimated: {
    mk: 'Позицијата е проценета од фотографии и може да отстапува за неколку десетици метри.',
    en: 'Position estimated from photos; it may be off by a few dozen metres.',
  },
  loading: { mk: 'Се вчитува…', en: 'Loading…' },
  loadingStatues: { mk: 'Се вчитуваат спомениците…', en: 'Loading the statues…' },
  loadError: {
    mk: 'Спомениците не се вчитаа. Проверете ја врската.',
    en: "The statues didn't load. Check your connection.",
  },
  retry: { mk: 'Обиди се пак', en: 'Try again' },
  photo: { mk: 'Фото', en: 'Photo' },
  locate: { mk: 'Покажи каде сум', en: 'Show my location' },
  locateError: { mk: 'Локацијата не е достапна.', en: 'Your location is unavailable.' },
  zoomIn: { mk: 'Зумирај', en: 'Zoom in' },
  zoomOut: { mk: 'Одзумирај', en: 'Zoom out' },
  fitCourse: { mk: 'Цела рута', en: 'Whole route' },
  expand: { mk: 'Прошири', en: 'Expand' },
  collapse: { mk: 'Собери', en: 'Collapse' },
  routes: { mk: 'Рути', en: 'Routes' },
  map: { mk: 'Мапа на спомениците', en: 'Map of the statues' },
} satisfies Record<string, Record<Lang, string>>

export type StringKey = keyof typeof strings

export function t(key: StringKey, lang: Lang, vars?: Record<string, string | number>): string {
  let s: string = strings[key][lang]
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v))
  return s
}
