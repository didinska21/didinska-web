import os
import re
import json
import hashlib
import requests
import feedparser
from datetime import datetime, timezone

OUTPUT_FILE = "data/news.json"
MAX_STORED = 80

CRYPTOPANIC_API_KEY = os.environ.get("CRYPTOPANIC_API_KEY", "")

# RSS gratis, gak butuh API key. Bisa ditambah sumber lain di sini.
RSS_FEEDS = [
    {"name": "CoinDesk", "url": "https://www.coindesk.com/arc/outboundfeeds/rss/"},
    {"name": "Cointelegraph", "url": "https://cointelegraph.com/rss"},
    {"name": "Decrypt", "url": "https://decrypt.co/feed"},
]


def load_json(path, default):
    if os.path.exists(path):
        with open(path) as f:
            return json.load(f)
    return default


def save_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent=2)


def make_id(url):
    return hashlib.sha256(url.encode()).hexdigest()[:16]


def clean_text(html_text):
    if not html_text:
        return ""
    text = re.sub(r"<[^>]+>", "", html_text)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:280]


def parse_rss_date(entry):
    for key in ("published_parsed", "updated_parsed"):
        t = entry.get(key)
        if t:
            return datetime(*t[:6], tzinfo=timezone.utc).isoformat()
    return datetime.now(timezone.utc).isoformat()


def fetch_rss(feed):
    items = []
    try:
        parsed = feedparser.parse(feed["url"])
        for entry in parsed.entries[:25]:
            link = entry.get("link")
            if not link:
                continue
            items.append({
                "id": make_id(link),
                "title": entry.get("title", "").strip(),
                "url": link,
                "source": feed["name"],
                "summary": clean_text(entry.get("summary", "")),
                "published_at": parse_rss_date(entry),
            })
    except Exception as e:
        print(f"[{feed['name']}] gagal fetch RSS: {e}")
    return items


def fetch_cryptopanic():
    items = []
    if not CRYPTOPANIC_API_KEY:
        print("[CryptoPanic] skip, CRYPTOPANIC_API_KEY belum diset")
        return items
    try:
        r = requests.get(
            "https://cryptopanic.com/api/v1/posts/",
            params={"auth_token": CRYPTOPANIC_API_KEY, "public": "true", "kind": "news"},
            timeout=20,
        )
        r.raise_for_status()
        for post in r.json().get("results", []):
            link = post.get("url")
            if not link:
                continue
            items.append({
                "id": make_id(link),
                "title": post.get("title", "").strip(),
                "url": link,
                "source": "CryptoPanic",
                "summary": "",
                "published_at": post.get("published_at", datetime.now(timezone.utc).isoformat()),
            })
    except Exception as e:
        print(f"[CryptoPanic] gagal fetch: {e}")
    return items


def main():
    all_items = []
    for feed in RSS_FEEDS:
        all_items += fetch_rss(feed)
    all_items += fetch_cryptopanic()

    existing = load_json(OUTPUT_FILE, [])
    combined = all_items + existing

    seen = set()
    deduped = []
    for item in combined:
        key = item["id"]
        if key in seen:
            continue
        seen.add(key)
        deduped.append(item)

    deduped.sort(key=lambda x: x["published_at"], reverse=True)
    deduped = deduped[:MAX_STORED]

    save_json(OUTPUT_FILE, deduped)
    print(f"Total berita tersimpan: {len(deduped)} (baru ditemukan: {len(all_items)})")


if __name__ == "__main__":
    main()
