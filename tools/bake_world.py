#!/usr/bin/env python3
"""
bake_world.py — Offline world baker for LHX Castelbolognese.

Downloads REAL data once and writes compact static assets into web/assets/world/:
  * height.bin  : Uint16 LE heightmap (GRID x GRID), h_m = v * SCALE + OFFSET
  * world.json  : metadata (projection, grid, scale/offset, bbox, min/max height)
  * osm.json    : buildings, roads, water, land-use areas, trees, walls, rail, places
                  all already projected to local game metres (x = East, z = South).

Pure standard library (no pip installs) so it runs anywhere with Python 3.9+.
Run it on any machine (the J1900 too):  python3 tools/bake_world.py
The server never runs this at request time: it only serves the static output.

Sources:
  * Elevation: AWS Terrain Tiles (Terrarium encoding), public bucket
      https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png
      (in Italy derived mainly from EU-DEM / SRTM; ~20-30 m true resolution)
  * Vector data: OpenStreetMap via Overpass API (ODbL — keep attribution in-game).
"""
import json, math, os, struct, sys, time, urllib.parse, urllib.request, zlib

# ------------------------------------------------------------------ config
CENTER_LAT = 44.31957      # Piazza Bernardi, Castel Bolognese
CENTER_LON = 11.79937
SIZE_M = 8192              # world edge in metres (square, centred on CENTER)
GRID = 513                 # heightmap samples per edge -> 16 m spacing
DEM_ZOOM = 14              # terrarium zoom (~6.8 m/px at this latitude)
HEIGHT_OFFSET = -100.0     # stored = (h - OFFSET) / SCALE
HEIGHT_SCALE = 0.1         # 10 cm precision
OVERPASS_URLS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]
UA = "LHX-Castelbolognese-baker/1.0 (personal hobby project)"

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "web", "assets", "world")
CACHE = os.path.join(ROOT, "tools", ".cache")   # git-ignored

R_EARTH = 6378137.0
M_PER_DEG_LAT = math.pi * R_EARTH / 180.0
M_PER_DEG_LON = M_PER_DEG_LAT * math.cos(math.radians(CENTER_LAT))


def to_local(lat, lon):
    """Local equirectangular projection. x = East, z = South (Three.js: -z is North)."""
    return ((lon - CENTER_LON) * M_PER_DEG_LON, -(lat - CENTER_LAT) * M_PER_DEG_LAT)


def to_latlon(x, z):
    return (CENTER_LAT - z / M_PER_DEG_LAT, CENTER_LON + x / M_PER_DEG_LON)


HALF = SIZE_M / 2
LAT_N, LON_W = to_latlon(-HALF, -HALF)
LAT_S, LON_E = to_latlon(HALF, HALF)


def http_get(url, data=None, tries=3):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, data=data, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=180) as r:
                return r.read()
        except Exception as e:  # noqa
            print(f"  ! {url[:70]}... failed ({e}), retry {i + 1}/{tries}")
            time.sleep(3 * (i + 1))
    raise RuntimeError("download failed: " + url)


def cached(name, fetch):
    os.makedirs(CACHE, exist_ok=True)
    p = os.path.join(CACHE, name)
    if os.path.exists(p):
        with open(p, "rb") as f:
            return f.read()
    data = fetch()
    with open(p, "wb") as f:
        f.write(data)
    return data


# ------------------------------------------------------------------ minimal PNG decoder (8-bit RGB/RGBA, non-interlaced)
def decode_png(data):
    assert data[:8] == b"\x89PNG\r\n\x1a\n", "not a PNG"
    pos, idat, w = 8, b"", 0
    while pos < len(data):
        ln = struct.unpack(">I", data[pos:pos + 4])[0]
        typ = data[pos + 4:pos + 8]
        body = data[pos + 8:pos + 8 + ln]
        if typ == b"IHDR":
            w, h, depth, ctype, _, _, interlace = struct.unpack(">IIBBBBB", body)
            assert depth == 8 and ctype in (2, 6) and interlace == 0, "unsupported PNG"
            bpp = 3 if ctype == 2 else 4
        elif typ == b"IDAT":
            idat += body
        elif typ == b"IEND":
            break
        pos += 12 + ln
    raw = zlib.decompress(idat)
    stride = w * bpp
    out = bytearray(h * stride)
    prev = bytearray(stride)
    i = 0
    for y in range(h):
        f = raw[i]; i += 1
        line = bytearray(raw[i:i + stride]); i += stride
        if f == 1:
            for x in range(bpp, stride): line[x] = (line[x] + line[x - bpp]) & 255
        elif f == 2:
            for x in range(stride): line[x] = (line[x] + prev[x]) & 255
        elif f == 3:
            for x in range(stride):
                a = line[x - bpp] if x >= bpp else 0
                line[x] = (line[x] + ((a + prev[x]) >> 1)) & 255
        elif f == 4:
            for x in range(stride):
                a = line[x - bpp] if x >= bpp else 0
                b = prev[x]; c = prev[x - bpp] if x >= bpp else 0
                p = a + b - c; pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                line[x] = (line[x] + pr) & 255
        out[y * stride:(y + 1) * stride] = line
        prev = line
    return w, h, bpp, out


