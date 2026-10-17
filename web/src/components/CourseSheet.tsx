import { Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { Course } from '../course'
import { formatDistance } from '../course'
import { t } from '../i18n'
import type { Lang, Statue, Theme } from '../types'
import { statueName, subjectLine } from '../types'
import { ControlMark } from './ControlMark'

interface Props {
  lang: Lang
  statues: Statue[]
  course: Course | null
  theme: Theme | null
  seen: Set<string>
  onSelect: (id: string) => void
}

function fold(s: string): string {
  return s.toLowerCase().normalize('NFKD').replace(/\p{Diacritic}/gu, '')
}

/** The control description sheet: the course's stops in walking order, or every statue with a search. */
export function CourseSheet({ lang, statues, course, theme, seen, onSelect }: Props) {
  const [query, setQuery] = useState('')

  const allRows = useMemo(() => {
    const collator = new Intl.Collator(lang)
    return [...statues].sort((a, b) => collator.compare(statueName(a, lang), statueName(b, lang)))
  }, [statues, lang])

  const matches = useMemo(() => {
    const q = fold(query.trim())
    if (!q) return allRows
    return allRows.filter((s) =>
      [s.name_mk, s.name_en, s.subject_mk, s.subject_en, ...s.aliases].some((n) => n && fold(n).includes(q)),
    )
  }, [allRows, query])

  if (course && theme) {
    const seenCount = course.controls.filter((c) => seen.has(c.id)).length
    return (
      <section className="sheet-body" aria-labelledby="course-title">
        <header className="course-head">
          <h2 id="course-title">{theme[lang]}</h2>
          <dl className="course-stats">
            <div>
              <dt>{t('statues', lang)}</dt>
              <dd>{course.controls.length}</dd>
            </div>
            <div>
              <dt>≈ km</dt>
              <dd>{(course.metres / 1000).toFixed(1)}</dd>
            </div>
            <div>
              <dt>{t('minutes', lang)}</dt>
              <dd>{course.minutes}</dd>
            </div>
          </dl>
          <p className="course-progress">{t('seenOf', lang, { n: seenCount, m: course.controls.length })}</p>
        </header>
        <ol className="controls">
          {course.controls.map((s, i) => {
            const leg = i > 0 ? course.legs[i - 1] : null
            return (
              <li key={s.id}>
                <button type="button" className="control-row" onClick={() => onSelect(s.id)}>
                  <ControlMark kind={i === 0 ? 'start' : 'control'} n={i + 1} seen={seen.has(s.id)} />
                  <span className="control-row__name">
                    {statueName(s, lang)}
                    {subjectLine(s, lang) && <span className="control-row__sub">{subjectLine(s, lang)}</span>}
                  </span>
                  <span className="control-row__leg">
                    {leg ? `${formatDistance(leg.metres)} · ${leg.minutes} ${t('minutes', lang)}` : t('start', lang)}
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
        {course.beyond.length > 0 && (
          <>
            <h3 className="sheet-subhead">{t('beyond', lang)}</h3>
            <ul className="controls">
              {course.beyond.map((s) => (
                <li key={s.id}>
                  <button type="button" className="control-row" onClick={() => onSelect(s.id)}>
                    <ControlMark kind="plain" seen={seen.has(s.id)} />
                    <span className="control-row__name">{statueName(s, lang)}</span>
                    <span className="control-row__leg" />
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    )
  }

  return (
    <section className="sheet-body" aria-labelledby="all-title">
      <header className="course-head">
        <h2 id="all-title">{t('allStatues', lang)}</h2>
        <div className="search">
          <Search aria-hidden size={17} strokeWidth={2.25} />
          <input
            type="search"
            value={query}
            aria-label={t('search', lang)}
            placeholder={t('search', lang)}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button type="button" className="search__clear" onClick={() => setQuery('')} aria-label={t('clearSearch', lang)}>
              <X aria-hidden size={17} strokeWidth={2.25} />
            </button>
          )}
        </div>
      </header>
      {matches.length === 0 ? (
        <p className="sheet-empty">{t('noMatch', lang, { q: query.trim() })}</p>
      ) : (
        <ul className="controls">
          {matches.map((s) => (
            <li key={s.id}>
              <button type="button" className="control-row" onClick={() => onSelect(s.id)}>
                <ControlMark kind="plain" seen={seen.has(s.id)} />
                <span className="control-row__name">
                  {statueName(s, lang)}
                  {subjectLine(s, lang) && <span className="control-row__sub">{subjectLine(s, lang)}</span>}
                </span>
                <span className="control-row__leg" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
