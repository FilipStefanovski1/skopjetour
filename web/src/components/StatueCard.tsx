import { ArrowLeft, ArrowRight, Check, ExternalLink } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Course } from '../course'
import { formatDistance } from '../course'
import { loadStory, photoPageUrl, photoUrl, wikiUrl, type Story } from '../data'
import { t } from '../i18n'
import type { Lang, Statue, Theme } from '../types'
import { statueName, subjectLine } from '../types'
import { ControlMark } from './ControlMark'

interface Props {
  statue: Statue
  lang: Lang
  themes: Theme[]
  course: Course | null
  seen: boolean
  onToggleSeen: () => void
  onSelect: (id: string) => void
  onBack: () => void
}

const SOURCE_LABEL: Record<string, string> = {
  osm: 'OpenStreetMap',
  wikidata: 'Wikidata',
  commons: 'Wikimedia Commons',
  'art-bridge': 'Wikipedia',
}

/** One statue as a control description: symbol, name, photo, description rows, story, and the next stop. */
export function StatueCard({ statue, lang, themes, course, seen, onToggleSeen, onSelect, onBack }: Props) {
  const [story, setStory] = useState<Story | null | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    setStory(undefined)
    loadStory(statue, lang).then((s) => !cancelled && setStory(s))
    return () => {
      cancelled = true
    }
  }, [statue, lang])

  const index = course ? course.controls.findIndex((c) => c.id === statue.id) : -1
  const leg = index > 0 ? course!.legs[index - 1] : null
  const next = index >= 0 && index < course!.controls.length - 1 ? course!.controls[index + 1] : null
  const previous = index > 0 ? course!.controls[index - 1] : null
  const name = statueName(statue, lang)
  const subject = subjectLine(statue, lang)
  const wikiTitle = lang === 'en' ? statue.wiki_en : statue.wiki_mk
  const routeNames = statue.themes.map((id) => themes.find((th) => th.id === id)?.[lang]).filter(Boolean)
  const note = statue.position === 'approximate' ? t(statue.group === 'art-bridge' ? 'approximate' : 'estimated', lang) : null

  return (
    <article className="card" aria-labelledby="card-title">
      <nav className="card-nav">
        <button type="button" className="text-button" onClick={onBack}>
          <ArrowLeft aria-hidden size={17} strokeWidth={2.25} />
          {t('backToList', lang)}
        </button>
        {previous && (
          <button type="button" className="text-button" onClick={() => onSelect(previous.id)} aria-label={`${t('previous', lang)}: ${statueName(previous, lang)}`}>
            {t('previous', lang)}
          </button>
        )}
      </nav>

      <header className="card-head">
        <ControlMark kind={index === 0 ? 'start' : index > 0 ? 'control' : 'plain'} n={index >= 0 ? index + 1 : undefined} seen={seen} />
        <h2 id="card-title">{name}</h2>
        {leg && <span className="card-head__leg">{formatDistance(leg.metres)}</span>}
      </header>

      {statue.image && (
        <figure className="card-photo">
          <img src={photoUrl(statue.image, 800)} alt={name} loading="lazy" />
          <figcaption>
            {t('photo', lang)}:{' '}
            <a href={photoPageUrl(statue.image)} target="_blank" rel="noreferrer">
              Wikimedia Commons
            </a>
          </figcaption>
        </figure>
      )}

      <table className="description">
        <tbody>
          {subject && (
            <tr>
              <th scope="row">{t('depicts', lang)}</th>
              <td>{subject}</td>
            </tr>
          )}
          {routeNames.length > 0 && (
            <tr>
              <th scope="row">{t('route', lang)}</th>
              <td>{routeNames.join(' · ')}</td>
            </tr>
          )}
          {leg && (
            <tr>
              <th scope="row">{t('fromLast', lang)}</th>
              <td className="num">
                {formatDistance(leg.metres)} · {leg.minutes} {t('minutes', lang)} {t('walk', lang)}
              </td>
            </tr>
          )}
          <tr>
            <th scope="row">{t('position', lang)}</th>
            <td>{note ?? t('mapped', lang)}</td>
          </tr>
          <tr>
            <th scope="row">{t('sources', lang)}</th>
            <td>{statue.sources.map((s) => SOURCE_LABEL[s] ?? s).join(', ')}</td>
          </tr>
        </tbody>
      </table>

      <div className="story">
        {story === undefined && (
          <p className="story__loading" aria-label={t('loading', lang)}>
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
        {wikiTitle && (
          <a className="link" href={wikiUrl(lang, wikiTitle)} target="_blank" rel="noreferrer">
            {t('readMore', lang)}
            <ExternalLink aria-hidden size={14} strokeWidth={2.25} />
          </a>
        )}
      </div>

      <footer className="card-actions">
        <button type="button" className={`button button--secondary${seen ? ' is-on' : ''}`} aria-pressed={seen} onClick={onToggleSeen}>
          <Check aria-hidden size={18} strokeWidth={2.5} />
          {seen ? t('seen', lang) : t('markSeen', lang)}
        </button>
        {next && (
          <button type="button" className="button button--primary" onClick={() => onSelect(next.id)}>
            <span>
              {t('next', lang)}
              <small>
                {index + 2}. {statueName(next, lang)}
              </small>
            </span>
            <ArrowRight aria-hidden size={20} strokeWidth={2.5} />
          </button>
        )}
      </footer>
    </article>
  )
}
