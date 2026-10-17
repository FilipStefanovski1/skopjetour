import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { t } from '../i18n'
import type { Lang } from '../types'

export type SheetState = 'peek' | 'half' | 'full'

interface Props {
  state: SheetState
  onState: (s: SheetState) => void
  /** Reports how many pixels of the map the sheet covers, so the map can pad around it. */
  onVisible: (px: number) => void
  lang: Lang
  /** Scroll back to the top when the content changes identity. */
  resetKey: string
  children: ReactNode
}

const PEEK = 248

/** The phone's description sheet: peeks over the map, drags or taps up to half or full height. */
export function Sheet({ state, onState, onVisible, lang, resetKey, children }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(0)
  const [drag, setDrag] = useState<number | null>(null)
  const start = useRef<{ y: number; visible: number } | null>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => setHeight(el.getBoundingClientRect().height))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const stops: Record<SheetState, number> = { peek: PEEK, half: Math.round(height * 0.56), full: height }
  const visible = drag ?? stops[state]

  useEffect(() => {
    if (height) onVisible(Math.min(visible, stops.half))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, height])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 })
  }, [resetKey])

  const onPointerDown = (e: React.PointerEvent) => {
    start.current = { y: e.clientY, visible: stops[state] }
    ;(e.target as Element).setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!start.current) return
    const v = start.current.visible + (start.current.y - e.clientY)
    setDrag(Math.max(PEEK - 40, Math.min(height, v)))
  }
  const onPointerUp = (e: React.PointerEvent) => {
    if (!start.current) return
    const moved = Math.abs(start.current.y - e.clientY)
    const v = drag ?? stops[state]
    start.current = null
    setDrag(null)
    if (moved < 6) {
      onState(state === 'peek' ? 'half' : state === 'half' ? 'full' : 'peek')
      return
    }
    const nearest = (Object.keys(stops) as SheetState[]).reduce((a, b) => (Math.abs(stops[a] - v) <= Math.abs(stops[b] - v) ? a : b))
    onState(nearest)
  }

  const expanded = state !== 'peek'

  return (
    <div
      ref={ref}
      className={`sheet${drag !== null ? ' is-dragging' : ''}`}
      style={{ transform: `translateY(${Math.max(0, height - visible)}px)` }}
      data-state={state}
      data-height={import.meta.env.DEV ? height : undefined}
    >
      <button
        type="button"
        className="sheet__handle"
        aria-label={expanded ? t('collapse', lang) : t('expand', lang)}
        aria-expanded={expanded}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          start.current = null
          setDrag(null)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onState(state === 'peek' ? 'half' : state === 'half' ? 'full' : 'peek')
          }
        }}
      >
        <span aria-hidden />
      </button>
      <div ref={scrollRef} className="sheet__scroll" style={{ maxHeight: visible - 28 }}>
        {children}
      </div>
    </div>
  )
}
