import { useCallback, useEffect, useMemo, useState } from 'react'
import { MapView } from './components/MapView'
import { StatueCard } from './components/StatueCard'
import { loadStatues, loadThemes } from './data'
import { t } from './i18n'
import type { Lang, Statue, Theme } from './types'

function savedLang(): Lang {
  try {
    return localStorage.getItem('lang') === 'en' ? 'en' : 'mk'
  } catch {
    return 'mk'
  }
}

export default function App() {
  const [statues, setStatues] = useState<Statue[]>([])
  const [themes, setThemes] = useState<Theme[]>([])
  const [lang, setLang] = useState<Lang>(savedLang)
  const [theme, setTheme] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    loadStatues().then(setStatues)
    loadThemes().then(setThemes)
  }, [])

  useEffect(() => {
    document.documentElement.lang = lang
    try {
      localStorage.setItem('lang', lang)
    } catch {
      // storage unavailable (private mode); the choice just isn't remembered
    }
  }, [lang])

  const visible = useMemo(
    () => (theme ? statues.filter((s) => s.themes.includes(theme)) : statues),
    [statues, theme],
  )
  const selected = statues.find((s) => s.id === selectedId) ?? null
  const select = useCallback((id: string) => setSelectedId(id), [])

  return (
    <div className="app">
      <header className="bar">
        <h1>{t('title', lang)}</h1>
        <span className="bar__count">
          {visible.length} {t('statues', lang)}
        </span>
        <div className="lang" role="group" aria-label="Language">
          {(['mk', 'en'] as const).map((l) => (
            <button key={l} aria-pressed={lang === l} onClick={() => setLang(l)}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </header>

      <nav className="themes" aria-label="Themes">
        <button aria-pressed={theme === null} onClick={() => setTheme(null)}>
          {t('all', lang)}
        </button>
        {themes.map((th) => (
          <button key={th.id} aria-pressed={theme === th.id} onClick={() => setTheme(th.id)}>
            {th[lang]}
          </button>
        ))}
      </nav>

      <MapView statues={visible} lang={lang} selectedId={selectedId} onSelect={select} />

      {selected && (
        <StatueCard statue={selected} lang={lang} themes={themes} onClose={() => setSelectedId(null)} />
      )}
    </div>
  )
}
