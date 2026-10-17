import { metresBetween } from './course'
import type { Statue } from './types'

/**
 * Photo recognition, entirely on the phone: an open image model (DINOv2-small, Apache-2.0,
 * via transformers.js) turns the photo into a vector, compared with vectors of 2–6 reference
 * photos of each statue computed ahead of time by scripts/embed-statues.mjs.
 * The model and dtype here must match that script exactly.
 */
export const MODEL_ID = 'Xenova/dinov2-small'
export const MODEL_DTYPE = 'q8'

interface IndexFile {
  model: string
  dim: number
  items: { id: string; v: string[] }[]
}

export interface Match {
  id: string
  score: number
}

type Loaded = {
  embed: (image: Blob) => Promise<Float32Array>
  index: Map<string, Float32Array[]>
}

let loading: Promise<Loaded> | null = null

function decode(b64: string, dim: number): Float32Array {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
  const v = new Float32Array(dim)
  for (let i = 0; i < dim; i++) v[i] = ((bytes[i] << 24) >> 24) / 127
  return normalise(v)
}

function normalise(v: Float32Array): Float32Array {
  let n = 0
  for (const x of v) n += x * x
  n = Math.sqrt(n) || 1
  for (let i = 0; i < v.length; i++) v[i] /= n
  return v
}

/** Loads the model (≈24 MB the first time, then cached) and the reference index. */
export function loadRecognizer(onProgress?: (share: number) => void): Promise<Loaded> {
  loading ??= (async () => {
    const [{ AutoModel, AutoProcessor, RawImage }, res] = await Promise.all([import('@huggingface/transformers'), fetch('/embeddings.json')])
    const file: IndexFile = await res.json()
    const index = new Map<string, Float32Array[]>()
    for (const item of file.items) index.set(item.id, item.v.map((b) => decode(b, file.dim)))

    const files = new Map<string, number>()
    const progress = (p: { status: string; file?: string; progress?: number }) => {
      if (p.status === 'progress' && p.file) {
        files.set(p.file, p.progress ?? 0)
        const all = [...files.values()]
        onProgress?.(all.reduce((a, b) => a + b, 0) / (all.length * 100))
      }
    }
    const [model, processor] = await Promise.all([
      AutoModel.from_pretrained(MODEL_ID, { dtype: MODEL_DTYPE, progress_callback: progress }),
      AutoProcessor.from_pretrained(MODEL_ID, { progress_callback: progress }),
    ])
    onProgress?.(1)

    const embed = async (blob: Blob) => {
      const image = await RawImage.fromBlob(blob)
      const inputs = await processor(image)
      const out = await model(inputs)
      const pooled = out.pooler_output ?? out.last_hidden_state
      return normalise(Float32Array.from((pooled.data as Float32Array).slice(0, file.dim)))
    }
    return { embed, index }
  })()
  loading.catch(() => (loading = null))
  return loading
}

function dot(a: Float32Array, b: Float32Array): number {
  let s = 0
  for (let i = 0; i < a.length; i++) s += a[i] * b[i]
  return s
}

// One model run at a time (the in-browser session can't run two at once), and one run per photo.
let queue: Promise<unknown> = Promise.resolve()
const vectors = new WeakMap<Blob, Promise<Float32Array>>()

function embedOnce(photo: Blob, embed: (b: Blob) => Promise<Float32Array>): Promise<Float32Array> {
  let v = vectors.get(photo)
  if (!v) {
    v = queue.then(() => embed(photo))
    queue = v.catch(() => undefined)
    vectors.set(photo, v)
  }
  return v
}

/** Best-matching statues for a photo; nearby statues get a nudge when the location is known. */
export async function recognise(photo: Blob, statues: Statue[], near: { lat: number; lon: number } | null, onProgress?: (share: number) => void): Promise<Match[]> {
  const { embed, index } = await loadRecognizer(onProgress)
  const q = await embedOnce(photo, embed)
  const byId = new Map(statues.map((s) => [s.id, s]))
  const scored: Match[] = []
  for (const [id, refs] of index) {
    const s = byId.get(id)
    if (!s) continue
    let score = Math.max(...refs.map((r) => dot(q, r)))
    if (near) {
      const d = metresBetween(near, s)
      score += d < 150 ? 0.06 : d > 1500 ? -0.08 : 0
    }
    scored.push({ id, score })
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, 3)
}

/**
 * How sure we are, for the label beside each guess. Bronze statues all look alike to the model,
 * so what counts is how far the best guess leads the rest, not the raw similarity.
 */
export function certainty(m: Match, all: Match[]): 'sure' | 'maybe' | 'unsure' {
  const [best, second] = all
  if (m === best) {
    const lead = best.score - (second?.score ?? 0)
    return best.score >= 0.5 && lead >= 0.05 ? 'sure' : best.score >= 0.35 ? 'maybe' : 'unsure'
  }
  return best.score - m.score < 0.03 ? 'maybe' : 'unsure'
}
