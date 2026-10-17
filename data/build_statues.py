#!/usr/bin/env python3
"""Build web/public/statues.geojson from OpenStreetMap, Wikidata, Wikimedia Commons and the Art Bridge list.

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
import urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parent
RAW = ROOT / "raw"
OUT = ROOT.parent / "web" / "public" / "statues.geojson"
UA = "skopje-statues/0.2 (Hacktoberfest 2026 Fix My City; https://github.com/FilipStefanovski1)"

# Greater Skopje (south, west, north, east) and the city centre.
BBOX = (41.94, 21.30, 42.06, 21.56)
CENTRE = (41.9961, 21.4314)
ART_BRIDGE_NAME = "Мост на уметноста"

OVERPASS_URLS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"]
WDQS_URL = "https://query.wikidata.org/sparql"
COMMONS_API = "https://commons.wikimedia.org/w/api.php"
# Commons category trees that hold one subcategory per statue in the city.
COMMONS_ROOTS = ["Category:Statues in Skopje", "Category:Sculptures in Skopje", "Category:Busts in Skopje"]

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
  nwr({b})["tourism"="artwork"]["artwork_type"~"statue|sculpture|bust|stele|relief"];
  nwr({b})["historic"="memorial"]["memorial"!~"plaque|stolperstein|street_art|cannon|blue_plaque"];
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


def commons(**params):
    args = ["-G", COMMONS_API]
    for k, v in {**params, "format": "json"}.items():
        args += ["--data-urlencode", f"{k}={v}"]
    return curl(args)


# A category whose name reads as a group ("Statues in Skopje", "City Park statues (Skopje)")
# is walked into; anything else is taken as one statue.
COMMONS_GROUP = re.compile(r"^Category:(Statues|Sculptures|Busts|Reliefs|Equestrian statues)\b"
                           r"|statues \(Skopje\)$|sculptures \(Skopje\)$|in Skopje$", re.I)


def fetch_commons():
    """One record per statue category under COMMONS_ROOTS: its English name, Wikidata item,
    a location (the category's own, else the median of its photos' locations) and a photo."""
    seen, queue, leaves = set(), list(COMMONS_ROOTS), []
    depth = {c: 0 for c in queue}
    while queue:
        cat = queue.pop(0)
        if cat in seen:
            continue
        seen.add(cat)
        if COMMONS_GROUP.search(cat) and depth[cat] < 3:
            members = commons(action="query", list="categorymembers", cmtitle=cat, cmtype="subcat", cmlimit=200)
            for m in members["query"]["categorymembers"]:
                depth.setdefault(m["title"], depth[cat] + 1)
                queue.append(m["title"])
        else:
            leaves.append(cat)

    records = []
    for i in range(0, len(leaves), 50):
        res = commons(action="query", titles="|".join(leaves[i:i + 50]), prop="coordinates|pageprops",
                      ppprop="wikibase_item", coprimary="all")
        for page in res["query"]["pages"].values():
            co = (page.get("coordinates") or [None])[0]
            records.append({"category": page["title"], "qid": page.get("pageprops", {}).get("wikibase_item"),
                            "lat": co and co["lat"], "lon": co and co["lon"], "located_by": co and "category"})

    for r in records:
        files = commons(action="query", generator="categorymembers", gcmtitle=r["category"], gcmtype="file",
                        gcmlimit=40, prop="coordinates", coprimary="all", colimit="max")
        pages = sorted(files.get("query", {}).get("pages", {}).values(), key=lambda p: p["title"])
        r["image"] = pages[0]["title"] if pages else None
        # A few more views of the statue: reference photos for camera recognition.
        r["images"] = [p["title"] for p in pages if re.search(r"\.(jpe?g|png)$", p["title"], re.I)][:4]
        if r["lat"] is None:
            pts = [(c["lat"], c["lon"]) for p in pages for c in p.get("coordinates", [])]
            if pts:
                lats, lons = sorted(p[0] for p in pts), sorted(p[1] for p in pts)
                r.update(lat=lats[len(lats) // 2], lon=lons[len(lons) // 2], located_by="photos")

    qids = sorted({r["qid"] for r in records if r["qid"]})
    labels = {}
    for i in range(0, len(qids), 50):
        ents = curl(["-G", "https://www.wikidata.org/w/api.php", "--data-urlencode", "action=wbgetentities",
                     "--data-urlencode", "ids=" + "|".join(qids[i:i + 50]), "--data-urlencode", "props=labels",
                     "--data-urlencode", "languages=mk|en", "--data-urlencode", "format=json"])["entities"]
        labels.update({q: {l: v["value"] for l, v in e.get("labels", {}).items()} for q, e in ents.items()})
    for r in records:
        r["labels"] = labels.get(r["qid"], {})
    return records


# ---------------------------------------------------------------- helpers

MK_TO_LATIN = dict(zip("абвгдѓежзѕијклљмнњопрстќуфхцчџш",
                       ["a", "b", "v", "g", "d", "gj", "e", "z", "z", "dz", "i", "j", "k", "l", "lj", "m", "n",
                        "nj", "o", "p", "r", "s", "t", "kj", "u", "f", "h", "c", "c", "dz", "s"]))
# Romanisations of the same Macedonian name vary (Delchev / Delčev / Делчев): fold them together.
SPELLING_FOLDS = [("dzh", "dz"), ("zh", "z"), ("ch", "c"), ("sh", "s"), ("kh", "h"), ("ts", "c"), ("y", "j")]
# Names Wikipedia and Commons give the same Art Bridge statue that no rule can fold together.
ART_BRIDGE_ALIASES = {"miladinovci": "miladinov brothers"}


def norm(name):
    """Comparable form of a statue or person name across OSM, Wikidata and Commons spellings."""
    if not name:
        return ""
    s = "".join(MK_TO_LATIN.get(c, c) for c in name.lower())
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    for a, b in SPELLING_FOLDS:
        s = s.replace(a, b)
    s = re.sub(r"[„“”\"'()\-–—,.]", " ", s)
    s = re.sub(r"\((skopje|bridge of arts)\)|, skopje", " ", s)
    # Names are Latin by now, so the Macedonian words appear transliterated (споменик на -> spomenik na).
    s = re.sub(r"\b(spomenik na|spomenik|spomen obelezje na|statue of|statue|monument of|monument to|monument|"
               r"bust of|sculpture of|the)\b", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def dist_m(a, b):
    dy = (a[0] - b[0]) * 111_000
    dx = (a[1] - b[1]) * 111_000 * math.cos(math.radians(a[0]))
    return math.hypot(dx, dy)


def commons_file(value):
    """Commons file name from an OSM image/wikimedia_commons tag or a Wikidata P18 value.
    Categories, local-wiki files and other sites' images are not usable photos."""
    if not value:
        return None
    value = value.strip()
    if value.startswith(("Category:", "category:")):
        return None
    if "upload.wikimedia.org/wikipedia/commons/" in value:
        parts = value.split("?")[0].split("/")
        name = parts[-2] if "/thumb/" in value else parts[-1]
        return urllib.parse.unquote(name).replace("_", " ")
    if "commons.wikimedia.org" in value or "Special:FilePath/" in value:
        value = value.split("Special:FilePath/")[-1].split("/wiki/")[-1]
    elif value.startswith("http"):
        return None  # another site's image: don't hotlink it
    value = re.sub(r"^(File|Image):", "", value)
    if not re.search(r"\.(jpe?g|png|gif|tiff?|webp|svg)$", value, re.I):
        return None
    return urllib.parse.unquote(value).replace("_", " ")


