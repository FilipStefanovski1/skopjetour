import { ArrowLeft, Box, Camera, Check, ChevronLeft, ExternalLink, Image as ImageIcon, Navigation2, Pause, Rotate3d, Sparkles, UserRound, Volume2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { formatDistance, metresBetween } from '../course'
import { loadStory, photoPageUrl, photoUrl, wikiUrl, type Story } from '../data'
import { MODELS, NARRATION } from '../extras'
import { t, type StringKey } from '../i18n'
import { canSpeak, pickVoice, speak, voicesReady, type Narration } from '../narrator'
import type { Lang, Statue, Theme } from '../types'
import { coverFile, dataLang, describe, statueName, type DataLang } from '../types'
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
  /** The photo the visitor took to collect it, if they did. */
  myPhoto?: string
  /** Just scanned: celebrate the new find, show the 3D model and start the guide. */
  collected?: boolean
  /** Take a photo of the statue: one of the two ways to collect it, with a plaque scan. */
  onSnap: () => void
  onNavigate: (id: string) => void
  onDirections: () => void
  onClose: () => void
}

type Media = 'photo' | '3d' | 'person' | 'mine'

let modelViewerLoading: Promise<unknown> | null = null
function loadModelViewer() {
  modelViewerLoading ??= import('@google/model-viewer')
  return modelViewerLoading
}

const MATERIALS: Record<string, StringKey> = {
  bronze: 'materialBronze',
  marble: 'materialMarble',
  metal: 'materialMetal',
  steel: 'materialSteel',
  copper: 'materialCopper',
  concrete: 'materialConcrete',
  stone: 'materialStone',
  granite: 'materialGranite',
}

/** Pokémon GO-style sparkles around the model: [left %, top %, size px, delay s]. */
const SPARKLES = [
  [16, 22, 18, 0],
  [80, 16, 13, 0.9],
  [86, 52, 20, 1.6],
  [10, 60, 12, 2.3],
  [70, 34, 9, 0.4],
] as const

function Sparkle({ x, y, size, delay }: { x: number; y: number; size: number; delay: number }) {
  return (
    <svg className="sparkle" viewBox="0 0 24 24" style={{ left: `${x}%`, top: `${y}%`, width: size, height: size, animationDelay: `${delay}s` }} aria-hidden>
      <path d="M12 0c.9 6.6 4.8 10.6 12 12-7.2 1.4-11.1 5.4-12 12-.9-6.6-4.8-10.6-12-12C7.2 10.6 11.1 6.6 12 0z" />
    </svg>
  )
}

/** The 3D model when there is one, else a photo of the statue, else a portrait of the person. */
function firstMedia(s: Statue, hasModel: boolean): Media {
  return hasModel ? '3d' : s.image ? 'photo' : s.person_image ? 'person' : 'photo'
}

function fileCaption(file: string): string {
  return file.replace(/\.[a-z]+$/i, '').replace(/\s*\((cropped|\d+)\)/gi, '').replace(/_/g, ' ')
}

