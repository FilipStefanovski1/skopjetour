import { useEffect, useState } from 'react'
import type { Lang, Statue, Theme } from '../types'
import { statueName } from '../types'
import { loadStory, photoUrl, wikiUrl, type Story } from '../data'
import { t } from '../i18n'

interface Props {
  statue: Statue
  lang: Lang
  themes: Theme[]
  onClose: () => void
}

export function StatueCard({ statue, lang, themes, onClose }: Props) {
  const [story, setStory] = useState<Story | null | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    setStory(undefined)
    loadStory(statue, lang).then((s) => !cancelled && setStory(s))
    return () => {
      cancelled = true
    }
  }, [statue, lang])

  const name = statueName(statue, lang)
  const subject = lang === 'en' ? statue.subject_en : statue.subject_mk
  const wikiTitle = lang === 'en' ? statue.wiki_en : statue.wiki_mk

  return (
    <article className="card" aria-label={name}>
      <button className="card__close" onClick={onClose} aria-label={t('close', lang)}>
        ×
      </button>
      {statue.image && (
        <figure className="card__photo">
          <img src={photoUrl(statue.image)} alt={name} loading="lazy" />
          <figcaption>{t('photo', lang)}</figcaption>
        </figure>
      )}
      <div className="card__body">
        <h2>{name}</h2>
        {subject && subject !== name && (
          <p className="card__subject">
            {t('depicts', lang)}: {subject}
          </p>
        )}
        {statue.themes.length > 0 && (
          <ul className="card__themes">
            {statue.themes.map((id) => {
              const theme = themes.find((th) => th.id === id)
              return theme ? <li key={id}>{theme[lang]}</li> : null
            })}
          </ul>
        )}
        {statue.position === 'approximate' && <p className="card__note">{t('approximate', lang)}</p>}
        {story === undefined && <p className="card__muted">{t('loading', lang)}</p>}
        {story === null && <p className="card__muted">{t('noStory', lang)}</p>}
        {story && (
          <>
            <p className="card__story">{story.text}</p>
            {story.audio && <audio controls src={story.audio} preload="none" />}
          </>
        )}
        {wikiTitle && (
          <a className="card__link" href={wikiUrl(lang, wikiTitle)} target="_blank" rel="noreferrer">
            {t('readMore', lang)} ↗
          </a>
        )}
      </div>
    </article>
  )
}