def wiki_title(url):
    return urllib.parse.unquote(url.rsplit("/wiki/", 1)[-1]).replace("_", " ") if url else None


def qid(url_or_id):
    return url_or_id.rsplit("/", 1)[-1] if url_or_id else None


def blank(source):
    return {"id": None, "name_mk": None, "name_en": None, "subject_qid": None, "subject_mk": None,
            "subject_en": None, "statue_qid": None, "image": None, "wiki_mk": None, "wiki_en": None,
            "group": None, "order": None, "side": None, "position": "mapped", "themes": [], "aliases": [], "photos": [],
            "year": None, "height": None, "material": None, "artist": None, "sources": [source]}


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
        s["photos"] = [s["image"]] if s["image"] else []
        s.update(osm_facts(tags))
        statues.append(s)
    return statues, bridge


def osm_facts(tags):
    """The plaque details mappers recorded: when it went up, how tall, what it's made of, by whom."""
    year = re.search(r"\b(1[5-9]\d\d|20\d\d)\b", tags.get("start_date", ""))
    try:
        height = round(float(tags.get("height", "").replace(",", ".").removesuffix("m").strip()), 1)
    except ValueError:
        height = None
    material = tags.get("material", "").split(";")[0].strip().lower() or None
    return {"year": int(year.group(1)) if year else None, "height": height if height and height < 100 else None,
            "material": material, "artist": tags.get("artist_name") or None}


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
            s["photos"] = [s["image"]] if s["image"] else []
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
                 wiki_en=p["wiki_en"], group="art-bridge", order=order, side=side, aliases=[p["title"]],
                 position="walked" if walked else "approximate")
        statues.append(s)
    return statues


