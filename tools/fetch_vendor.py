#!/usr/bin/env python3
"""
fetch_vendor.py — copy pinned third-party front-end deps into web/vendor/
so the site works on the LAN with no CDN at runtime (and under a strict CSP).
Standard library only. Re-run only when bumping THREE_VERSION.
"""
import os, re, urllib.request

THREE_VERSION = "0.162.0"
BASE = f"https://cdn.jsdelivr.net/npm/three@{THREE_VERSION}"
FILES = [
    "build/three.module.js",
    "examples/jsm/postprocessing/EffectComposer.js",
    "examples/jsm/postprocessing/RenderPass.js",
    "examples/jsm/postprocessing/OutputPass.js",
    "examples/jsm/postprocessing/ShaderPass.js",
    "examples/jsm/postprocessing/MaskPass.js",
    "examples/jsm/postprocessing/Pass.js",
    "examples/jsm/shaders/CopyShader.js",
    "examples/jsm/shaders/OutputShader.js",
    "examples/jsm/utils/BufferGeometryUtils.js",
]
FONTS_CSS = "https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&display=swap"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36"

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VENDOR = os.path.join(ROOT, "web", "vendor")


def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=60) as r:
        return r.read()


def main():
    for f in FILES:
        dst = os.path.join(VENDOR, "three", f.replace("build/", "").replace("examples/jsm/", "addons/"))
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        with open(dst, "wb") as fh:
            fh.write(get(f"{BASE}/{f}"))
        print("ok", dst)
    # Fonts: download woff2 files and rewrite the CSS to local urls
    css = get(FONTS_CSS).decode()
    fdir = os.path.join(VENDOR, "fonts")
    os.makedirs(fdir, exist_ok=True)
    for i, url in enumerate(sorted(set(re.findall(r"url\((https://[^)]+)\)", css)))):
        name = f"font{i}.woff2"
        with open(os.path.join(fdir, name), "wb") as fh:
            fh.write(get(url))
        css = css.replace(url, name)
    with open(os.path.join(fdir, "fonts.css"), "w", encoding="utf-8") as fh:
        fh.write(css)
    print("ok fonts")


if __name__ == "__main__":
    main()
