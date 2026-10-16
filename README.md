# Skopje Statues

A personal tourist guide to the statues of Skopje, built for Hacktoberfest 2026 "Fix My City" at Base42.

Every statue in the city on one map, in Macedonian and English, grouped into themed routes. The Art Bridge gets the deep version: point the camera at one statue and the app walks you along the bridge ("on your left…, on your right…") with audio, a biography, and 3D for a few headline statues.

## What works now

- City map of **114 statues and monuments** merged from OpenStreetMap, Wikidata and English Wikipedia's Art Bridge list
- Five themed routes: Antiquity, Letters and faith, Revolutionaries, Artists, Everyday Skopje
- Statue card with a Wikimedia Commons photo and the Wikipedia summary in MK or EN
- Installable offline web app (PWA): viewed map tiles, photos and summaries are cached

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

The script writes `web/public/statues.geojson` and `web/public/themes.json`.

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
| Wikipedia text | CC BY-SA 4.0 |
| Wikimedia Commons photos | per file (shown with attribution) |

Code: MIT.