def from_commons(records):
    statues = []
    lo_lat, lo_lon, hi_lat, hi_lon = BBOX
    for r in records:
        title = r["category"].removeprefix("Category:")
        on_bridge = title.endswith("(Bridge of Arts)")
        located = r["lat"] is not None and lo_lat < r["lat"] < hi_lat and lo_lon < r["lon"] < hi_lon
        if not located and not on_bridge:
            continue  # no usable location, or photos geotagged outside the city
        # An unlocated Art Bridge statue still lends its photo to the matching bridge entry.
        s = blank("commons")
        s["aliases"] = [title]
        s.update(id=f"cm-{r['qid'] or norm(title).replace(' ', '-')}",
                 lat=r["lat"] if located else None, lon=r["lon"] if located else None,
                 name_mk=r["labels"].get("mk"), name_en=r["labels"].get("en") or re.sub(r" \((Skopje|Bridge of Arts)\)$|, Skopje$", "", title),
                 statue_qid=r["qid"], image=commons_file(r["image"]),
                 group="art-bridge" if on_bridge else None,
                 position="mapped" if r["located_by"] == "category" else "approximate")
        s["photos"] = [f for f in (commons_file(x) for x in r.get("images", [])) if f]
        statues.append(s)
    return statues


# ---------------------------------------------------------------- merge

def skeleton(token):
    return re.sub(r"[aeiou]", "", token)


def names(s):
    out = {norm(s[k]) for k in ("name_mk", "name_en", "subject_mk", "subject_en")} | {norm(a) for a in s["aliases"]}
    return {ART_BRIDGE_ALIASES.get(n, n) for n in out} - {""}


def known_pairs():
    """Reviewed pairs of names (data/same.json) that are one monument under two names."""
    return [(norm(x), norm(y)) for x, y in json.loads((ROOT / "same.json").read_text())]


KNOWN_PAIRS = known_pairs()


def same(a, b):
    if a["statue_qid"] and a["statue_qid"] == b["statue_qid"]:
        return True
    names_a, names_b = names(a), names(b)
    if a["group"] == b["group"] == "art-bridge":
        if names_a & names_b:
            return True
        # Same surname, however it was romanised: Prličev / Parlichev, Džinot / Dzhinot.
        last_a = {skeleton(n.split()[-1]) for n in names_a}
        last_b = {skeleton(n.split()[-1]) for n in names_b}
        return any(x.startswith(y) or y.startswith(x) for x in last_a for y in last_b if min(len(x), len(y)) >= 3)
    if a["lat"] is None or b["lat"] is None:
        return False
    d = dist_m((a["lat"], a["lon"]), (b["lat"], b["lon"]))
    if d < 6 and "art-bridge" not in (a["group"], b["group"]):
        return True  # OSM and Wikidata pins for one monument sit within a few metres
    if a["subject_qid"] and a["subject_qid"] == b["subject_qid"] and d < 150:
        return True
    if any((x in names_a and y in names_b) or (y in names_a and x in names_b) for x, y in KNOWN_PAIRS):
        return d < 800  # reviewed by hand; photo-estimated positions can sit a few hundred metres off
    return bool(names_a & names_b) and d < 150


