# Skopje Statues

A personal tourist guide to the statues of Skopje, built for Hacktoberfest 2026 "Fix My City" at Base42.

Every statue in the city on one map, in Macedonian and English, grouped into themed routes. The Art Bridge gets the deep version: point the camera at one statue and the app walks you along the bridge ("on your left…, on your right…") with audio, a biography, and 3D for a few headline statues.

## What works now

- City map of **127 statues and monuments** merged from OpenStreetMap, Wikidata, Wikimedia Commons and English Wikipedia's Art Bridge list
- All 27 named Art Bridge statues, with photos of the statues themselves
- Three tabs: **Scan** (home: hold the phone to a statue's NFC plaque; demo scan for tryouts), **Map**, and **Collection** (every statue as a tile, found ones in colour)
- NFC: plaques hold a `#/s/<statue-id>` link; iPhones open it natively, Android Chrome can also scan in-page (Web NFC). Opening a plaque link collects the statue
- **Snap a statue**: on-phone photo recognition with an open model (DINOv2-small via transformers.js) against 318 reference photos of 85 statues, nudged by GPS; the visitor confirms the match
- **3D**: the Warrior on Horseback (Alexander the Great) as a rotatable 3D model with AR (`<model-viewer>`), opened straight after a scan
- **Tour-guide voice**: a written tour for the headline statue and the Wikipedia story for the rest, spoken by the phone (Web Speech API, MK or EN)
- **The real person**: portraits from Wikidata beside the statue photo (61 statues)
- Every statue is a round photo of itself on a calm light map (MapLibre + OpenFreeMap vector tiles); nearby statues group into photo bubbles
- Swipeable cards along the bottom (photo, who they were, distance or stop number) synced with the map
- Full-screen story: big photo, one-line description, Wikipedia story in MK or EN, "mark as seen", next/previous (buttons or sideways swipe)
- Five themed routes as chips; a route draws as a dotted walking line with numbered photo pins
- Search by name; shareable links per route and statue (`#/route/<id>/s/<id>`), ready for NFC/QR plaques
- Installable offline web app (PWA): viewed map tiles, fonts, photos and stories are cached

See [TODO.md](TODO.md) for what's done and what's left.

## Run it

```bash
cd web
npm install
npm run dev
```

## Rebuild the data

```bash
cd web
npm run data          # fetch OSM, Wikidata and Wikipedia; caches raw responses in data/raw/
npm run data:offline  # rebuild from the cache only
```

The script writes `web/public/statues.geojson` and `web/public/themes.json`. Then rebuild the photo-recognition index:

```bash
cd web
npm run embed   # writes public/embeddings.json from each statue's Commons photos
``` Statues found in several sources are merged by Wikidata ID, by name (Cyrillic and Latin spellings are folded together) within 150 m, or by a reviewed pair in `data/same.json`. Positions estimated from Commons photos are marked `"position": "approximate"`.

### After the Art Bridge walk

`data/art_bridge_walk.json` lists the 27 people on the bridge. Fill in `order` (1 = the end nearest a fixed landmark, e.g. the Old Bazaar side) and `side` (`left`, `right` or `centre`) for each, then rerun `npm run data:offline`. Walked statues are placed along the real bridge geometry; the rest stay marked as approximate.

### Themes

Edit `data/themes.json`. A statue joins a theme when any `match` string appears in its Macedonian or English name, or when its `group` is listed in `groups`.

## Generated stories and audio

Drop pre-generated content into `web/public/content/<statue-id>.<mk|en>.json`:

```json
{ "bio": "…", "audio": "/content/audio/<statue-id>.en.mp3" }
```

The card prefers this over the Wikipedia summary.

## Next

- [ ] Biography pipeline: Ollama (Qwen3.5-9B for EN, domestic-yak-8B for MK) from cached Wikipedia text
- [ ] Audio: Kokoro (EN), recorded voice (MK)
- [ ] Camera recognition for the Art Bridge (SigLIP 2 embeddings + GPS + bridge order)
- [ ] Walk-through mode (left/right, next, autoplay)
- [ ] 3D and AR for three headline statues (`<model-viewer>` + TRELLIS)

## Data and licences

| Source | Licence |
| --- | --- |
| OpenStreetMap | ODbL |
| Wikidata | CC0 |
| Wikimedia Commons category names and coordinates | CC BY-SA 4.0 (page content) |
| Wikipedia text | CC BY-SA 4.0 |
| Wikimedia Commons photos | per file (shown with attribution) |

Code: MIT.
