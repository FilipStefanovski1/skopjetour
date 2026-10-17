import { Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { photoUrl } from '../data'
import { t } from '../i18n'
import type { Lang, Statue } from '../types'
import { describe, statueName } from '../types'
import { StatueGlyph } from './StatueGlyph'

interface Props {
  statues: Statue[]
  lang: Lang
  onLang: (l: Lang) => void
  onPick: (id: string) => void
}

function fold(s: string): string {
  return s.toLowerCase().normalize('NFKD').replace(/\p{Diacritic}/gu, '')
}

/** Floating search with the language switch; results drop down under it, Maps-style. */
export function SearchBar({ statues, lang, onLang, onPick }: Props) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  const results = useMemo(() => {
    const q = fold(query.trim())
    if (!q) return []
    return statues
      .filter((s) => [s.name_mk, s.name_en, s.subject_mk, s.subject_en, s.desc_mk, s.desc_en, ...s.aliases].some((n) => n && fold(n).includes(q)))
      .slice(0, 30)
  }, [statues, query])

  const close = () => {
    setOpen(false)
    setQuery('')
    ;(document.activeElement as HTMLElement | null)?.blur()
  }

  return (
    <div className={`search${open && query ? ' is-open' : ''}`}>
      <div className="search__bar">
        <Search className="search__icon" aria-hidden size={19} strokeWidth={2.2} />
        <input
          type="search"
          value={query}
          placeholder={t('search', lang)}
          aria-label={t('search', lang)}
          enterKeyHint="search"
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 180)}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') close()
            if (e.key === 'Enter' && results[0]) {
              onPick(results[0].id)
              close()
            }
          }}
        />
        {query ? (
          <button type="button" className="search__clear" onClick={close} aria-label={t('clearSearch', lang)}>
            <X aria-hidden size={18} strokeWidth={2.2} />
          </button>
        ) : (
          <div className="lang" role="group" aria-label="Language / Јазик">
            {(['mk', 'en'] as const).map((l) => (
              <button key={l} type="button" aria-pressed={lang === l} onClick={() => onLang(l)}>
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        )}
      </div>
      {open && query && (
        <div className="search__results" role="listbox" aria-label={t('search', lang)}>
          {results.length === 0 ? (
            <p className="search__empty">{t('noMatch', lang, { q: query.trim() })}</p>
          ) : (
            results.map((s) => (
              <button
                key={s.id}
                type="button"
                role="option"
                aria-selected="false"
                className="result"
                onClick={() => {
                  onPick(s.id)
                  close()
                }}
              >
                <span className="result__photo">{s.image ? <img src={photoUrl(s.image, 120)} alt="" loading="lazy" /> : <StatueGlyph size={20} />}</span>
                <span className="result__text">
                  <span className="result__name">{statueName(s, lang)}</span>
                  {describe(s, lang) && <span className="result__desc">{describe(s, lang)}</span>}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