def merge(base, extra):
    for key, value in extra.items():
        if key == "aliases":
            base["aliases"] = sorted(set(base["aliases"]) | set(value))
        elif key == "photos":
            base["photos"] = list(dict.fromkeys(base["photos"] + value))[:6]
        elif key == "sources":
            base["sources"] = sorted(set(base["sources"]) | set(value))
        elif key in ("lat", "lon", "id", "position") and base["lat"] is not None:
            continue  # first source wins on position: OSM, then Art Bridge, then Wikidata, then Commons
        elif key == "image" and value and "commons" in extra["sources"] and base["group"] == "art-bridge":
            base["image"] = value  # the statue on the bridge, not a portrait of the person
        elif base.get(key) in (None, [], "") and value not in (None, [], ""):
            base[key] = value


LATIN_DIGRAPHS = [("dž", "џ"), ("lj", "љ"), ("nj", "њ"), ("dz", "ѕ")]
LATIN_TO_MK = dict(zip("čćḱǵđžšabcdefghijklmnoprstuvzyw",
                       "чќќѓѓжшабцдефгхијклмнопрстувзјв"))
MK_TO_LATIN_TITLE = {**MK_TO_LATIN, "ж": "zh", "ч": "ch", "ш": "sh", "џ": "dzh", "ѕ": "dz", "ц": "c"}


def to_cyrillic(name):
    """A person's name in Macedonian Cyrillic from its Latin spelling (Stale Popov -> Стале Попов)."""
    out, i, low = [], 0, name.lower()
    while i < len(name):
        pair = low[i:i + 2]
        hit = next((mk for lat, mk in LATIN_DIGRAPHS if pair == lat), None)
        ch = hit or LATIN_TO_MK.get(low[i], name[i])
        upper = name[i].isupper()
        out.append(ch.upper() if upper else ch)
        i += 2 if hit else 1
    return "".join(out)


def to_latin(name):
    """Official Macedonian romanisation (Петар Богданов -> Petar Bogdanov)."""
    out = []
    for c in name:
        lat = MK_TO_LATIN_TITLE.get(c.lower())
        out.append(c if lat is None else (lat.capitalize() if c.isupper() else lat))
    return "".join(out)


def fetch_entities(qids):
    """Short descriptions ("Macedonian singer") and Wikipedia links for the statues and the people they show."""
    out = {}
    qids = sorted(qids)
    for i in range(0, len(qids), 50):
        ents = curl(["-G", "https://www.wikidata.org/w/api.php", "--data-urlencode", "action=wbgetentities",
                     "--data-urlencode", "ids=" + "|".join(qids[i:i + 50]),
                     "--data-urlencode", "props=descriptions|sitelinks|claims", "--data-urlencode", "languages=mk|en",
                     "--data-urlencode", "sitefilter=mkwiki|enwiki", "--data-urlencode", "format=json"])["entities"]
        for q, e in ents.items():
            p18 = e.get("claims", {}).get("P18", [])
            out[q] = {
                "desc": {l: v["value"] for l, v in e.get("descriptions", {}).items()},
                "wiki": {k[:2]: v["title"] for k, v in e.get("sitelinks", {}).items()},
                "image": p18[0]["mainsnak"].get("datavalue", {}).get("value") if p18 else None,
            }
    return out


PERSON_PREFIX = re.compile(r"^(споменик на|споменик|спомен-обележје на|monument of|monument to|statue of|bust of)\s+", re.I)


def person_title(name):
    """A statue named after a person, as that person's article title would read; None otherwise."""
    if not name:
        return None
    title = PERSON_PREFIX.sub("", name).strip(" „“\"")
    title = re.sub(r"\s*\(.*\)$", "", title)
    words = title.split()
    if not 2 <= len(words) <= 4 or not all(w[0].isupper() for w in words if w[0].isalpha()):
        return None
    return title


