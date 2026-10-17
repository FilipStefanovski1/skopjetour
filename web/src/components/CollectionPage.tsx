import { Nfc } from 'lucide-react'
import { useMemo, useState } from 'react'
import { photoUrl } from '../data'
import { t } from '../i18n'
import type { Lang, Statue, Theme } from '../types'
import { statueName } from '../types'
import { LangSwitch } from './LangSwitch'
import { StatueGlyph } from './StatueGlyph'

interface Props {
  statues: Statue[]
  themes: Theme[]
  seen: Set<string>
  lang: Lang
  onLang: (l: Lang) => void
  onOpen: (id: string) => void
  onScan: () => void
}

/** Every statue as a tile: the ones you've found in colour, the rest still waiting in grey. */
export function CollectionPage({ statues, themes, seen, lang, onLang, onOpen, onScan }: Props) {
  const [theme, setTheme] = useState<string | null>(null)

  const tiles = useMemo(() => {
    const list = theme ? statues.filter((s) => s.themes.includes(theme)) : statues
    // Found first (most recent first), then the ones with photos, then the rest.
    const order = [...seen].reverse()
    return [...list].sort((a, b) => {
      const sa = order.indexOf(a.id)
      const sb = order.indexOf(b.id)
      if (sa !== -1 || sb !== -1) return (sa === -1 ? 1e9 : sa) - (sb === -1 ? 1e9 : sb)
      return Number(Boolean(b.image)) - Number(Boolean(a.image))
    })
  }, [statues, theme, seen])

  const found = tiles.filter((s) => seen.has(s.id)).length
  const share = tiles.length ? found / tiles.length : 0

  return (
    <section className="collection" aria-labelledby="collection-title">
      <header className="collection__head">
        <div className="collection__title">
          <h1 id="collection-title">{t('collection', lang)}</h1>
          <LangSwitch lang={lang} onLang={onLang} />
        </div>
        <p className="collection__count">{t('foundOf', lang, { n: found, m: tiles.length })}</p>
        <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={tiles.length} aria-valuenow={found}>
          <span style={{ width: `${Math.max(share * 100, found ? 3 : 0)}%` }} />
        </div>
        <nav className="chips chips--light" aria-label={t('routes', lang)}>
          <button type="button" aria-pressed={theme === null} onClick={() => setTheme(null)}>
            {t('all', lang)}
          </button>
          {themes.map((th) => (
            <button key={th.id} type="button" aria-pressed={theme === th.id} onClick={() => setTheme(th.id)}>
              {th[lang]}
            </button>
          ))}
        </nav>
      </header>

      {seen.size === 0 && (
        <button type="button" className="collection__empty" onClick={onScan}>
          <Nfc aria-hidden size={22} strokeWidth={2.3} />
          <span>
            <strong>{t('emptyTitle', lang)}</strong>
            {t('emptyBody', lang)}
          </span>
        </button>
      )}

      <ul className="tiles">
        {tiles.map((s) => {
          const got = seen.has(s.id)
          return (
            <li key={s.id}>
              <button type="button" className={`tile${got ? ' is-found' : ''}`} onClick={() => onOpen(s.id)}>
                <span className="tile__photo">
                  {s.image ? <img src={photoUrl(s.image, 300)} alt="" loading="lazy" decoding="async" /> : <StatueGlyph size={30} />}
                </span>
                <span className="tile__name">{statueName(s, lang)}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
