# Product


## Platform

web

## Users

Tourists walking Skopje's centre, on a phone, standing near or between statues and mostly reading English. Locals use the same app in Macedonian. Tomorrow's first audience is the Hacktoberfest 2026 "Fix My City" judges at Base42, who will try it on their own phones.

## Product Purpose

A personal tourist guide to the statues of Skopje. The city holds well over a hundred statues and monuments, most with no explanation a visitor can read. The app puts every one on a map, says who each figure is in Macedonian or English, and groups them into themed routes. Success: a visitor standing in front of a statue finds out who it is and why it matters in under ten seconds.

## Positioning

Every statue in the city on one open map, built from OpenStreetMap, Wikidata and Wikipedia, in the visitor's language, for free. Existing tours are paid, fixed scripts covering a handful of stops. The Art Bridge's ~29 statues are on no open map at all; this app is the first to place them.

## Operating Context

Outdoors, one-handed, in sunlight, often on roaming data or none. Visitors move between nearby statues on Macedonia Square, the Stone Bridge, the Art Bridge and the Vardar quays. Installable web app (PWA); caches viewed tiles, photos and summaries for offline use.

## Capabilities and Constraints

- City map of 128 statues and monuments merged by `data/build_statues.py` from OSM, Wikidata, Wikimedia Commons and English Wikipedia's Art Bridge list.
- Themed routes: Antiquity, Letters and faith, Revolutionaries, Artists, Everyday Skopje.
- Photo pins, swipe cards and a full-screen story (photo, Wikidata description, Wikipedia summary in MK or EN); pre-generated biographies and audio in `public/content/` override the summary when present.
- Languages: Macedonian and English only.
- Art Bridge positions are approximate until the on-site walk fills `data/art_bridge_walk.json`.
- Planned, not built: camera recognition, left/right walk-through mode, 3D/AR for three statues, generated biographies and audio.
- Stack: Vite + React + TypeScript, MapLibre GL with OpenFreeMap vector tiles, vite-plugin-pwa.

## Brand Commitments

Name: "Skopje Statues" / "Споменици на Скопје".

## Evidence on Hand

Real data only: `public/statues.geojson`, Wikimedia Commons photos (per-file licences, attributed), Wikipedia summaries. No user counts, testimonials or partnerships exist; do not invent them.

## Product Principles

1. Answer "who is this?" before anything else.
2. Works where the visitor is: a phone, outdoors, with weak or no signal.
3. Every fact traces to an open source the visitor can open.
4. The city's statues are the content; the interface stays out of their way.

## Accessibility & Inclusion

Readable in bright sunlight; large touch targets for one-handed use; full keyboard and screen-reader access to the statue list, not only the map.
