#!/usr/bin/env python3
"""Build web/public/statues.geojson from OpenStreetMap, Wikidata and the Art Bridge list.

Usage:
    python3 data/build_statues.py            # fetch fresh data, cache it in data/raw/
    python3 data/build_statues.py --offline  # rebuild from data/raw/ only (no network)

Fetching goes through `curl` because the macOS system Python's SSL stack fails the
handshake with overpass-api.de.
"""
import argparse
import json
import math
import re
import subprocess
import sys
import time
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent
RAW = ROOT / "raw"
OUT = ROOT.parent / "web" / "public" / "statues.geojson"
UA = "skopje-statues/0.1 (Hacktoberfest 2026 Fix My City)"

# Greater Skopje (south, west, north, east) and the city centre.
BBOX = (41.94, 21.30, 42.06, 21.56)
CENTRE = (41.9961, 21.4314)
ART_BRIDGE_NAME = "Мост на уметноста"

OVERPASS_URLS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"]
WDQS_URL = "https://query.wikidata.org/sparql"

# Wikidata classes: statue, sculpture, monument, memorial, and one found in the first test query.
WD_CLASSES = ["Q179700", "Q860861", "Q4989906", "Q5003624", "Q1779653"]


# ---------------------------------------------------------------- fetching

def curl(args, retries=4):
    for attempt in range(retries):
        res = subprocess.run(["curl", "-s", "-m", "150", "-A", UA, *args], capture_output=True, text=True)
        body = res.stdout.strip()
        if res.returncode == 0 and body.startswith(("{", "[")):
            return json.loads(body)
        wait = 5 * 2 ** attempt
        print(f"  request failed ({body[:60]!r}), retrying in {wait}s", file=sys.stderr)
        time.sleep(wait)
    raise RuntimeError(f"giving up on {args[-1]}")


def cached(name, fetch, offline):
    path = RAW / f"{name}.json"
    if offline:
        return json.loads(path.read_text())
    data = fetch()
    RAW.mkdir(exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=1))
    return data


def fetch_osm():
    s, w, n, e = BBOX
    b = f"{s},{w},{n},{e}"
    query = f"""[out:json][timeout:120];
(
  nwr({b})["tourism"="artwork"]["artwork_type"~"statue|sculpture|bust"];
  nwr({b})["historic"="memorial"]["memorial"~"statue|bust|sculpture"];
  nwr({b})["historic"="monument"];
);
out tags center;
way({b})["bridge"]["name"="{ART_BRIDGE_NAME}"];
out geom tags;"""
    for url in OVERPASS_URLS:
        try:
            return curl(["--data-urlencode", f"data={query}", url])
        except RuntimeError as err:
            print(f"  {err}", file=sys.stderr)
    raise RuntimeError("all Overpass servers failed")


def fetch_wikidata():
    classes = " ".join(f"wd:{c}" for c in WD_CLASSES)
    query = f"""SELECT ?item ?lat ?lon ?mk ?en ?img ?depicts ?depMk ?depEn ?wmk ?wen WHERE {{
  SERVICE wikibase:around {{ ?item wdt:P625 ?loc .
    bd:serviceParam wikibase:center "Point({CENTRE[1]} {CENTRE[0]})"^^geo:wktLiteral .
    bd:serviceParam wikibase:radius "8" . }}
  ?item wdt:P31 ?t . VALUES ?t {{ {classes} }}
  BIND(geof:latitude(?loc) AS ?lat) BIND(geof:longitude(?loc) AS ?lon)
  OPTIONAL {{ ?item rdfs:label ?mk FILTER(LANG(?mk) = "mk") }}
  OPTIONAL {{ ?item rdfs:label ?en FILTER(LANG(?en) = "en") }}
  OPTIONAL {{ ?item wdt:P18 ?img }}
  OPTIONAL {{ ?item wdt:P180 ?depicts . ?depicts wdt:P31 wd:Q5 .
    OPTIONAL {{ ?depicts rdfs:label ?depMk FILTER(LANG(?depMk) = "mk") }}
    OPTIONAL {{ ?depicts rdfs:label ?depEn FILTER(LANG(?depEn) = "en") }} }}
  OPTIONAL {{ ?wmk schema:about ?item ; schema:isPartOf <https://mk.wikipedia.org/> }}
  OPTIONAL {{ ?wen schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }}
}}"""
    return curl(["-G", "-H", "Accept: application/sparql-results+json", "--data-urlencode", f"query={query}", WDQS_URL])


