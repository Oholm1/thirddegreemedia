#!/usr/bin/env python3
# scripts/fetch_news.py
import argparse, json, os, sys, time, re
from urllib.parse import urlparse
import xml.etree.ElementTree as ET
import requests

# import the chooser from your sibling script:
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, CURRENT_DIR)
try:
    from legal_news_image import choose_and_save
except Exception:
    choose_and_save = None  # still allow --images off

USER_AGENT = "ThirdDegreeMedia/1.0 (fetch_news.py)"
MAX_ITEMS_PER_FEED = 20
NEWS_JSON_PATH = os.path.join(os.path.dirname(CURRENT_DIR), "docs", "news_feed.json")
IMG_OUTDIR = os.path.join(os.path.dirname(CURRENT_DIR), "docs", "assets", "news_images")

def fetch(url: str) -> bytes:
    r = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=20)
    r.raise_for_status()
    return r.content

def parse_rss_atom(xml_bytes: bytes, fallback_source: str):
    root = ET.fromstring(xml_bytes)
    ns = {
        "atom": "http://www.w3.org/2005/Atom",
        "media": "http://search.yahoo.com/mrss/"
    }
    items = []

    # RSS
    channel = root.find("channel")
    if channel is not None:
        for item in channel.findall("item")[:MAX_ITEMS_PER_FEED]:
            title = (item.findtext("title") or "").strip()
            link = (item.findtext("link") or "").strip()
            pub = (item.findtext("pubDate") or "").strip()
            desc = (item.findtext("description") or "").strip()
            # try media:content
            media = item.find("media:content", ns)
            thumb = media.get("url") if media is not None else None
            items.append(dict(
                title=title, url=link, summary=strip_tags(desc),
                published=pub, source=fallback_source, thumb=thumb
            ))
        return items

    # Atom
    for entry in root.findall("atom:entry", ns):
        title = (entry.findtext("atom:title", default="", namespaces=ns) or "").strip()
        link_el = entry.find("atom:link[@rel='alternate']", ns) or entry.find("atom:link", ns)
        link = link_el.get("href") if link_el is not None else ""
        pub = (entry.findtext("atom:published", default="", namespaces=ns) or
               entry.findtext("atom:updated", default="", namespaces=ns) or "").strip()
        summ = (entry.findtext("atom:summary", default="", namespaces=ns) or "").strip()
        # media?
        media = entry.find(".//media:content", ns)
        thumb = media.get("url") if media is not None else None
        items.append(dict(
            title=title, url=link, summary=strip_tags(summ),
            published=pub, source=fallback_source, thumb=thumb
        ))
    return items

def strip_tags(html: str) -> str:
    return re.sub(r"<[^>]+>", "", html or "").strip()

def domain_of(url: str) -> str:
    try:
        return urlparse(url).netloc
    except Exception:
        return ""

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--feed", action="append", required=True,
                    help="RSS/Atom feed URL (repeatable)")
    ap.add_argument("--images", action="store_true",
                    help="Pick safe, licensed images via Openverse")
    ap.add_argument("--max", type=int, default=40, help="Max total items")
    args = ap.parse_args()

    all_items = []
    for url in args.feed:
        try:
            xml = fetch(url)
            items = parse_rss_atom(xml, fallback_source=domain_of(url))
            all_items.extend(items)
        except Exception as e:
            print(f"[warn] feed failed: {url} -> {e}", file=sys.stderr)

    # dedupe by URL
    seen = set()
    unique = []
    for it in all_items:
        u = it.get("url", "")
        if u and u not in seen:
            seen.add(u)
            unique.append(it)

    unique = unique[:args.max]

    # IMAGES: enrich each item with a local, licensed image
    if args.images and choose_and_save:
        os.makedirs(IMG_OUTDIR, exist_ok=True)
        for it in unique:
            try:
                title = it.get("title") or ""
                summary = it.get("summary") or ""
                tags = [it.get("source") or ""]
                html, meta = choose_and_save(title, summary, tags, IMG_OUTDIR)
                # Store structured fields your JS can use
                it["image"] = {
                    "src": meta.get("thumb_path") or meta.get("file_path"),
                    "alt": title,
                    "caption": f'{meta.get("title","Image")} by {meta.get("creator","Unknown")} · {meta.get("license","").upper()}',
                    "license": meta.get("license"),
                    "license_url": meta.get("license_url"),
                    "source_url": meta.get("source_url")
                }
            except SystemExit:
                # no results; silently continue
                pass
            except Exception as e:
                print(f"[img] {title[:60]}... -> {e}", file=sys.stderr)

    # write news.json
    out = {
        "generated_at": int(time.time()),
        "items": unique
    }
    os.makedirs(os.path.dirname(NEWS_JSON_PATH), exist_ok=True)
    with open(NEWS_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print(f"[ok] wrote {NEWS_JSON_PATH} with {len(unique)} items")

if __name__ == "__main__":
    main()