#!/usr/bin/env python3
"""
bake_ortho.py — Offline aerial orthophoto baker for LHX Castelbolognese.

Downloads 64 real aerial orthophoto JPEG tiles (8x8 grid matching terrain.js chunks)
into web/assets/world/ortho/c_{cx}_{cz}.jpg.

Primary source:
  Regione Emilia-Romagna Open Data WMS — Ortofoto AGEA 2023 RGB (20 cm native)
  https://servizigis.regione.emilia-romagna.it/wms/agea2023_rgb
Fallback source:
  Esri World Imagery MapServer export

Resolution tiering (balances razor-sharp ground driving on Intel iGPUs):
  * Town & Helipad core (cx,cz in 3..4, 2x2 = 4 tiles):  2048x2048 px (0.5 m/px!)
  * Surrounding ring    (cx,cz in 2..5, 12 tiles):       1024x1024 px (1.0 m/px)
  * Countryside & hills (outer 48 tiles):                 512x512  px (2.0 m/px)

Pure Python stdlib (urllib + concurrent.futures). Zero server runtime load.
"""
import concurrent.futures
import json
import math
import os
import sys
import time
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORLD_JSON = os.path.join(ROOT, "web", "assets", "world", "world.json")
OUT_DIR = os.path.join(ROOT, "web", "assets", "world", "ortho")
CHUNKS = 8
UA = "LHX-Castelbolognese-orthobaker/2.0"

R_EARTH = 6378137.0


def load_proj():
    with open(WORLD_JSON, "r", encoding="utf-8") as f:
        meta = json.load(f)
    clat = meta["center"]["lat"]
    clon = meta["center"]["lon"]
    size = meta["size"]
    m_lat = math.pi * R_EARTH / 180.0
    m_lon = m_lat * math.cos(math.radians(clat))

    def to_latlon(x, z):
        return (clat - z / m_lat, clon + x / m_lon)

    return meta, size, to_latlon


def tile_res(cx, cz):
    if 3 <= cx <= 4 and 3 <= cz <= 4:
        return 2048
    if 2 <= cx <= 5 and 2 <= cz <= 5:
        return 1024
    return 512


def fetch_tile(job):
    cx, cz, lat_s, lon_w, lat_n, lon_e, res = job
    out_path = os.path.join(OUT_DIR, f"c_{cx}_{cz}.jpg")
    if os.path.exists(out_path) and os.path.getsize(out_path) > 4096:
        return cx, cz, res, os.path.getsize(out_path), "cached"

    urls = [
        (
            "RER_AGEA2023",
            "https://servizigis.regione.emilia-romagna.it/wms/agea2023_rgb"
            f"?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=Agea2023_RGB&STYLES="
            f"&CRS=EPSG:4326&BBOX={lat_s:.7f},{lon_w:.7f},{lat_n:.7f},{lon_e:.7f}"
            f"&WIDTH={res}&HEIGHT={res}&FORMAT=image/jpeg",
        ),
        (
            "RER_AGEA2020",
            "https://servizigis.regione.emilia-romagna.it/wms/agea2020_rgb"
            f"?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=Agea2020_RGB&STYLES="
            f"&CRS=EPSG:4326&BBOX={lat_s:.7f},{lon_w:.7f},{lat_n:.7f},{lon_e:.7f}"
            f"&WIDTH={res}&HEIGHT={res}&FORMAT=image/jpeg",
        ),
        (
            "ESRI",
            "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export"
            f"?bbox={lon_w:.7f},{lat_s:.7f},{lon_e:.7f},{lat_n:.7f}"
            f"&bboxSR=4326&imageSR=4326&size={res},{res}&format=jpg&f=image",
        ),
    ]

    for src, url in urls:
        for attempt in range(3):
            try:
                req = urllib.request.Request(url, headers={"User-Agent": UA})
                with urllib.request.urlopen(req, timeout=45) as r:
                    data = r.read()
                if len(data) > 2048 and data[:2] == b"\xff\xd8":
                    tmp = out_path + ".tmp"
                    with open(tmp, "wb") as f:
                        f.write(data)
                    os.replace(tmp, out_path)
                    return cx, cz, res, len(data), src
            except Exception as exc:
                time.sleep(1.2 * (attempt + 1))
                last_err = str(exc)
    raise RuntimeError(f"Failed tile ({cx},{cz}): {last_err}")


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    meta, size, to_latlon = load_proj()
    half = size / 2.0
    chunk = size / CHUNKS

    jobs = []
    manifest_tiles = {}
    for cz in range(CHUNKS):
        for cx in range(CHUNKS):
            x0 = -half + cx * chunk
            z0 = -half + cz * chunk
            x1 = x0 + chunk
            z1 = z0 + chunk
            lat_n, lon_w = to_latlon(x0, z0)
            lat_s, lon_e = to_latlon(x1, z1)
            res = tile_res(cx, cz)
            jobs.append((cx, cz, lat_s, lon_w, lat_n, lon_e, res))
            manifest_tiles[f"{cx}_{cz}"] = {"res": res, "file": f"ortho/c_{cx}_{cz}.jpg"}

    print(f"[ORTHO] Downloading {len(jobs)} aerial tiles into {OUT_DIR} ...")
    t0 = time.time()
    total_bytes = 0
    done = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as ex:
        for cx, cz, res, nbytes, src in ex.map(fetch_tile, jobs):
            done += 1
            total_bytes += nbytes
            if done % 8 == 0 or res >= 1024:
                print(f"  [{done:2d}/64] c_{cx}_{cz}.jpg ({res}px) -> {nbytes // 1024} KB [{src}]")

    manifest = {
        "chunks": CHUNKS,
        "source": "Ortofoto AGEA 2023 RGB — Geoportale Regione Emilia-Romagna (CC-BY)",
        "totalBytes": total_bytes,
        "baked": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "tiles": manifest_tiles,
    }
    with open(os.path.join(OUT_DIR, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=1)
    print(f"[OK] 64 tiles ready ({total_bytes / (1024*1024):.2f} MB) in {time.time() - t0:.1f}s")


if __name__ == "__main__":
    sys.exit(main())