def fetch_art_bridge():
    """People named in the Statues section of English Wikipedia's Art Bridge article."""
    page = curl(["-G", "https://en.wikipedia.org/w/api.php", "--data-urlencode", "action=parse",
                 "--data-urlencode", "prop=wikitext", "--data-urlencode", "format=json",
                 "--data-urlencode", "page=Art Bridge"])
    text = page["parse"]["wikitext"]["*"]
    section = text[text.find("== Statues"):]
    section = section[:section.find("== References")]
    titles = [t for t in re.findall(r"\[\[([^\]|#]+)(?:\|[^\]]*)?\]\]", section)
              if not t.startswith(("File:", "Category:", "Image:"))]
    titles = list(dict.fromkeys(titles))

    props = curl(["-G", "https://en.wikipedia.org/w/api.php", "--data-urlencode", "action=query",
                  "--data-urlencode", "prop=pageprops", "--data-urlencode", "ppprop=wikibase_item",
                  "--data-urlencode", "redirects=1", "--data-urlencode", "format=json",
                  "--data-urlencode", "titles=" + "|".join(titles)])
    redirects = {r["from"]: r["to"] for r in props["query"].get("redirects", [])}
    qid_by_title = {p["title"]: p.get("pageprops", {}).get("wikibase_item")
                    for p in props["query"]["pages"].values()}
    people = [{"title": t, "qid": qid_by_title.get(redirects.get(t, t))} for t in titles]

    qids = [p["qid"] for p in people if p["qid"]]
    entities = curl(["-G", "https://www.wikidata.org/w/api.php", "--data-urlencode", "action=wbgetentities",
                     "--data-urlencode", "ids=" + "|".join(qids), "--data-urlencode", "props=labels|sitelinks|claims",
                     "--data-urlencode", "languages=mk|en", "--data-urlencode", "sitefilter=mkwiki|enwiki",
                     "--data-urlencode", "format=json"])["entities"]
    for p in people:
        ent = entities.get(p["qid"] or "", {})
        labels, links = ent.get("labels", {}), ent.get("sitelinks", {})
        p["mk"] = labels.get("mk", {}).get("value")
        p["en"] = labels.get("en", {}).get("value") or p["title"]
        p["wiki_mk"] = links.get("mkwiki", {}).get("title")
        p["wiki_en"] = links.get("enwiki", {}).get("title") or p["title"]
        p18 = ent.get("claims", {}).get("P18", [])
        p["image"] = p18[0]["mainsnak"]["datavalue"]["value"] if p18 else None
    return people


# ---------------------------------------------------------------- helpers

