import { ArrowLeft, Check, ChevronLeft, ExternalLink } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { formatDistance, metresBetween } from '../course'
import { loadStory, photoPageUrl, photoUrl, wikiUrl, type Story } from '../data'
import { t } from '../i18n'
import type { Lang, Statue, Theme } from '../types'
import { describe, statueName } from '../types'
import type { LatLon } from './MapView'
import { StatueGlyph } from './StatueGlyph'

interface Props {
  statue: Statue
  lang: Lang
  themes: Theme[]
  /** The list the visitor is walking: next and previous come from here. */
  list: Statue[]
  numbers: Map<string, number> | null
  userPos: LatLon | null
  seen: boolean
  onToggleSeen: () => void
  onNavigate: (id: string) => void
  onClose: () => void
}

/** One statue, full screen: photo first, who they were, their story, and the way to the next one. */
export function StatueDetail({ statue, lang, themes, list, numbers, userPos, seen, onToggleSeen, onNavigate, onClose }: Props) {
  const [story, setStory] = useState<Story | null | undefined>(undefined)
  const scrollRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const swipe = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    let cancelled = false
    setStory(undefined)
    loadStory(statue, lang).then((s) => !cancelled && setStory(s))
    scrollRef.current?.scrollTo({ top: 0 })
    return () => {
      cancelled = true
    }
  }, [statue, lang])

  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [onClose])

  const index = list.findIndex((s) => s.id === statue.id)
  const next = index >= 0 ? list[index + 1] : undefined
  const previous = index > 0 ? list[index - 1] : undefined
  const name = statueName(statue, lang)
  const desc = describe(statue, lang)
  const n = numbers?.get(statue.id)
  const route = statue.themes.map((id) => themes.find((th) => th.id === id)?.[lang]).filter(Boolean)[0]
  const where = n ? t('stopOf', lang, { n, m: numbers!.size }) : userPos ? t('away', lang, { d: formatDistance(metresBetween(userPos, statue)) }) : null
  const meta = [route, where].filter(Boolean).join(' · ')
  const wikiTitle = lang === 'en' ? statue.wiki_en : statue.wiki_mk
  const note = statue.position === 'approximate' ? t(statue.group === 'art-bridge' ? 'approximate' : 'estimated', lang) : null

  // A sideways swipe moves along the list, like turning a page in a guidebook.
  const onPointerDown = (e: React.PointerEvent) => (swipe.current = { x: e.clientX, y: e.clientY })
  const onPointerUp = (e: React.PointerEvent) => {
    const s = swipe.current
    swipe.current = null
    if (!s) return
    const dx = e.clientX - s.x
    const dy = e.clientY - s.y
    if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.6) return
    if (dx < 0 && next) onNavigate(next.id)
    if (dx > 0 && previous) onNavigate(previous.id)
  }

  return (
    <div className="detail" role="dialog" aria-modal="true" aria-labelledby="detail-title">
      <div ref={scrollRef} className="detail__scroll" onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
        <figure className="detail__hero">
          {statue.image ? (
            <img key={statue.id} src={photoUrl(statue.image, 1080)} alt={name} decoding="async" />
          ) : (
            <span className="detail__blank">
              <StatueGlyph size={72} />
            </span>
          )}
          <button ref={closeRef} type="button" className="round round--back" onClick={onClose} aria-label={t('backToMap', lang)}>
            <ArrowLeft aria-hidden size={22} strokeWidth={2.2} />
          </button>
          <button
            type="button"
            className={`round round--seen${seen ? ' is-on' : ''}`}
            onClick={onToggleSeen}
            aria-pressed={seen}
            aria-label={seen ? t('seen', lang) : t('markSeen', lang)}
            title={seen ? t('seen', lang) : t('markSeen', lang)}
          >
            <Check aria-hidden size={22} strokeWidth={2.6} />
          </button>
        </figure>

        <div className="detail__body">
          {meta && <p className="detail__meta">{meta}</p>}
          <h1 id="detail-title">{name}</h1>
          {desc && <p className="detail__desc">{desc}</p>}

          <div className="detail__story">
            {story === undefined && (
              <p className="story-loading" aria-label={t('loading', lang)}>
                <span />
                <span />
                <span />
              </p>
            )}
            {story === null && <p className="muted">{t('noStory', lang)}</p>}
            {story && (
              <>
                <p>{story.text}</p>
                {story.audio && <audio controls src={story.audio} preload="none" />}
              </>
            )}
          </div>

          {wikiTitle && (
            <a className="detail__more" href={wikiUrl(lang, wikiTitle)} target="_blank" rel="noreferrer">
              {t('readMore', lang)}
              <ExternalLink aria-hidden size={15} strokeWidth={2.2} />
            </a>
          )}

          {note && <p className="detail__note">{note}</p>}

          <p className="detail__credit">
            {statue.image && (
              <>
                {t('photo', lang)}:{' '}
                <a href={photoPageUrl(statue.image)} target="_blank" rel="noreferrer">
                  Wikimedia Commons
                </a>
                {story?.source === 'wikipedia' ? ' · ' : ''}
              </>
            )}
            {story?.source === 'wikipedia' && t('textWikipedia', lang)}
          </p>
        </div>
      </div>

      {(next || previous) && (
        <nav className="detail__nav" aria-label={t('walk', lang)}>
          <button
            type="button"
            className="nav-prev"
            disabled={!previous}
            onClick={() => previous && onNavigate(previous.id)}
            aria-label={previous ? `${t('previous', lang)}: ${statueName(previous, lang)}` : t('previous', lang)}
          >
            <ChevronLeft aria-hidden size={24} strokeWidth={2.2} />
          </button>
          {next ? (
            <button type="button" className="nav-next" onClick={() => onNavigate(next.id)}>
              <span className="nav-next__label">{t('next', lang)}</span>
              <span className="nav-next__name">{statueName(next, lang)}</span>
              {next.image ? <img src={photoUrl(next.image, 120)} alt="" /> : <StatueGlyph size={22} />}
            </button>
          ) : (
            <button type="button" className="nav-next nav-next--done" onClick={onClose}>
              <span className="nav-next__label">{t('endOfList', lang)}</span>
              <span className="nav-next__name">{t('backToMap', lang)}</span>
            </button>
          )}
        </nav>
      )}
    </div>
  )
}