def fetch_people(candidates):
    """Look each name up as an exact Wikipedia title; keep it only if Wikidata says it is a human."""
    found = {}
    for lang in ("mk", "en"):
        titles = sorted({t for c in candidates for t in [c[lang]] if t})
        for i in range(0, len(titles), 50):
            res = curl(["-G", f"https://{lang}.wikipedia.org/w/api.php", "--data-urlencode", "action=query",
                        "--data-urlencode", "prop=pageprops", "--data-urlencode", "ppprop=wikibase_item|disambiguation",
                        "--data-urlencode", "redirects=1", "--data-urlencode", "format=json",
                        "--data-urlencode", "titles=" + "|".join(titles[i:i + 50])])
            q = res.get("query", {})
            back = {}
            for r in q.get("normalized", []) + q.get("redirects", []):
                back[r["to"]] = back.get(r["from"], r["from"])
            for page in q.get("pages", {}).values():
                props = page.get("pageprops", {})
                if "missing" in page or "disambiguation" in props or "wikibase_item" not in props:
                    continue
                asked = back.get(page["title"], page["title"])
                found[(lang, asked)] = props["wikibase_item"]
    qids = sorted(set(found.values()))
    humans = {}
    for i in range(0, len(qids), 50):
        ents = curl(["-G", "https://www.wikidata.org/w/api.php", "--data-urlencode", "action=wbgetentities",
                     "--data-urlencode", "ids=" + "|".join(qids[i:i + 50]), "--data-urlencode", "props=claims",
                     "--data-urlencode", "format=json"])["entities"]
        for q, e in ents.items():
            p31 = [c["mainsnak"].get("datavalue", {}).get("value", {}).get("id") for c in e.get("claims", {}).get("P31", [])]
            humans[q] = "Q5" in p31
    return {f"{lang}|{title}": q for (lang, title), q in found.items() if humans.get(q)}


def enrich(statues, offline):
    """Fill descriptions, and borrow the depicted person's Wikipedia article when the statue has none."""
    # Statues of people with no linked article: find the person by name (exact title, human only).
    lonely = [s for s in statues if not (s["wiki_mk"] or s["wiki_en"] or s["subject_qid"])]
    cands = [{"id": s["id"], "mk": person_title(s["name_mk"]), "en": person_title(s["name_en"])} for s in lonely]
    people = cached("people", lambda: fetch_people(cands), offline)
    for s, c in zip(lonely, cands):
        q = people.get(f"mk|{c['mk']}") or people.get(f"en|{c['en']}")
        if q:
            s["subject_qid"] = q

    qids = {q for s in statues for q in (s["subject_qid"], s["statue_qid"]) if q}
    ents = cached("entities", lambda: fetch_entities(qids), offline)
    for s in statues:
        subject, statue = ents.get(s["subject_qid"] or "", {}), ents.get(s["statue_qid"] or "", {})
        # A portrait of the person themselves, when it isn't just another photo of this statue.
        portrait = commons_file(subject.get("image"))
        s["person_image"] = portrait if portrait and portrait != s["image"] and s["subject_qid"] != s["statue_qid"] else None
        for lang in ("mk", "en"):
            s[f"desc_{lang}"] = subject.get("desc", {}).get(lang) or statue.get("desc", {}).get(lang)
            if not s[f"wiki_{lang}"]:
                s[f"wiki_{lang}"] = statue.get("wiki", {}).get(lang) or subject.get("wiki", {}).get(lang)


# Words in statue names and photo titles that say nothing about which statue it is.
GENERIC = set("spomenik spomen obelezje statue monument bust sculpture skulptura skopje makedonija macedonia "
              "north severna centar center park gradski city square ploshtad plostad memorial complex kompleks".split())


def photo_matches(statue, title):
    """How many of the statue's distinctive name words a photo's file name carries."""
    words = {w for n in (statue["name_mk"], statue["name_en"], statue.get("subject_en"), statue.get("subject_mk"))
             for w in norm(n).split() if len(w) >= 4 and w not in GENERIC}
    t = norm(title)
    return sum(1 for w in words if w in t)