def norm(name):
    """Comparable form of a statue or person name across OSM and Wikidata spellings."""
    if not name:
        return ""
    s = unicodedata.normalize("NFKD", name.lower())
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = re.sub(r"[„“”\"'()]", " ", s)
    s = re.sub(r"\b(споменик на|споменик|спомен-обележје на|statue of|monument of|monument to|monument)\b", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def dist_m(a, b):
    dy = (a[0] - b[0]) * 111_000
    dx = (a[1] - b[1]) * 111_000 * math.cos(math.radians(a[0]))
    return math.hypot(dx, dy)


def commons_file(value):
    """Commons file name from an OSM image/wikimedia_commons tag or a Wikidata P18 URL/value."""
    if not value:
        return None
    value = value.split("Special:FilePath/")[-1].split("/wiki/")[-1]
    value = re.sub(r"^(File|Image):", "", value)
    if value.startswith("http"):
        return None  # a non-Commons image URL; skip rather than hotlink
    return value.replace("%20", " ")


def wiki_title(url):
    return url.rsplit("/wiki/", 1)[-1].replace("_", " ") if url else None


def qid(url_or_id):
    return url_or_id.rsplit("/", 1)[-1] if url_or_id else None


def blank(source):
    return {"id": None, "name_mk": None, "name_en": None, "subject_qid": None, "subject_mk": None,
            "subject_en": None, "statue_qid": None, "image": None, "wiki_mk": None, "wiki_en": None,
            "group": None, "order": None, "side": None, "position": "mapped", "themes": [],
            "sources": [source]}


# ---------------------------------------------------------------- per source

def from_osm(osm):
    statues, bridge = [], None
    for el in osm["elements"]:
        tags = el.get("tags", {})
        if el["type"] == "way" and "geometry" in el and tags.get("bridge"):
            if bridge is None or len(el["geometry"]) > len(bridge):
                bridge = [(g["lat"], g["lon"]) for g in el["geometry"]]
            continue
        lat = el.get("lat", el.get("center", {}).get("lat"))
        lon = el.get("lon", el.get("center", {}).get("lon"))
        if lat is None or not tags.get("name"):
            continue
        s = blank("osm")
        s.update(id=f"osm-{el['type'][0]}{el['id']}", lat=lat, lon=lon,
                 name_mk=tags.get("name:mk") or tags["name"], name_en=tags.get("name:en"),
                 statue_qid=tags.get("wikidata"), subject_qid=tags.get("subject:wikidata"),
                 image=commons_file(tags.get("wikimedia_commons") or tags.get("image")))
        statues.append(s)
    return statues, bridge


def from_wikidata(wd):
    items = {}
    for row in wd["results"]["bindings"]:
        v = {k: x["value"] for k, x in row.items()}
        q = qid(v["item"])
        s = items.get(q)
        if s is None:
            s = blank("wikidata")
            s.update(id=f"wd-{q}", statue_qid=q, lat=float(v["lat"]), lon=float(v["lon"]),
                     name_mk=v.get("mk"), name_en=v.get("en"), image=commons_file(v.get("img")),
                     wiki_mk=wiki_title(v.get("wmk")), wiki_en=wiki_title(v.get("wen")))
            items[q] = s
        if v.get("depicts") and not s["subject_qid"]:
            s.update(subject_qid=qid(v["depicts"]), subject_mk=v.get("depMk"), subject_en=v.get("depEn"))
    # Unlabelled items are not useful on the map.
    return [s for s in items.values() if s["name_mk"] or s["name_en"]]


def place_on_bridge(bridge, order, side, per_side):
    """Point `order` (1-based) of `per_side` along the bridge, offset ~4 m to its side."""
    if not bridge:
        return CENTRE
    seg_len = [dist_m(bridge[i], bridge[i + 1]) for i in range(len(bridge) - 1)]
    target = sum(seg_len) * (order - 0.5) / per_side if side != "centre" else sum(seg_len) / 2
    for i, length in enumerate(seg_len):
        if target <= length or i == len(seg_len) - 1:
            t = target / length if length else 0
            a, b = bridge[i], bridge[i + 1]
            lat, lon = a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t
            if side in ("left", "right"):
                # Perpendicular offset in degrees, ~4 m.
                dy, dx = b[0] - a[0], (b[1] - a[1]) * math.cos(math.radians(a[0]))
                n = math.hypot(dx, dy) or 1
                k = 4 / 111_000 * (1 if side == "left" else -1)
                lat += dx / n * k
                lon += -dy / n * k / math.cos(math.radians(a[0]))
            return lat, lon
        target -= length
    return bridge[-1]


def from_art_bridge(people, bridge):
    """Statues on the Art Bridge. Order and side come from art_bridge_walk.json once the
    team has walked the bridge; until then they alternate sides in Wikipedia's list order
    and are marked position="approximate"."""
    walk_path = ROOT / "art_bridge_walk.json"
    if not walk_path.exists():
        walk_path.write_text(json.dumps(
            [{"name_en": p["en"], "qid": p["qid"], "order": None, "side": None} for p in people],
            ensure_ascii=False, indent=2))
        print(f"  wrote {walk_path.name}: fill in order and side after the bridge walk")
    walk = {w.get("qid") or w["name_en"]: w for w in json.loads(walk_path.read_text())}

    statues = []
    per_side = max(1, math.ceil(len(people) / 2))
    for i, p in enumerate(people):
        w = walk.get(p["qid"] or p["en"], {})
        walked = w.get("order") is not None and w.get("side")
        order = w["order"] if walked else i // 2 + 1
        side = w["side"] if walked else ("left", "right")[i % 2]
        lat, lon = place_on_bridge(bridge, order, side, per_side)
        s = blank("art-bridge")
        s.update(id=f"ab-{p['qid'] or norm(p['en']).replace(' ', '-')}", lat=lat, lon=lon,
                 name_mk=p["mk"], name_en=p["en"], subject_qid=p["qid"], subject_mk=p["mk"],
                 subject_en=p["en"], image=commons_file(p["image"]), wiki_mk=p["wiki_mk"],
                 wiki_en=p["wiki_en"], group="art-bridge", order=order, side=side,
                 position="walked" if walked else "approximate")
        statues.append(s)
    return statues


# ---------------------------------------------------------------- merge

def same(a, b):
    if a["statue_qid"] and a["statue_qid"] == b["statue_qid"]:
        return True
    d = dist_m((a["lat"], a["lon"]), (b["lat"], b["lon"]))
    if d < 6 and "art-bridge" not in (a["group"], b["group"]):
        return True  # OSM and Wikidata pins for one monument sit within a few metres
    if a["subject_qid"] and a["subject_qid"] == b["subject_qid"] and d < 150:
        return True
    names_a = {norm(a[k]) for k in ("name_mk", "name_en", "subject_mk", "subject_en")} - {""}
    names_b = {norm(b[k]) for k in ("name_mk", "name_en", "subject_mk", "subject_en")} - {""}
    return bool(names_a & names_b) and d < 150


def merge(base, extra):
    for key, value in extra.items():
        if key == "sources":
            base["sources"] = sorted(set(base["sources"]) | set(value))
        elif key in ("lat", "lon", "id", "position"):
            continue  # first source wins on position: OSM, then Art Bridge, then Wikidata
        elif base.get(key) in (None, [], "") and value not in (None, [], ""):
            base[key] = value


def apply_themes(statues):
    themes = json.loads((ROOT / "themes.json").read_text())
    for s in statues:
        names = " ".join(norm(s[k]) for k in ("name_mk", "name_en", "subject_mk", "subject_en"))
        for theme in themes:
            if s["group"] in theme.get("groups", []) or any(norm(m) in names for m in theme["match"]):
                s["themes"].append(theme["id"])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--offline", action="store_true", help="use cached data/raw/ only")
    args = ap.parse_args()

    print("OpenStreetMap…")
    osm_statues, bridge = from_osm(cached("osm", fetch_osm, args.offline))
    print(f"  {len(osm_statues)} named statues/monuments; Art Bridge geometry: {'yes' if bridge else 'no'}")
    print("Art Bridge (Wikipedia + Wikidata)…")
    ab_statues = from_art_bridge(cached("art_bridge", fetch_art_bridge, args.offline), bridge)
    print(f"  {len(ab_statues)} people")
    print("Wikidata…")
    wd_statues = from_wikidata(cached("wikidata", fetch_wikidata, args.offline))
    print(f"  {len(wd_statues)} labelled items")

    statues = []
    for s in osm_statues + ab_statues + wd_statues:
        match = next((t for t in statues if same(t, s)), None)
        if match:
            merge(match, s)
        else:
            statues.append(s)
    apply_themes(statues)

    features = [{"type": "Feature",
                 "geometry": {"type": "Point", "coordinates": [round(s.pop("lon"), 6), round(s.pop("lat"), 6)]},
                 "properties": s} for s in statues]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"type": "FeatureCollection", "features": features}, ensure_ascii=False))
    (OUT.parent / "themes.json").write_text((ROOT / "themes.json").read_text())

    props = [f["properties"] for f in features]
    print(f"\nWrote {len(features)} statues to {OUT.relative_to(ROOT.parent)}")
    print(f"  with English name: {sum(bool(p['name_en']) for p in props)}")
    print(f"  with image:        {sum(bool(p['image']) for p in props)}")
    print(f"  with a Wikipedia article (mk/en): {sum(bool(p['wiki_mk'] or p['wiki_en']) for p in props)}")
    print(f"  in a theme:        {sum(bool(p['themes']) for p in props)}")


if __name__ == "__main__":
    main()
