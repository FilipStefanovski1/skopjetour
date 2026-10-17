/**
 * NFC plaques hold a link like https://<site>/#/tag/<statue-id>.
 * - iPhone: iOS reads the tag itself and opens that link; no button needed.
 * - Android Chrome: the page can read tags itself through Web NFC (NDEFReader).
 */

interface NDEFRecord {
  recordType: string
  data?: DataView
  encoding?: string
}
interface NDEFReadingEvent extends Event {
  message: { records: NDEFRecord[] }
}
interface NDEFReaderLike {
  scan(options?: { signal?: AbortSignal }): Promise<void>
  addEventListener(type: 'reading', cb: (e: NDEFReadingEvent) => void): void
  addEventListener(type: 'readingerror', cb: () => void): void
}

export const canScanInPage = typeof window !== 'undefined' && 'NDEFReader' in window
export const isIOS = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent)

/** The statue a tag points at: `…/#/tag/<id>` (or an older `…/#/s/<id>`), or a bare id. */
export function statueIdFrom(text: string): string | null {
  const link = text.match(/\/(?:tag|s)\/([^/?#\s]+)/)
  if (link) return decodeURIComponent(link[1])
  const bare = text.trim()
  return /^[a-z]{2}-[\w-]+$/i.test(bare) ? bare : null
}

function recordText(r: NDEFRecord): string {
  if (!r.data) return ''
  return new TextDecoder(r.encoding || 'utf-8').decode(r.data)
}

/** Listen for plaques until aborted; calls back with each statue id read. */
export async function scanPlaques(signal: AbortSignal, onStatue: (id: string) => void, onUnreadable: () => void) {
  const Reader = (window as unknown as { NDEFReader: new () => NDEFReaderLike }).NDEFReader
  const reader = new Reader()
  reader.addEventListener('reading', (e) => {
    for (const r of e.message.records) {
      const id = statueIdFrom(recordText(r))
      if (id) return onStatue(id)
    }
    onUnreadable()
  })
  reader.addEventListener('readingerror', onUnreadable)
  await reader.scan({ signal })
}
