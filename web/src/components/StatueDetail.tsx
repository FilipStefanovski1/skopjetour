import { ArrowLeft, Check, ChevronLeft, ExternalLink, Image as ImageIcon, Pause, Rotate3d, Sparkles, UserRound, Volume2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { formatDistance, metresBetween } from '../course'
import { loadStory, photoPageUrl, photoUrl, wikiUrl, type Story } from '../data'
import { MODELS, NARRATION } from '../extras'
import { t } from '../i18n'
import { canSpeak, pickVoice, speak, voicesReady, type Narration } from '../narrator'
import type { Lang, Statue, Theme } from '../types'
import { describe, statueName } from '../types'
import type { LatLon } from './MapView'
import { StatueGlyph } from './StatueGlyph'

interface Props {
  statue: Statue
  lang: Lang
  themes: Theme[]
  /** The list the visitor is walking: next and previous come from here. */
  list: Statue[]
  numbers: Map<string, number> | null
  userPos: LatLon | null
  seen: boolean
  /** Just scanned: celebrate the new find, show the 3D model and start the guide. */
  collected?: boolean
  onToggleSeen: () => void
  onNavigate: (id: string) => void
  onClose: () => void
}

type Media = 'photo' | '3d' | 'person'

let modelViewerLoading: Promise<unknown> | null = null
function loadModelViewer() {
  modelViewerLoading ??= import('@google/model-viewer')
  return modelViewerLoading
}

function fileCaption(file: string): string {
  return file.replace(/\.[a-z]+$/i, '').replace(/\s*\((cropped|\d+)\)/gi, '').replace(/_/g, ' ')
}

/** One statue, full screen: photo, 3D or the person, who they were, the guide's voice, and the way on. */
export function StatueDetail({ statue, lang, themes, list, numbers, userPos, seen, collected, onToggleSeen, onNavigate, onClose }: Props) {
  const model = statue.statue_qid ? MODELS[statue.statue_qid] : undefined
  const [story, setStory] = useState<Story | null | undefined>(undefined)
  const [media, setMedia] = useState<Media>(model && collected ? '3d' : 'photo')
  const [speaking, setSpeaking] = useState(false)
  const [voiceNote, setVoiceNote] = useState<string | null>(null)
  const narration = useRef<Narration | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const swipe = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    let cancelled = false
    setStory(undefined)
    loadStory(statue, lang).then((s) => !cancelled && setStory(s))
    scrollRef.current?.scrollTo({ top: 0 })
    return () => {
      cancelled = true
    }
  }, [statue, lang])

  // A new statue starts on its photo (or its 3D model right after a scan), with the guide quiet.
  useEffect(() => {
    setMedia(model && collected ? '3d' : 'photo')
    return () => {
      narration.current?.stop()
      setSpeaking(false)
      setVoiceNote(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statue.id, lang])

  useEffect(() => {
    if (media === '3d') loadModelViewer()
  }, [media])

  useEffect(() => {
    dialogRef.current?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [onClose])

  const scripted = statue.statue_qid ? NARRATION[statue.statue_qid] : undefined
  const guideText = scripted?.[lang] ?? story?.text ?? null

  const startGuide = async () => {
    if (!canSpeak || !guideText) return
    await voicesReady()
    let text = guideText
    let voice = pickVoice(lang)
    let tag = lang === 'mk' ? 'mk-MK' : 'en-GB'
    setVoiceNote(null)
    if (!voice && lang === 'mk' && scripted?.en) {
      // No Macedonian-capable voice on this phone: the guide speaks English instead.
      text = scripted.en
      voice = pickVoice('en')
      tag = 'en-GB'
      setVoiceNote(t('voiceEnglish', lang))
    }
    narration.current?.stop()
    setSpeaking(true)
    narration.current = speak(text, voice, tag, () => setSpeaking(false))
  }

  const stopGuide = () => {
    narration.current?.stop()
    setSpeaking(false)
  }

  // Right after a scan, the guide starts on its own once there is something to say.
  const autoStarted = useRef<string | null>(null)
  useEffect(() => {
    if (collected && guideText && autoStarted.current !== statue.id) {
      autoStarted.current = statue.id
      startGuide()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collected, guideText, statue.id])

  const index = list.findIndex((s) => s.id === statue.id)
  const next = index >= 0 ? list[index + 1] : undefined
  const previous = index > 0 ? list[index - 1] : undefined
  const name = statueName(statue, lang)
  const desc = describe(statue, lang)
  const n = numbers?.get(statue.id)
  const route = statue.themes.map((id) => themes.find((th) => th.id === id)?.[lang]).filter(Boolean)[0]
  const where = n ? t('stopOf', lang, { n, m: numbers!.size }) : userPos ? t('away', lang, { d: formatDistance(metresBetween(userPos, statue)) }) : null
  const meta = [route, where].filter(Boolean).join(' · ')
  const wikiLang: Lang = (lang === 'en' ? statue.wiki_en : statue.wiki_mk) ? lang : lang === 'en' ? 'mk' : 'en'
  const wikiTitle = wikiLang === 'en' ? statue.wiki_en : statue.wiki_mk
  const note = statue.position === 'approximate' ? t(statue.group === 'art-bridge' ? 'approximate' : 'estimated', lang) : null

  const modes: { id: Media; label: string; icon: typeof ImageIcon }[] = [
    { id: 'photo', label: t('mediaStatue', lang), icon: ImageIcon },
    ...(model ? [{ id: '3d' as const, label: '3D', icon: Rotate3d }] : []),
    ...(statue.person_image ? [{ id: 'person' as const, label: t('mediaPerson', lang), icon: UserRound }] : []),
  ]

  // A sideways swipe moves along the list, like turning a page; not while turning the 3D model.
  const onPointerDown = (e: React.PointerEvent) => {
    swipe.current = (e.target as Element).closest('model-viewer, .media-tabs') ? null : { x: e.clientX, y: e.clientY }
  }
  const onPointerUp = (e: React.PointerEvent) => {
    const s = swipe.current
    swipe.current = null
    if (!s) return
    const dx = e.clientX - s.x
    const dy = e.clientY - s.y
    if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.6) return
    if (dx < 0 && next) onNavigate(next.id)
    if (dx > 0 && previous) onNavigate(previous.id)
  }

  return (
    <div ref={dialogRef} tabIndex={-1} className="detail" role="dialog" aria-modal="true" aria-labelledby="detail-title">
      <div ref={scrollRef} className="detail__scroll" onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
        <figure className={`detail__hero detail__hero--${media}`}>
          {media === '3d' && model ? (
            <model-viewer
              key={model.src}
              src={model.src}
              alt={name}
              camera-controls=""
              auto-rotate=""
              auto-rotate-delay="600"
              rotation-per-second="18deg"
              interaction-prompt="auto"
              touch-action="pan-y"
              ar=""
              ar-modes="webxr scene-viewer quick-look"
              shadow-intensity="1"
              shadow-softness="0.8"
              exposure="1.05"
              environment-image="neutral"
              camera-orbit="205deg 78deg auto"
              class="detail__model"
            />
          ) : media === 'person' && statue.person_image ? (
            <>
              <img key={statue.person_image} src={photoUrl(statue.person_image, 1080)} alt={desc ?? name} decoding="async" />
              <figcaption className="detail__caption">{fileCaption(statue.person_image)}</figcaption>
            </>
          ) : statue.image ? (
            <img key={statue.id} src={photoUrl(statue.image, 1080)} alt={name} decoding="async" />
          ) : (
            <span className="detail__blank">
              <StatueGlyph size={72} />
            </span>
          )}

          <button type="button" className="round round--back" onClick={onClose} aria-label={t('backToMap', lang)}>
            <ArrowLeft aria-hidden size={22} strokeWidth={2.2} />
          </button>
          {collected && (
            <p className="collected" role="status">
              <Sparkles aria-hidden size={16} strokeWidth={2.4} />
              {t('addedToCollection', lang)}
            </p>
          )}
          <button
            type="button"
            className={`round round--seen${seen ? ' is-on' : ''}`}
            onClick={onToggleSeen}
            aria-pressed={seen}
            aria-label={seen ? t('seen', lang) : t('markSeen', lang)}
            title={seen ? t('seen', lang) : t('markSeen', lang)}
          >
            <Check aria-hidden size={22} strokeWidth={2.6} />
          </button>

          {modes.length > 1 && (
            <div className="media-tabs" role="tablist" aria-label={t('view', lang)}>
              {modes.map(({ id, label, icon: Icon }) => (
                <button key={id} type="button" role="tab" aria-selected={media === id} onClick={() => setMedia(id)}>
                  <Icon aria-hidden size={16} strokeWidth={2.3} />
                  {label}
                </button>
              ))}
            </div>
          )}
        </figure>

        <div className="detail__body">
          {meta && <p className="detail__meta">{meta}</p>}
          <h1 id="detail-title">{name}</h1>
          {desc && <p className="detail__desc">{desc}</p>}

          {canSpeak && guideText && (
            <button type="button" className={`guide${speaking ? ' is-on' : ''}`} onClick={speaking ? stopGuide : startGuide} aria-pressed={speaking}>
              <span className="guide__icon">{speaking ? <Pause aria-hidden size={18} strokeWidth={2.4} /> : <Volume2 aria-hidden size={18} strokeWidth={2.4} />}</span>
              <span className="guide__text">
                <strong>{speaking ? t('guideStop', lang) : t('guidePlay', lang)}</strong>
                <span>{voiceNote ?? (scripted ? t('guideTour', lang) : t('guideStory', lang))}</span>
              </span>
              {speaking && (
                <span className="guide__bars" aria-hidden>
                  <i />
                  <i />
                  <i />
                  <i />
                </span>
              )}
            </button>
          )}

          <div className="detail__story">
            {story === undefined && (
              <p className="story-loading" aria-label={t('loading', lang)}>
                <span />
                <span />
                <span />
              </p>
            )}
            {story === null && !scripted && <p className="muted">{t('noStory', lang)}</p>}
            {story && (
              <>
                <p>{story.text}</p>
                {story.audio && <audio controls src={story.audio} preload="none" />}
              </>
            )}
          </div>

          {wikiTitle && (
            <a className="detail__more" href={wikiUrl(wikiLang, wikiTitle)} target="_blank" rel="noreferrer">
              {t('readMore', lang)}
              <ExternalLink aria-hidden size={15} strokeWidth={2.2} />
            </a>
          )}

          {note && <p className="detail__note">{note}</p>}

          <p className="detail__credit">
            {statue.image && (
              <>
                {t('photo', lang)}:{' '}
                <a href={photoPageUrl(statue.image)} target="_blank" rel="noreferrer">
                  Wikimedia Commons
                </a>
                {story?.source === 'wikipedia' ? ' · ' : ''}
              </>
            )}
            {story?.source === 'wikipedia' && t('textWikipedia', lang)}
            {model && ` · ${t('model3d', lang)}`}
          </p>
        </div>
      </div>

      {(next || previous) && (
        <nav className="detail__nav" aria-label={t('walk', lang)}>
          <button
            type="button"
            className="nav-prev"
            disabled={!previous}
            onClick={() => previous && onNavigate(previous.id)}
            aria-label={previous ? `${t('previous', lang)}: ${statueName(previous, lang)}` : t('previous', lang)}
          >
            <ChevronLeft aria-hidden size={24} strokeWidth={2.2} />
          </button>
          {next ? (
            <button type="button" className="nav-next" onClick={() => onNavigate(next.id)}>
              <span className="nav-next__label">{t('next', lang)}</span>
              <span className="nav-next__name">{statueName(next, lang)}</span>
              {next.image ? <img src={photoUrl(next.image, 120)} alt="" /> : <StatueGlyph size={22} />}
            </button>
          ) : (
            <button type="button" className="nav-next nav-next--done" onClick={onClose}>
              <span className="nav-next__label">{t('endOfList', lang)}</span>
              <span className="nav-next__name">{t('backToMap', lang)}</span>
            </button>
          )}
        </nav>
      )}
    </div>
  )
}
