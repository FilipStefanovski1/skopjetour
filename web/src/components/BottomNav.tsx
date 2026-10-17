import { LayoutGrid, Map as MapIcon, Nfc } from 'lucide-react'
import { t } from '../i18n'
import type { Lang } from '../types'

export type Tab = 'map' | 'scan' | 'collection'

interface Props {
  tab: Tab
  lang: Lang
  seenCount: number
  onTab: (t: Tab) => void
}

/** Three tabs; Scan sits raised in the middle because it's what you do at a statue. */
export function BottomNav({ tab, lang, seenCount, onTab }: Props) {
  return (
    <nav className="tabbar" aria-label="Main">
      <button type="button" className="tabbar__item" aria-current={tab === 'map' ? 'page' : undefined} onClick={() => onTab('map')}>
        <MapIcon aria-hidden size={23} strokeWidth={2.1} />
        <span>{t('tabMap', lang)}</span>
      </button>
      <button type="button" className="tabbar__scan" aria-current={tab === 'scan' ? 'page' : undefined} onClick={() => onTab('scan')}>
        <span className="tabbar__scan-disc">
          <Nfc aria-hidden size={28} strokeWidth={2.2} />
        </span>
        <span>{t('tabScan', lang)}</span>
      </button>
      <button type="button" className="tabbar__item" aria-current={tab === 'collection' ? 'page' : undefined} onClick={() => onTab('collection')}>
        <span className="tabbar__icon">
          <LayoutGrid aria-hidden size={23} strokeWidth={2.1} />
          {seenCount > 0 && <span className="tabbar__badge">{seenCount}</span>}
        </span>
        <span>{t('tabCollection', lang)}</span>
      </button>
    </nav>
  )
}
