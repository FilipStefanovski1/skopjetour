import { ChevronDown, Languages } from 'lucide-react'
import { t } from '../i18n'
import { LANGS, type Lang } from '../types'

/**
 * The app's language: a compact pill that opens the phone's own picker (a wheel on iPhone, a list
 * on Android), with every language in its own name.
 */
export function LangSwitch({ lang, onLang }: { lang: Lang; onLang: (l: Lang) => void }) {
  return (
    <label className="lang">
      <Languages aria-hidden size={16} strokeWidth={2.3} />
      <span className="lang__code">{lang.toUpperCase()}</span>
      <ChevronDown aria-hidden size={14} strokeWidth={2.6} />
      <select value={lang} aria-label={t('language', lang)} onChange={(e) => onLang(e.target.value as Lang)}>
        {LANGS.map((l) => (
          <option key={l.code} value={l.code} lang={l.code}>
            {l.name}
          </option>
        ))}
      </select>
    </label>
  )
}
