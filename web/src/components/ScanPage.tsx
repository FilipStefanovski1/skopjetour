import { Camera, Map as MapIcon, Nfc, Shuffle } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { t } from '../i18n'
import { canScanInPage, isIOS, scanPlaques } from '../nfc'
import type { Lang } from '../types'
import { LangSwitch } from './LangSwitch'
import { StatueGlyph } from './StatueGlyph'

type ScanState = 'idle' | 'scanning' | 'error' | 'unreadable'

interface Props {
  lang: Lang
  onLang: (l: Lang) => void
  seenCount: number
  total: number
  onStatue: (id: string) => void
  onPhoto: (photo: File) => void
  onDemo: () => void
  onOpenMap: () => void
}

/** Home: hold the phone to a statue's plaque and find out who it is. */
export function ScanPage({ lang, onLang, seenCount, total, onStatue, onPhoto, onDemo, onOpenMap }: Props) {
  const [state, setState] = useState<ScanState>('idle')
  const abort = useRef<AbortController | null>(null)
  const camera = useRef<HTMLInputElement>(null)

  useEffect(() => () => abort.current?.abort(), [])

  const start = async () => {
    abort.current?.abort()
    const ctrl = new AbortController()
    abort.current = ctrl
    setState('scanning')
    try {
      await scanPlaques(
        ctrl.signal,
        (id) => {
          ctrl.abort()
          setState('idle')
          onStatue(id)
        },
        () => setState('unreadable'),
      )
    } catch {
      if (!ctrl.signal.aborted) setState('error')
    }
  }

  const stop = () => {
    abort.current?.abort()
    setState('idle')
  }

  const scanning = state === 'scanning'
  const hint = canScanInPage ? null : isIOS ? t('iosHint', lang) : t('noNfc', lang)

  return (
    <section className="scan" aria-labelledby="scan-title">
      <header className="scan__top">
        <p className="scan__count">{t('collected', lang, { n: seenCount, m: total })}</p>
        <LangSwitch lang={lang} onLang={onLang} />
      </header>

      <div className={`plaque${scanning ? ' is-scanning' : ''}`} aria-hidden>
        <span className="plaque__ring" />
        <span className="plaque__ring" />
        <span className="plaque__ring" />
        <span className="plaque__face">
          <StatueGlyph size={64} />
          <Nfc className="plaque__nfc" size={22} strokeWidth={2.4} />
        </span>
      </div>

      <div className="scan__text">
        <h1 id="scan-title">{scanning ? t('scanning', lang) : t('scanTitle', lang)}</h1>
        <p>{scanning ? t('scanningHint', lang) : t('scanBody', lang)}</p>
        {state === 'error' && <p className="scan__alert">{t('nfcError', lang)}</p>}
        {state === 'unreadable' && <p className="scan__alert">{t('nfcUnreadable', lang)}</p>}
        {hint && <p className="scan__hint">{hint}</p>}
      </div>

      <div className="scan__actions">
        <input
          ref={camera}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) onPhoto(file)
          }}
        />
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => {
            camera.current?.click()
            // Start fetching the recognition model while the camera is open.
            import('../recognize').then((m) => m.loadRecognizer()).catch(() => {})
          }}
        >
          <Camera aria-hidden size={20} strokeWidth={2.3} />
          {t('snapStatue', lang)}
        </button>
        {canScanInPage &&
          (scanning ? (
            <button type="button" className="btn btn--quiet" onClick={stop}>
              {t('cancel', lang)}
            </button>
          ) : (
            <button type="button" className="btn btn--quiet" onClick={start}>
              <Nfc aria-hidden size={20} strokeWidth={2.3} />
              {t('startScan', lang)}
            </button>
          ))}
        <button type="button" className="btn btn--quiet" onClick={onDemo}>
          <Shuffle aria-hidden size={19} strokeWidth={2.3} />
          {t('demoScan', lang)}
        </button>
        <button type="button" className="scan__map" onClick={onOpenMap}>
          <MapIcon aria-hidden size={17} strokeWidth={2.3} />
          {t('noPlaque', lang)}
        </button>
      </div>
    </section>
  )
}
