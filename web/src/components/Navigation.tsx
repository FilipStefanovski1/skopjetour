import { ArrowUp, ArrowUpLeft, ArrowUpRight, ChevronDown, CornerUpLeft, CornerUpRight, Flag, LocateFixed, MapPin, Navigation2, RotateCw, Undo2, X } from 'lucide-react'
import { useState } from 'react'
import { formatMetres, instruction, walkMinutes, type Progress, type Route, type Step } from '../directions'
import { photoUrl } from '../data'
import { t } from '../i18n'
import { locationErrorText, type LocationError } from '../location'
import type { Lang, Statue } from '../types'
import { coverFile, statueName } from '../types'
import { StatueGlyph } from './StatueGlyph'

function StepIcon({ step, size = 30 }: { step: Step; size?: number }) {
  const props = { 'aria-hidden': true, size, strokeWidth: 2.4 } as const
  if (step.type === 'arrive') return <Flag {...props} />
  if (step.type === 'depart') return <Navigation2 {...props} />
  if (step.type === 'roundabout' || step.type === 'rotary') return <RotateCw {...props} />
  switch (step.modifier) {
    case 'left':
    case 'sharp left':
      return <CornerUpLeft {...props} />
    case 'right':
    case 'sharp right':
      return <CornerUpRight {...props} />
    case 'slight left':
      return <ArrowUpLeft {...props} />
    case 'slight right':
      return <ArrowUpRight {...props} />
    case 'uturn':
      return <Undo2 {...props} />
    default:
      return <ArrowUp {...props} />
  }
}

export type NavStatus = 'locating' | 'routing' | 'ready' | 'error' | 'arrived'

interface BannerProps {
  lang: Lang
  status: NavStatus
  locationError: LocationError | null
  progress: Progress | null
  destination: string
}

/** The next turn, big and short, the way a walker glances at it. */
export function NavBanner({ lang, status, locationError, progress, destination }: BannerProps) {
  let icon = <Navigation2 aria-hidden size={30} strokeWidth={2.4} />
  let distance: string | null = null
  let text: string
  if (locationError) text = t(locationErrorText(locationError), lang)
  else if (status === 'locating') text = t('waitingForLocation', lang)
  else if (status === 'routing') text = t('findingRoute', lang)
  else if (status === 'error') text = t('routeFailed', lang)
  else if (status === 'arrived') {
    icon = <Flag aria-hidden size={30} strokeWidth={2.4} />
    text = t('arrive', lang, { place: destination })
  } else if (progress?.next) {
    icon = <StepIcon step={progress.next} />
    distance = t('inDistance', lang, { d: formatMetres(progress.toNext) })
    text = instruction(progress.next, lang, destination)
  } else text = t('arrive', lang, { place: destination })

  return (
    <div className={`navbanner${status === 'arrived' ? ' is-arrived' : ''}`} role="status" aria-live="polite">
      <span className="navbanner__icon">{icon}</span>
      <span className="navbanner__text">
        {distance && <span className="navbanner__dist">{distance}</span>}
        <strong>{text}</strong>
      </span>
    </div>
  )
}

interface PanelProps {
  lang: Lang
  target: Statue
  status: NavStatus
  route: Route | null
  progress: Progress | null
  following: boolean
  /** Offered when there's no real position: walk from Macedonia Square instead. */
  onDemo: (() => void) | null
  onRecenter: () => void
  onEnd: () => void
  onOpenStory: () => void
}

/** Where you're going and how long it takes; ends the walk or opens the story on arrival. */
export function NavPanel({ lang, target, status, route, progress, following, onDemo, onRecenter, onEnd, onOpenStory }: PanelProps) {
  const [showSteps, setShowSteps] = useState(false)
  const name = statueName(target, lang)
  const remaining = progress?.remaining ?? route?.distance ?? null
  const arrived = status === 'arrived'

  return (
    <div className="navpanel">
      {!following && !arrived && (
        <button type="button" className="navpanel__recenter" onClick={onRecenter}>
          <LocateFixed aria-hidden size={18} strokeWidth={2.3} />
          {t('recenter', lang)}
        </button>
      )}
      <div className="navpanel__card">
        <div className="navpanel__head">
          <span className="navpanel__photo">{coverFile(target) ? <img src={photoUrl(coverFile(target)!, 200)} alt="" /> : <StatueGlyph size={26} />}</span>
          <span className="navpanel__text">
            {arrived ? (
              <strong>{t('arrivedTitle', lang)}</strong>
            ) : remaining != null ? (
              <strong className="navpanel__eta">
                {t('minLeft', lang, { m: walkMinutes(remaining) })} <span>· {formatMetres(remaining)}</span>
              </strong>
            ) : (
              <strong>…</strong>
            )}
            <span>{name}</span>
          </span>
          <button type="button" className="navpanel__end" onClick={onEnd} aria-label={t('endNav', lang)}>
            <X aria-hidden size={20} strokeWidth={2.4} />
          </button>
        </div>

        {onDemo ? (
          <button type="button" className="btn btn--primary navpanel__cta" onClick={onDemo}>
            <MapPin aria-hidden size={19} strokeWidth={2.3} />
            {t('useDemoLocation', lang)}
          </button>
        ) : arrived ? (
          <button type="button" className="btn btn--primary navpanel__cta" onClick={onOpenStory}>
            {t('openStory', lang)}
          </button>
        ) : (
          route &&
          route.steps.length > 1 && (
            <>
              <button type="button" className="navpanel__toggle" aria-expanded={showSteps} onClick={() => setShowSteps((v) => !v)}>
                {t('stepsList', lang)}
                <ChevronDown aria-hidden size={18} strokeWidth={2.3} />
              </button>
              {showSteps && (
                <ol className="navsteps">
                  {route.steps.slice(1).map((s, i) => (
                    <li key={i} className={progress?.next === s ? 'is-next' : ''}>
                      <span className="navsteps__icon">
                        <StepIcon step={s} size={20} />
                      </span>
                      <span>{instruction(s, lang, name)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </>
          )
        )}
      </div>
    </div>
  )
}