def find_photos(statues, offline):
    """Photos for statues that came without one: Commons files geotagged right beside the statue,
    or found by its name, kept only when the file name names the statue too."""
    lonely = [s for s in statues if not s["image"]]

    def fetch():
        found = {}
        for s in lonely:
            near = commons(action="query", list="geosearch", gscoord=f"{s['lat']}|{s['lon']}", gsradius=100,
                           gsnamespace=6, gslimit=50).get("query", {}).get("geosearch", [])
            named = []
            for name in {s["name_mk"], s["name_en"]} - {None}:
                hits = commons(action="query", list="search", srsearch=f"{name} Skopje", srnamespace=6, srlimit=20)
                named += [h["title"] for h in hits.get("query", {}).get("search", [])]
                time.sleep(0.3)
            found[s["id"]] = {"near": [n["title"] for n in near], "named": named}
            time.sleep(0.3)
        return found

    # New since the last online run: fetched even in --offline mode, then cached like the rest.
    found = cached("photos", fetch, offline and (RAW / "photos.json").exists())

    # Where the photos found by name were taken, so one from another town doesn't slip in.
    named = sorted({t for f in found.values() for t in f["named"]})

    def fetch_coords():
        out = {}
        for i in range(0, len(named), 10):  # long Cyrillic titles: small batches keep the URL short
            res = commons(action="query", titles="|".join(named[i:i + 10]), prop="coordinates", coprimary="all")
            for page in res.get("query", {}).get("pages", {}).values():
                co = (page.get("coordinates") or [None])[0]
                out[page["title"]] = co and [co["lat"], co["lon"]]
            time.sleep(0.3)
        return out

    coords = cached("photo_coords", fetch_coords, offline and (RAW / "photo_coords.json").exists())
    statue_word = re.compile(r"spomen|споменик|статуа|statue|bust|биста|bista|sculpture|скулптура|skulptura|"
                             r"monument|memorial|fountain|фонтана|porta|порта", re.I)
    # A church, school or building named after the person is not their statue.
    named_after = re.compile(r"crkva|црква|church|kirche|cathedral|соборна|school|училиште|седиште|sediste|\bо\.?у\.?\b|сугс|"
                             r"gimnazija|гимназија|зграда|zgrada|building|ploca|плоча|delegat|zrelost", re.I)
    # Busts of the same people stand in other towns too.
    towns = {"struga", "ohrid", "bitola", "prilep", "radovis", "kumanovo", "veles", "stip", "tetovo", "kicevo",
             "strumica", "gostivar", "krusevo", "resen", "kavadarci", "kocani", "negotino", "berovo",
             "sofia", "sofija", "beograd", "belgrade", "krnjevo"}
    rejects = json.loads((ROOT / "photo_rejects.json").read_text())
    for s in lonely:
        f = found.get(s["id"], {"near": [], "named": []})
        own = set(norm(f"{s['name_mk']} {s['name_en']}").split())

        def elsewhere(t):
            # Another town, or the Art Bridge when this statue stands elsewhere in the city.
            other_bridge = s["group"] != "art-bridge" and re.search(r"мостот на уметноста|art bridge|bridge of arts", t, re.I)
            return bool((set(norm(t).split()) & towns) - own) or bool(other_bridge)

        def ok_named(t):
            at = coords.get(t)
            if at and dist_m((s["lat"], s["lon"]), at) > 400:
                return False
            return statue_word.search(t) and (photo_matches(s, t) >= 2 or (at and photo_matches(s, t) >= 1))

        # Beside the statue, one name word is enough; found by name, the file must also say it is
        # a statue (or bust, monument…) and not have been taken somewhere else.
        picks = [t for t in f["near"] if photo_matches(s, t) >= 1]
        picks += [t for t in f["named"] if ok_named(t)]
        picks = [t for t in dict.fromkeys(picks)
                 if re.search(r"\.(jpe?g|png)$", t, re.I) and not named_after.search(t)
                 and not elsewhere(t) and t not in rejects]
        if picks:
            s["image"] = commons_file(picks[0])
            s["photos"] = [commons_file(t) for t in picks[:4]]
            s["sources"] = sorted(set(s["sources"]) | {"commons-search"})


