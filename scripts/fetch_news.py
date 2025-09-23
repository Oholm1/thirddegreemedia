#!/usr/bin/env python3
"""
Fetch privacy/civil-liberty/news RSS feeds → docs/news.json (static).
- Keeps it private: users fetch only your JSON, not 3rd-party feeds.
- Safe defaults: dedup by URL, trims very long summaries, sorts by date desc.
- Add/remove feeds in FEEDS below.
"""
import json, re, time, hashlib
from datetime import datetime, timezone
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError
import xml.etree.ElementTree as ET
from pathlib import Path

# ---- Configure here ---------------------------------------------------------
OUTPUT = Path(__file__).resolve().parents[1] / "docs" / "news_feed.json"
MAX_ITEMS_PER_FEED = 15
MAX_SUMMARY_CHARS = 260
USER_AGENT = "ThirdDegreeMedia/1.0 (+https://thirddegreemedia.com)"
FEEDS = [
    # Civil liberties / privacy
    ("EFF", "https://www.eff.org/rss/updates.xml"),
    # Tor Project
    ("Tor Project", "https://blog.torproject.org/rss.xml"),
    # Investigative / tech policy
    ("ProPublica Nerd/News", "https://www.propublica.org/feeds/nerds"),
    # VPN / privacy industry
    ("Mullvad", "https://mullvad.net/en/blog/rss/"),
    # Mozilla Security/Privacy (broad, but good)
    ("Mozilla Security Blog", "https://blog.mozilla.org/security/feed/"),
]
# ----------------------------------------------------------------------------

def fetch(url: str) -> bytes:
    req = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/rss+xml, application/atom+xml, */*"})
    with urlopen(req, timeout=20) as r:
        return r.read()

def strip_html(s: str) -> str:
    s = re.sub(r"(?is)<script.*?>.*?</script>", "", s or "")
    s = re.sub(r"(?is)<style.*?>.*?</style>", "", s)
    s = re.sub(r"(?s)<[^>]+>", "", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s

def isoformat(ts_struct) -> str:
    # ts_struct is time.struct_time (if available)
    if ts_struct:
        try:
            dt = datetime(*ts_struct[:6], tzinfo=timezone.utc)
            return dt.isoformat().replace("+00:00", "Z")
        except Exception:
            pass
    # fallback: now
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

def parse_feed_xml(xml_bytes: bytes, fallback_source: str):
    # Try RSS 2.0 and Atom via ElementTree (no external deps)
    # We keep this simple and defensive.
    root = ET.fromstring(xml_bytes)
    ns = {"atom": "http://www.w3.org/2005/Atom"}

    items = []
    channel = root.find("channel")
    if channel is not None:
        # RSS
        for item in channel.findall("item")[:MAX_ITEMS_PER_FEED]:
            title = (item.findtext("title") or "").strip()
            link = (item.findtext("link") or "").strip()
            pub = item.findtext("pubDate")
            desc = item.findtext("description") or ""
            summary = strip_html(desc)[:MAX_SUMMARY_CHARS].strip()
            date_iso = isoformat(time.strptime(pub, "%a, %d %b %Y %H:%M:%S %z").utctimetuple()) if pub else isoformat(None)
            items.append({"title": title, "url": link, "source": fallback_source, "date": date_iso, "summary": summary})
        return items

    # Atom
    for entry in root.findall("atom:entry", ns)[:MAX_ITEMS_PER_FEED]:
        title = (entry.findtext("atom:title", default="", namespaces=ns) or "").strip()
        link_el = entry.find("atom:link[@rel='alternate']", ns) or entry.find("atom:link", ns)
        link = (link_el.get("href") if link_el is not None else "").strip()
        updated = entry.findtext("atom:updated", default="", namespaces=ns) or entry.findtext("atom:published", default="", namespaces=ns)
        # Try to normalize common Atom date formats
        try:
            # 2025-09-21T12:34:56Z
            ts = time.strptime(updated[:19], "%Y-%m-%dT%H:%M:%S")
            date_iso = isoformat(ts)
        except Exception:
            date_iso = isoformat(None)
        summary = strip_html(entry.findtext("atom:summary", default="", namespaces=ns) or entry.findtext("atom:content", default="", namespaces=ns))
        summary = summary[:MAX_SUMMARY_CHARS].strip()
        items.append({"title": title, "url": link, "source": fallback_source, "date": date_iso, "summary": summary})
    return items

def main():
    all_items = {}
    for source, url in FEEDS:
        try:
            xml_bytes = fetch(url)
            items = parse_feed_xml(xml_bytes, source)
            for it in items:
                if not it["title"] or not it["url"]:
                    continue
                # Dedup by URL hash
                key = hashlib.sha1(it["url"].encode("utf-8")).hexdigest()
                # Keep newest if collision
                if key in all_items:
                    if it["date"] > all_items[key]["date"]:
                        all_items[key] = it
                else:
                    all_items[key] = it
        except (HTTPError, URLError, ET.ParseError) as e:
            # You could log to syslog here if desired
            continue

    # Sort by date desc
    data = sorted(all_items.values(), key=lambda x: x["date"], reverse=True)

    # Add a "last_updated" header object at the top (helpful for UI)
    payload = {
        "last_updated": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "items": data
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT.open("w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

if __name__ == "__main__":
    main()