/** One statue, full screen: photo, 3D or the person, who they were, the guide's voice, and the way on. */
export function StatueDetail({ statue, lang, themes, list, numbers, userPos, seen, myPhoto, collected, onSnap, onNavigate, onDirections, onClose }: Props) {
  const model = statue.statue_qid ? MODELS[statue.statue_qid] : undefined
  // Story, guide and names come in Macedonian or English; the screens in any of the app's languages.
  const dl = dataLang(lang)
  const [story, setStory] = useState<Story | null | undefined>(undefined)
  // A statue with a model opens on it, turning slowly, the way a Pokémon GO entry does.
  const [media, setMedia] = useState<Media>(firstMedia(statue, Boolean(model)))
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

  // A new statue starts on its 3D model when it has one, its photo otherwise, with the guide quiet.
  useEffect(() => {
    setMedia(firstMedia(statue, Boolean(model)))
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
  const guideText = scripted?.[dl] ?? story?.text ?? null

  const startGuide = async () => {
    if (!canSpeak || !guideText) return
    await voicesReady()
    let text = guideText
    let voice = pickVoice(dl)
    let tag = dl === 'mk' ? 'mk-MK' : 'en-GB'
    setVoiceNote(null)
    if (!voice && dl === 'mk' && scripted?.en) {
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
  const route = statue.themes.map((id) => themes.find((th) => th.id === id)?.[dl]).filter(Boolean)[0]
  const where = n ? t('stopOf', lang, { n, m: numbers!.size }) : userPos ? t('away', lang, { d: formatDistance(metresBetween(userPos, statue)) }) : null
  const meta = [`№ ${String(statue.no).padStart(3, '0')}`, where].filter(Boolean).join(' · ')
  // Up to three facts under the name, the plaque's first: year, height, material, then theme and distance.
  const material = statue.material && statue.material in MATERIALS ? t(MATERIALS[statue.material], lang) : undefined
  const stats = [
    statue.year && { label: t('statYear', lang), value: String(statue.year) },
    statue.height && { label: t('statHeight', lang), value: `${statue.height.toLocaleString(lang)} m` },
    material && { label: t('statMaterial', lang), value: material },
    route && { label: t('statTheme', lang), value: route },
    userPos && !n && { label: t('statAway', lang), value: formatDistance(metresBetween(userPos, statue)) },
  ]
    .filter((x): x is { label: string; value: string } => Boolean(x))
    .slice(0, 3)
  const artist = dl === 'en' ? statue.artist_en : statue.artist_mk
  const wikiLang: DataLang = (dl === 'en' ? statue.wiki_en : statue.wiki_mk) ? dl : dl === 'en' ? 'mk' : 'en'
  const wikiTitle = wikiLang === 'en' ? statue.wiki_en : statue.wiki_mk
  const note = statue.position === 'approximate' ? t(statue.group === 'art-bridge' ? 'approximate' : 'estimated', lang) : null

  const modes: { id: Media; label: string; icon: typeof ImageIcon }[] = [
    ...(model ? [{ id: '3d' as const, label: '3D', icon: Rotate3d }] : []),
    ...(statue.image || !statue.person_image ? [{ id: 'photo' as const, label: t('mediaStatue', lang), icon: ImageIcon }] : []),
    ...(statue.person_image ? [{ id: 'person' as const, label: t('mediaPerson', lang), icon: UserRound }] : []),
    ...(myPhoto ? [{ id: 'mine' as const, label: t('yourPhoto', lang), icon: Camera }] : []),
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
            <>
              <svg className="stage__facets" viewBox="0 0 400 520" preserveAspectRatio="xMidYMid slice" aria-hidden>
                <path d="M0 0h210L0 190z" />
                <path d="M400 70v260L240 0h90z" />
                <path d="M0 330l150 190H0z" />
                <path d="M400 380v140H270z" />
              </svg>
              {SPARKLES.map(([x, y, size, delay], i) => (
                <Sparkle key={i} x={x} y={y} size={size} delay={delay} />
              ))}
              <model-viewer
                key={model.src}
                src={model.src}
                alt={name}
                camera-controls=""
                auto-rotate=""
                auto-rotate-delay="0"
                rotation-per-second="14deg"
                interaction-prompt="auto"
                touch-action="pan-y"
                ar=""
                ar-modes="webxr scene-viewer quick-look"
                shadow-intensity="1"
                shadow-softness="0.8"
                exposure="1.05"
                environment-image="neutral"
                camera-orbit="205deg 78deg 135%"
                max-camera-orbit="auto auto 180%"
                class="detail__model"
              >
                {/* Our own AR button, placed clear of the view tabs. */}
                <button slot="ar-button" type="button" className="ar-button">
                  <Box aria-hidden size={16} strokeWidth={2.3} />
                  AR
                </button>
              </model-viewer>
            </>
          ) : media === 'mine' && myPhoto ? (
            <img key="mine" src={myPhoto} alt={t('yourPhoto', lang)} decoding="async" />
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
          {seen && (
            <span className="round round--seen" role="img" aria-label={t('inCollection', lang)} title={t('inCollection', lang)}>
              <Check aria-hidden size={22} strokeWidth={2.6} />
            </span>
          )}

          {modes.length > 1 && (
            <div className="media-tabs" role="tablist" aria-label={t('view', lang)}>
              {modes.map(({ id, label, icon: Icon }) => (
                <button key={id} type="button" role="tab" aria-selected={media === id} aria-label={label} onClick={() => setMedia(id)}>
                  <Icon aria-hidden size={16} strokeWidth={2.3} />
                  <span className="media-tabs__label">{label}</span>
                </button>
              ))}
            </div>
          )}
        </figure>

        <div className="detail__body">
          {meta && <p className="detail__meta">{meta}</p>}
          <h1 id="detail-title">{name}</h1>
          {desc && <p className="detail__desc">{desc}</p>}

          {stats.length > 0 && (
            <dl className="dex-stats">
              {stats.map((st) => (
                <div key={st.label}>
                  <dd>{st.value}</dd>
                  <dt>{st.label}</dt>
                </div>
              ))}
            </dl>
          )}
          {artist && (
            <p className="detail__artist">
              {t('sculptor', lang)}: <strong>{artist}</strong>
            </p>
          )}

          {!seen && (
            <div className="uncollected">
              <p>{t('notCollected', lang)}</p>
              <button type="button" className="btn btn--quiet" onClick={onSnap}>
                <Camera aria-hidden size={19} strokeWidth={2.3} />
                {t('snapToCollect', lang)}
              </button>
            </div>
          )}

          <button type="button" className="directions" onClick={onDirections}>
            <Navigation2 aria-hidden size={18} strokeWidth={2.4} />
            {t('directions', lang)}
            {userPos && <span>· {formatDistance(metresBetween(userPos, statue))}</span>}
          </button>

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
              {coverFile(next) ? <img src={photoUrl(coverFile(next)!, 120)} alt="" /> : <StatueGlyph size={22} />}
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
