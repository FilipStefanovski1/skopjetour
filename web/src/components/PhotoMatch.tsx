import { Camera, X } from 'lucide-react'
import { useEffect, useState, type CSSProperties } from 'react'
import { photoUrl } from '../data'
import { t } from '../i18n'
import { certainty, recognise, type Match } from '../recognize'
import type { Lang, Statue } from '../types'
import { coverFile, describe, statueName } from '../types'
import { StatueGlyph } from './StatueGlyph'

interface Props {
  photo: File
  statues: Statue[]
  near: { lat: number; lon: number } | null
  lang: Lang
  onPick: (id: string) => void
  onRetake: () => void
  onClose: () => void
}

/** The visitor's photo, the model at work, and its best guesses to confirm. */
export function PhotoMatch({ photo, statues, near, lang, onPick, onRetake, onClose }: Props) {
  const [preview, setPreview] = useState<string | null>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [matches, setMatches] = useState<Match[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const url = URL.createObjectURL(photo)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [photo])

  useEffect(() => {
    let cancelled = false
    recognise(photo, statues, near, (p) => !cancelled && setProgress(p))
      .then((m) => !cancelled && setMatches(m))
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
    }
  }, [photo, statues, near])

  const byId = new Map(statues.map((s) => [s.id, s]))
  const best = matches?.[0]
  const unsure = best && matches ? certainty(best, matches) !== 'sure' : false

  return (
    <div className="match" role="dialog" aria-modal="true" aria-labelledby="match-title">
      <figure className={`match__photo${matches || failed ? '' : ' is-working'}`}>
        {preview && <img src={preview} alt="" />}
        <button type="button" className="round round--back" onClick={onClose} aria-label={t('close', lang)}>
          <X aria-hidden size={22} strokeWidth={2.2} />
        </button>
      </figure>

      <div className="match__sheet">
        {failed ? (
          <>
            <h2 id="match-title">{t('matchFailed', lang)}</h2>
            <p className="muted">{t('matchFailedBody', lang)}</p>
          </>
        ) : !matches ? (
          <>
            <h2 id="match-title">{progress !== null && progress < 1 ? t('loadingModel', lang, { p: Math.round(progress * 100) }) : t('recognising', lang)}</h2>
            <p className="muted">{t('recognisingBody', lang)}</p>
            <div className="progress progress--live">
              <span style={{ '--p': progress ?? 0.15 } as CSSProperties} />
            </div>
          </>
        ) : (
          <>
            <h2 id="match-title">{unsure ? t('matchUnsure', lang) : t('matchFound', lang)}</h2>
            <ul className="guesses">
              {matches.map((m) => {
                const s = byId.get(m.id)
                if (!s) return null
                const c = certainty(m, matches)
                return (
                  <li key={m.id}>
                    <button type="button" className="guess" data-score={m.score.toFixed(3)} onClick={() => onPick(m.id)}>
                      <span className="guess__photo">{coverFile(s) ? <img src={photoUrl(coverFile(s)!, 200)} alt="" /> : <StatueGlyph size={26} />}</span>
                      <span className="guess__text">
                        <strong>{statueName(s, lang)}</strong>
                        {describe(s, lang) && <span>{describe(s, lang)}</span>}
                      </span>
                      <span className={`guess__tag guess__tag--${c}`}>{t(c === 'sure' ? 'sure' : c === 'maybe' ? 'maybe' : 'unlikely', lang)}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </>
        )}
        <button type="button" className="btn btn--quiet match__retake" onClick={onRetake}>
          <Camera aria-hidden size={19} strokeWidth={2.3} />
          {t('retake', lang)}
        </button>
      </div>
    </div>
  )
}