def apply_people(statues):
    """Reviewed descriptions and English stories (data/people.json) over Wikidata's and Wikipedia's."""
    reviewed = json.loads((ROOT / "people.json").read_text())
    content = OUT.parent / "content"
    content.mkdir(parents=True, exist_ok=True)
    for old in content.glob("*.en.json"):
        old.unlink()
    for s in statues:
        r = reviewed.get(s["id"]) or reviewed.get(s["subject_qid"] or "")
        if not r:
            continue
        if r.get("unlink"):  # matched to the wrong person by name
            s["subject_qid"] = s["person_image"] = None
            s["wiki_en"] = r.get("wiki_en")
        for lang in ("mk", "en"):
            if r.get(lang):
                s[f"desc_{lang}"] = r[lang]
        if r.get("story_en"):
            (content / f"{s['id']}.en.json").write_text(json.dumps({"bio": r["story_en"]}, ensure_ascii=False))


def number(statues):
    """A collection number for each statue, like a field guide: by theme, the photographed ones first."""
    order = [t["id"] for t in json.loads((ROOT / "themes.json").read_text())]
    rank = lambda s: (s["statue_qid"] != "Q3497603",  # № 001 is the Warrior on Horseback, the city's emblem
                      min((order.index(t) for t in s["themes"] if t in order), default=len(order)),
                      not s["image"], (s["name_en"] or s["name_mk"] or "").lower())
    for i, s in enumerate(sorted(statues, key=rank), 1):
        s["no"] = i
        # Artists are recorded in Cyrillic; English readers get the Latin spelling.
        artist = (s.pop("artist") or "").strip(" .").replace(" - ", "-") or None
        s["artist_mk"] = to_cyrillic(artist) if artist and not re.search("[а-ш]", artist) else artist
        s["artist_en"] = to_latin(artist) if artist and re.search("[а-ш]", artist) else artist


def fill_names(statues):
    """Reviewed names first (data/names.json), then transliteration where it is reliable."""
    reviewed = json.loads((ROOT / "names.json").read_text())
    for s in statues:
        for lang, value in reviewed.get(s["id"], {}).items():
            s[f"name_{lang}"] = value
        # People's names transliterate faithfully; titles like "Horse fountain" do not.
        if not s["name_mk"] and s["group"] == "art-bridge" and s["name_en"]:
            s["name_mk"] = to_cyrillic(s["name_en"])
            s["subject_mk"] = s["subject_mk"] or s["name_mk"]
        if not s["name_en"] and s["name_mk"]:
            cyrillic = re.search(r"[а-шѓќѕјљњџ]", s["name_mk"], re.I)
            s["name_en"] = to_latin(s["name_mk"]) if cyrillic else s["name_mk"]


def apply_themes(statues):
    themes = json.loads((ROOT / "themes.json").read_text())
    for s in statues:
        names = " ".join(norm(s[k]) for k in ("name_mk", "name_en", "subject_mk", "subject_en")) + " " + \
            " ".join(norm(a) for a in s["aliases"])
        for theme in themes:
            if s["group"] in theme.get("groups", []) or any(re.search(rf"\b{re.escape(norm(m))}\b", names) for m in theme["match"]):
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
    print("Wikimedia Commons…")
    cm_statues = from_commons(cached("commons", fetch_commons, args.offline))
    print(f"  {len(cm_statues)} located statue categories")

    statues = []
    for s in osm_statues + ab_statues + wd_statues + cm_statues:
        match = next((t for t in statues if same(t, s)), None)
        if match:
            merge(match, s)
        else:
            statues.append(s)
    statues = [s for s in statues if s["lat"] is not None]  # an unmatched, unlocated photo category
    excluded = json.loads((ROOT / "exclude.json").read_text())
    statues = [s for s in statues if s["id"] not in excluded]
    fill_names(statues)
    enrich(statues, args.offline)
    find_photos(statues, args.offline)
    apply_people(statues)
    apply_themes(statues)
    number(statues)

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
