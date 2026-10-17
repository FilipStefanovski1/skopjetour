import { ExternalLink, Navigation2 } from 'lucide-react'
import { useState } from 'react'
import { directionStops, directionsParts, type MapsProvider } from '../directions'
import { t } from '../i18n'
import { statueName, type Lang, type Statue } from '../types'

interface Props {
  monument: Statue
  walkStops: Statue[]
  lang: Lang
  onOpen: () => void
}

/** Only the monument page exposes this handoff. Browsing a map or choosing a walk never opens Maps. */
export function MapsDirections({ monument, walkStops, lang, onOpen }: Props) {
  const [provider, setProvider] = useState<MapsProvider>('google')
  const [googleBrowser, setGoogleBrowser] = useState(false)
  const stops = directionStops(monument, walkStops)
  const parts = directionsParts(stops, provider, googleBrowser)
  const providerName = provider === 'google' ? 'Google Maps' : 'Apple Maps'

  return <details className="maps-directions">
    <summary className="directions"><Navigation2 aria-hidden size={18} />{t('directions', lang)}<ExternalLink aria-hidden size={15} /></summary>
    <div className="maps-directions__choices">
      <p>{stops.length > 1 ? t('mapsWholeWalk', lang, { n: stops.length }) : t('mapsSingleStop', lang)}</p>
      {stops.length > 1 && <p className="maps-directions__hint">{t('mapsRouteNote', lang)}</p>}
      {stops.length === 1 ? <div className="maps-directions__providers">
        {(['google', 'apple'] as const).map((p) => <a key={p} href={directionsParts(stops, p)[0].url} target="_blank" rel="noopener noreferrer" onClick={onOpen}>{p === 'google' ? 'Google Maps' : 'Apple Maps'}<ExternalLink size={15} aria-hidden /></a>)}
      </div> : <>
        <div className="maps-directions__providers" role="group" aria-label={t('mapsChooseApp', lang)}>
          {(['google', 'apple'] as const).map((p) => <button key={p} type="button" aria-pressed={provider === p} onClick={() => setProvider(p)}>{p === 'google' ? 'Google Maps' : 'Apple Maps'}</button>)}
        </div>
        {provider === 'google' && stops.length > 4 && <div className="maps-directions__browser">
          <p className="maps-directions__hint">{t('mapsGoogleNote', lang)}</p>
          <label><input type="checkbox" checked={googleBrowser} onChange={(event) => setGoogleBrowser(event.target.checked)} />{t('mapsBrowserLinks', lang)}</label>
        </div>}
        {parts.length > 1 && <p className="maps-directions__hint">{t('mapsPartsNote', lang, { n: parts.length })}</p>}
        {provider === 'apple' && <p className="maps-directions__hint">{t('mapsAppleNote', lang)}</p>}
        <ol className="maps-directions__parts">
          {parts.map((part, i) => <li key={part.startNumber}>
            <a href={part.url} target="_blank" rel="noopener noreferrer" onClick={onOpen}>
              <span><strong>{parts.length > 1 ? t('mapsPart', lang, { n: i + 1, m: parts.length, from: part.startNumber, to: part.endNumber }) : t('mapsOpen', lang, { app: providerName })}</strong>
                <small>{statueName(part.stops[0], lang)}{part.stops.length > 1 && ` → ${statueName(part.stops[part.stops.length - 1], lang)}`}</small></span>
              <ExternalLink size={18} aria-hidden />
            </a>
          </li>)}
        </ol>
      </>}
    </div>
  </details>
}
