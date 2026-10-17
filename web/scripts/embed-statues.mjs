#!/usr/bin/env node
/**
 * Builds public/embeddings.json: DINOv2-small vectors of each statue's reference photos, for
 * on-phone photo recognition (src/recognize.ts). Run after `npm run data`:
 *
 *   node scripts/embed-statues.mjs
 *
 * Model and dtype must match src/recognize.ts.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { AutoModel, AutoProcessor, RawImage } from '@huggingface/transformers'

const MODEL_ID = 'Xenova/dinov2-small'
const MODEL_DTYPE = 'q8'
const UA = 'skopje-statues/0.2 (Hacktoberfest 2026 Fix My City; https://github.com/FilipStefanovski1/skopjetour)'
const root = new URL('..', import.meta.url)

const geo = JSON.parse(readFileSync(new URL('public/statues.geojson', root), 'utf8'))
const model = await AutoModel.from_pretrained(MODEL_ID, { dtype: MODEL_DTYPE })
const processor = await AutoProcessor.from_pretrained(MODEL_ID)

async function fetchPhoto(file) {
  const url = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=480`
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } })
    if (res.ok) return res.blob()
    await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)))
  }
  throw new Error(`could not fetch ${file}`)
}

function toInt8Base64(v) {
  let n = 0
  for (const x of v) n += x * x
  n = Math.sqrt(n) || 1
  const bytes = Uint8Array.from(v, (x) => (Math.round((x / n) * 127) + 256) % 256)
  return Buffer.from(bytes).toString('base64')
}

const items = []
let dim = 0
let done = 0
for (const f of geo.features) {
  const { id, photos = [] } = f.properties
  const vectors = []
  for (const file of photos.slice(0, 5)) {
    try {
      const image = await RawImage.fromBlob(await fetchPhoto(file))
      const out = await model(await processor(image))
      const pooled = out.pooler_output ?? out.last_hidden_state
      dim = pooled.dims.at(-1)
      vectors.push(toInt8Base64(Array.from(pooled.data.slice(0, dim))))
    } catch (err) {
      console.warn(`  skipped ${file}: ${err.message}`)
    }
  }
  if (vectors.length) items.push({ id, v: vectors })
  done++
  if (done % 10 === 0) console.log(`${done}/${geo.features.length} statues`)
}

writeFileSync(new URL('public/embeddings.json', root), JSON.stringify({ model: MODEL_ID, dtype: MODEL_DTYPE, dim, items }))
console.log(`wrote public/embeddings.json: ${items.length} statues, ${items.reduce((n, i) => n + i.v.length, 0)} reference photos, dim ${dim}`)
