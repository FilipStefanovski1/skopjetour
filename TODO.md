# TODO

Hackathon: Hacktoberfest 2026 "Fix My City", Base42, Sat 17 Oct 2026. Build 12:00–13:00 and 14:00–17:00, demos 17:00.

## Done (pre-event prep, 16 Oct)

- [x] Research: problems, open data, open models, judging context (shared doc)
- [x] Data pipeline `data/build_statues.py`: merges OpenStreetMap, Wikidata, Wikimedia Commons and the Art Bridge list; caches raw data for offline rebuilds
- [x] **128 statues and monuments** across Skopje, de-duplicated across sources (Cyrillic/Latin transliteration, reviewed pairs in `data/same.json`)
- [x] All 27 named Art Bridge statues placed along the real bridge (approximate order) with photos of the statues themselves
- [x] Five themed routes: Antiquity, Letters and faith, Revolutionaries, Artists, Everyday Skopje (91 statues in a route)
- [x] Web app: Vite + React PWA, MapLibre sprint-orienteering city map, routes, MK/EN toggle
- [x] Statue card: Commons photo, depicted person, routes, Wikipedia summary in MK or EN, position notes
- [x] Works offline after first load (viewed tiles, photos and summaries cached)
- [x] Public-repo basics: MIT licence, README, git history under your name
- [x] Product brief `web/PRODUCT.md`

## Tonight (before the event)

- [x] Redesign: orienteering-course world (sprint-map basemap, purple courses, numbered stops, description sheet), MK + EN
- [ ] **Art Bridge walk** (~40 min): count statues, record each one's order and side in `data/art_bridge_walk.json`, take 3–5 photos per statue, check whether pedestals carry names, note GPS at both ends
- [ ] Photograph 2–3 headline statues for 3D (front, clean background)
- [ ] Pull models: `qwen3.5:9b`, domestic-yak-8B (GGUF), Kokoro (English TTS); download SigLIP 2
- [ ] Generate 3D models for 3 headline statues on the TRELLIS Hugging Face Space
- [ ] Test AR with a sample model on one iPhone (Safari) and one Android phone
- [ ] Check the registration form: it says it no longer accepts responses; contact Base42 if not registered
- [ ] Re-run `npm run data` once for fresh data, then keep `--offline` for the event

## At the event — build (in priority order)

- [ ] Ask organisers at 10:00: is pre-event prep allowed? Is hosted inference OK or local only? Judging criteria?
- [ ] **Biography pipeline**: Ollama writes MK (domestic-yak) and EN (Qwen3.5) biographies from cached Wikipedia text into `web/public/content/<id>.<lang>.json`, short and long versions
- [ ] **Audio**: English with Kokoro; record Macedonian for the headline statues
- [ ] **Camera recognition (Art Bridge)**: SigLIP 2 embeddings of the reference photos; phone photo + GPS → top 3 matches; pedestal name as tie-breaker
- [ ] **Walk-through mode**: after one scan, "on your left… / on your right…", next/previous, audio autoplay, using bridge order
- [ ] **3D and AR** for the headline statues with `<model-viewer>`
- [x] Route view: each theme drawn as a walking course with minutes per leg and a total
- [x] Statue list view with search (accessible alternative to the map)
- [ ] First-visit setup: language, interests, short or long stories
- [ ] Deploy on HTTPS (Cloudflare Pages / Vercel / GitHub Pages) and push the public repo

## Demo and pitch

- [ ] 3 slides: problem (statues nobody can identify; Art Bridge on no open map), live demo, models + licences + what's next
- [ ] Rehearse the 90-second flow: scan a statue photo → walk-through audio → 3D/AR on the table → map with all 128
- [ ] Record a 60-second backup video
- [ ] README: model and licence table, data sources, how to run

## After the hackathon (how it continues)

- [ ] NFC/QR plaques at each statue (same `/s/<id>` URL as the camera scan)
- [ ] Bridge of Civilizations, Macedonia Square and City Park walk-throughs
- [ ] Contribute the Art Bridge statue list and positions back to OpenStreetMap and Wikidata
- [ ] Confirm photo-estimated positions on site (marked "approximate" in the data)
- [ ] More tourist languages via the same pipeline
- [ ] Airport and tourist-office posters with a QR code to install the offline guide

## Known data gaps

- 19 statues have no English name; 44 have no photo; 70 have no Wikipedia article in either language
- Positions estimated from Commons photos can be a few dozen to a few hundred metres off until checked on site
- Bridge of Civilizations statues are not yet in any source with names and positions