# ------------------------------------------------------------------ DEM
def merc_px(lat, lon, z):
    n = 2 ** z * 256
    x = (lon + 180.0) / 360.0 * n
    s = math.sin(math.radians(lat))
    y = (0.5 - math.log((1 + s) / (1 - s)) / (4 * math.pi)) * n
    return x, y


def bake_height():
    print("[DEM] downloading terrarium tiles...")
    x0, y0 = merc_px(LAT_N, LON_W, DEM_ZOOM)
    x1, y1 = merc_px(LAT_S, LON_E, DEM_ZOOM)
    tx0, ty0, tx1, ty1 = int(x0 // 256), int(y0 // 256), int(x1 // 256), int(y1 // 256)
    tiles = {}
    for ty in range(ty0, ty1 + 1):
        for tx in range(tx0, tx1 + 1):
            url = f"https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{DEM_ZOOM}/{tx}/{ty}.png"
            png = cached(f"terrarium_{DEM_ZOOM}_{tx}_{ty}.png", lambda u=url: http_get(u))
            w, h, bpp, px = decode_png(png)
            hm = [0.0] * (256 * 256)
            for k in range(256 * 256):
                o = k * bpp
                hm[k] = px[o] * 256 + px[o + 1] + px[o + 2] / 256.0 - 32768.0
            tiles[(tx, ty)] = hm
    print(f"[DEM] {len(tiles)} tiles decoded")

    def sample(px_, py_):
        tx, ty = int(px_ // 256), int(py_ // 256)
        t = tiles.get((tx, ty))
        if t is None:
            return 0.0
        return t[int(py_ % 256) * 256 + int(px_ % 256)]

    def bilinear(px_, py_):
        fx, fy = px_ - 0.5, py_ - 0.5
        ix, iy = math.floor(fx), math.floor(fy)
        ax, ay = fx - ix, fy - iy
        a = sample(ix, iy); b = sample(ix + 1, iy)
        c = sample(ix, iy + 1); d = sample(ix + 1, iy + 1)
        return (a * (1 - ax) + b * ax) * (1 - ay) + (c * (1 - ax) + d * ax) * ay

    step = SIZE_M / (GRID - 1)
    heights = []
    for j in range(GRID):
        z = -HALF + j * step
        for i in range(GRID):
            x = -HALF + i * step
            lat, lon = to_latlon(x, z)
            heights.append(bilinear(*merc_px(lat, lon, DEM_ZOOM)))
    hmin, hmax = min(heights), max(heights)
    buf = bytearray()
    for hv in heights:
        v = int(round((hv - HEIGHT_OFFSET) / HEIGHT_SCALE))
        buf += struct.pack("<H", max(0, min(65535, v)))
    with open(os.path.join(OUT, "height.bin"), "wb") as f:
        f.write(buf)
    ci = (GRID // 2) * GRID + GRID // 2
    print(f"[DEM] height.bin written: {GRID}x{GRID}, min {hmin:.1f} m, max {hmax:.1f} m, centre {heights[ci]:.1f} m")
    return hmin, hmax, heights[ci]


# ------------------------------------------------------------------ OSM
def overpass_query():
    b = f"{LAT_S:.6f},{LON_W:.6f},{LAT_N:.6f},{LON_E:.6f}"
    return f"""[out:json][timeout:180];
(
  way["building"]({b});
  way["highway"]({b});
  way["waterway"]({b});
  way["natural"~"^(water|wood|scrub|grassland|heath|wetland|tree_row)$"]({b});
  relation["natural"="water"]({b});
  way["landuse"]({b});
  relation["landuse"]({b});
  way["leisure"~"^(park|pitch|garden|playground|sports_centre|stadium|golf_course)$"]({b});
  way["amenity"~"^(parking|grave_yard|school)$"]({b});
  way["railway"~"^(rail|platform)$"]({b});
  way["barrier"~"^(city_wall|wall)$"]({b});
  way["man_made"~"^(bridge|tower)$"]({b});
  node["natural"="tree"]({b});
  node["place"~"^(town|village|hamlet|suburb|neighbourhood|locality)$"]({b});
  node["man_made"~"^(tower|water_tower|chimney)$"]({b});
  node["historic"]({b});
);
out geom qt;"""


def r1(v):
    return round(v, 1)


def flat(geom):
    pts = []
    for g in geom:
        x, z = to_local(g["lat"], g["lon"])
        pts += [r1(x), r1(z)]
    return pts


def join_rings(segments):
    """Join open member ways into closed rings by matching endpoints."""
    segs = [list(s) for s in segments if len(s) >= 2]
    rings = []
    while segs:
        ring = segs.pop(0)
        changed = True
        while changed and ring[0] != ring[-1]:
            changed = False
            for k, s in enumerate(segs):
                if s[0] == ring[-1]: ring += s[1:]
                elif s[-1] == ring[-1]: ring += s[::-1][1:]
                elif s[-1] == ring[0]: ring = s[:-1] + ring
                elif s[0] == ring[0]: ring = s[::-1][:-1] + ring
                else: continue
                segs.pop(k); changed = True; break
        rings.append(ring)
    return rings


ROAD_W = {  # carriageway width (m) and draw class
    "motorway": (14, 0), "trunk": (12, 0), "primary": (10, 1), "secondary": (8, 1),
    "tertiary": (7, 2), "unclassified": (5, 3), "residential": (6, 3), "living_street": (5, 3),
    "service": (4, 4), "track": (3, 5), "pedestrian": (6, 6), "footway": (2, 7),
    "path": (1.5, 7), "cycleway": (2, 7), "steps": (2, 7),
    "motorway_link": (7, 0), "trunk_link": (7, 0), "primary_link": (7, 1),
    "secondary_link": (6, 1), "tertiary_link": (6, 2),
}
WATER_W = {"river": 18, "canal": 8, "stream": 3, "ditch": 1.5, "drain": 2}
DEFAULT_BLD_H = {
    "house": 7, "detached": 7, "semidetached_house": 7, "terrace": 9, "apartments": 13,
    "residential": 10, "church": 16, "chapel": 7, "cathedral": 22, "bell_tower": 30,
    "tower": 25, "industrial": 9, "warehouse": 9, "commercial": 9, "retail": 6,
    "office": 12, "school": 10, "barn": 7, "farm_auxiliary": 6, "farm": 8, "cowshed": 6,
    "stable": 5, "greenhouse": 4, "garage": 3, "garages": 3, "shed": 3, "hut": 3,
    "roof": 4, "carport": 3, "service": 4, "civic": 12, "public": 12, "hospital": 14,
    "castle": 15, "ruins": 4,
}


def parse_height(tags):
    for k in ("height", "building:height"):
        if k in tags:
            try:
                return float(tags[k].replace("m", "").replace(",", ".").strip())
            except ValueError:
                pass
    if "building:levels" in tags:
        try:
            return float(tags["building:levels"]) * 3.0 + 1.5
        except ValueError:
            pass
    return None


def bake_osm():
    q = overpass_query().encode()
    data = None
    for url in OVERPASS_URLS:
        try:
            print(f"[OSM] querying {url} ...")
            data = cached("overpass.json", lambda u=url: http_get(u, urllib.parse.urlencode({"data": q}).encode()))
            break
        except Exception as e:  # noqa
            print("  ! overpass failed:", e)
    if data is None:
        raise RuntimeError("all Overpass endpoints failed")
    els = json.loads(data)["elements"]
    print(f"[OSM] {len(els)} elements")

    out = {k: [] for k in ("buildings", "roads", "waterLines", "waterAreas", "areas",
                           "trees", "treeRows", "walls", "rail", "places", "pois")}
    for e in els:
        t = e.get("tags", {})
        if e["type"] == "node":
            x, z = to_local(e["lat"], e["lon"])
            if abs(x) > HALF or abs(z) > HALF:
                continue
            if t.get("natural") == "tree":
                out["trees"] += [r1(x), r1(z)]
            elif "place" in t and "name" in t:
                out["places"].append({"n": t["name"], "k": t["place"], "x": r1(x), "z": r1(z)})
            else:
                out["pois"].append({"k": t.get("man_made") or t.get("historic"), "n": t.get("name", ""),
                                    "x": r1(x), "z": r1(z), "h": parse_height(t)})
            continue

        if e["type"] == "relation":
            outers = [flat(m["geometry"]) for m in e.get("members", [])
                      if m.get("role") == "outer" and "geometry" in m]
            # join by point tuples
            segs = [[(p[i], p[i + 1]) for i in range(0, len(p), 2)] for p in outers]
            for ring in join_rings(segs):
                pts = [c for pt in ring for c in pt]
                if t.get("natural") == "water":
                    out["waterAreas"].append(pts)
                elif "landuse" in t:
                    out["areas"].append({"k": t["landuse"], "p": pts})
            continue

        geom = e.get("geometry")
        if not geom or len(geom) < 2:
            continue
        pts = flat(geom)
        closed = geom[0] == geom[-1]

        if "building" in t and closed:
            btype = t["building"] if t["building"] != "yes" else (t.get("amenity") or t.get("man_made") or "yes")
            h = parse_height(t) or DEFAULT_BLD_H.get(btype, DEFAULT_BLD_H.get(t.get("building"), 6.5))
            out["buildings"].append({"h": round(h, 1), "t": btype, "n": t.get("name", ""), "p": pts[:-2]})
        elif "highway" in t:
            w, c = ROAD_W.get(t["highway"], (3, 5))
            if "width" in t:
                try: w = float(t["width"].replace(",", "."))
                except ValueError: pass
            r = {"c": c, "w": w, "k": t["highway"], "p": pts}
            if t.get("bridge") == "yes": r["b"] = 1
            if "name" in t: r["n"] = t["name"]
            out["roads"].append(r)
        elif "waterway" in t:
            w = WATER_W.get(t["waterway"], 2)
            if closed and t["waterway"] == "riverbank":
                out["waterAreas"].append(pts)
            else:
                out["waterLines"].append({"k": t["waterway"], "w": w, "n": t.get("name", ""), "p": pts})
        elif t.get("natural") == "water" and closed:
            out["waterAreas"].append(pts)
        elif t.get("natural") == "tree_row":
            out["treeRows"].append(pts)
        elif "railway" in t:
            out["rail"].append(pts)
        elif "barrier" in t:
            out["walls"].append({"k": t["barrier"], "p": pts})
        elif closed:
            kind = t.get("landuse") or t.get("natural") or t.get("leisure") or t.get("amenity") or t.get("man_made")
            if kind:
                out["areas"].append({"k": kind, "p": pts})

    with open(os.path.join(OUT, "osm.json"), "w", encoding="utf-8") as f:
        json.dump(out, f, separators=(",", ":"), ensure_ascii=False)
    print("[OSM] osm.json: " + ", ".join(f"{k}={len(v) if k != 'trees' else len(v) // 2}" for k, v in out.items()))


def main():
    os.makedirs(OUT, exist_ok=True)
    hmin, hmax, hc = bake_height()
    bake_osm()
    meta = {
        "version": 1,
        "center": {"lat": CENTER_LAT, "lon": CENTER_LON, "name": "Piazza Bernardi, Castel Bolognese"},
        "axes": "x=East, z=South (metres), y=up (metres above sea level, NOT re-based)",
        "size": SIZE_M, "grid": GRID, "step": SIZE_M / (GRID - 1),
        "heightScale": HEIGHT_SCALE, "heightOffset": HEIGHT_OFFSET,
        "minHeight": round(hmin, 2), "maxHeight": round(hmax, 2), "centerHeight": round(hc, 2),
        "bbox": {"n": LAT_N, "s": LAT_S, "w": LON_W, "e": LON_E},
        "attribution": "Elevation: AWS Terrain Tiles (Mapzen/Terrarium; EU-DEM, SRTM). Map data © OpenStreetMap contributors (ODbL).",
        "baked": time.strftime("%Y-%m-%dT%H:%M:%S"),
    }
    with open(os.path.join(OUT, "world.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=1)
    print("[OK] assets in", OUT)


if __name__ == "__main__":
    sys.exit(main())
