import { ChevronRight } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { formatDistance, metresBetween } from '../course'
import { photoUrl } from '../data'
import { t } from '../i18n'
import type { Lang, Statue } from '../types'
import { describe, statueName } from '../types'
import type { LatLon } from './MapView'
import { StatueGlyph } from './StatueGlyph'

interface Props {
  items: Statue[]
  activeId: string | null
  lang: Lang
  /** 1-based stop numbers when a route is chosen. */
  numbers: Map<string, number> | null
  userPos: LatLon | null
  seen: Set<string>
  onActive: (id: string) => void
  onOpen: (id: string) => void
}

/** The swipeable row of statue cards along the bottom; the centred card is the one on the map. */
export function Carousel({ items, activeId, lang, numbers, userPos, seen, onActive, onOpen }: Props) {
  const listRef = useRef<HTMLUListElement>(null)
  const settleTimer = useRef(0)
  const programmatic = useRef(false)
  const lastActive = useRef<string | null>(null)
  const lastItems = useRef<Statue[] | null>(null)
  const followTimer = useRef(0)

  // Follow the map: when a pin is tapped, slide its card into the middle.
  useEffect(() => {
    const list = listRef.current
    if (!list || !activeId || (activeId === lastActive.current && items === lastItems.current)) return
    lastActive.current = activeId
    lastItems.current = items
    const card = list.querySelector<HTMLElement>(`[data-id="${CSS.escape(activeId)}"]`)
    if (!card) return
    programmatic.current = true
    list.scrollTo({ left: card.offsetLeft - (list.clientWidth - card.offsetWidth) / 2, behavior: 'smooth' })
    window.clearTimeout(followTimer.current)
    followTimer.current = window.setTimeout(() => (programmatic.current = false), 650)
  }, [activeId, items])

  useEffect(() => () => {
    window.clearTimeout(settleTimer.current)
    window.clearTimeout(followTimer.current)
  }, [])

  const onScroll = () => {
    window.clearTimeout(settleTimer.current)
    settleTimer.current = window.setTimeout(() => {
      const list = listRef.current
      if (!list || programmatic.current) return
      const middle = list.scrollLeft + list.clientWidth / 2
      let best: HTMLElement | null = null
      for (const card of list.querySelectorAll<HTMLElement>('[data-id]')) {
        if (!best || Math.abs(card.offsetLeft + card.offsetWidth / 2 - middle) < Math.abs(best.offsetLeft + best.offsetWidth / 2 - middle)) {
          best = card
        }
      }
      const id = best?.dataset.id
      if (id && id !== lastActive.current) {
        lastActive.current = id
        onActive(id)
      }
    }, 110)
  }

  return (
    <ul ref={listRef} className="cards" onScroll={onScroll} aria-label={t('statues', lang)}>
      {items.map((s) => {
        const n = numbers?.get(s.id)
        const meta = n
          ? t('stopOf', lang, { n, m: numbers!.size })
          : userPos
            ? formatDistance(metresBetween(userPos, s))
            : null
        return (
          <li key={s.id} data-id={s.id}>
            <button
              type="button"
              className={`card${s.id === activeId ? ' is-active' : ''}`}
              onClick={() => onOpen(s.id)}
            >
              <span className="card__photo">
                {s.image ? <img src={photoUrl(s.image, 240)} alt="" loading="lazy" decoding="async" /> : <StatueGlyph />}
                {seen.has(s.id) && <span className="card__seen">{t('seen', lang)}</span>}
              </span>
              <span className="card__text">
                <span className="card__name">{statueName(s, lang)}</span>
                {describe(s, lang) && <span className="card__desc">{describe(s, lang)}</span>}
                {meta && <span className="card__meta">{meta}</span>}
              </span>
              <ChevronRight className="card__go" aria-hidden size={20} strokeWidth={2.2} />
            </button>
          </li>
        )
      })}
    </ul>
  )
}
