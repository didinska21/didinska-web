import os
import json
import hashlib
import requests
from datetime import datetime, timezone, timedelta

OUTPUT_FILE = "data/events.json"
MAX_STORED = 60

COINMARKETCAL_API_KEY = os.environ.get("COINMARKETCAL_API_KEY", "")

# Jendela waktu: ambil event dari 3 hari lalu (recent) sampai 30 hari ke depan (upcoming)
DAYS_BACK = 3
DAYS_FORWARD = 30


def load_json(path, default):
    if os.path.exists(path):
        with open(path) as f:
            return json.load(f)
    return default


def save_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent=2)


def make_id(source_id, title):
    raw = f"{source_id}-{title}"
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


def fetch_coinmarketcal():
    """
    CoinMarketCal free tier: butuh API key gratis dari https://coinmarketcal.com/en/apiManagement
    Header pakai x-api-key, bukan query param.
    """
    items = []
    if not COINMARKETCAL_API_KEY:
        print("[CoinMarketCal] skip, COINMARKETCAL_API_KEY belum diset")
        return items

    date_from = (datetime.now(timezone.utc) - timedelta(days=DAYS_BACK)).strftime("%Y-%m-%d")
    date_to = (datetime.now(timezone.utc) + timedelta(days=DAYS_FORWARD)).strftime("%Y-%m-%d")

    try:
        r = requests.get(
            "https://developers.coinmarketcal.com/v1/events",
            headers={"x-api-key": COINMARKETCAL_API_KEY, "Accept": "application/json"},
            params={
                "dateRangeStart": date_from,
                "dateRangeEnd": date_to,
                "max": 100,
                "sortBy": "created_desc",
            },
            timeout=20,
        )
        r.raise_for_status()
        body = r.json()
        for ev in body.get("body", []):
            title = (ev.get("title") or {}).get("en", "").strip()
            if not title:
                continue
            coins = [c.get("symbol") for c in ev.get("coins", []) if c.get("symbol")]
            event_date = ev.get("date_event")
            items.append({
                "id": make_id(ev.get("id"), title),
                "title": title,
                "description": (ev.get("description") or {}).get("en", "")[:280],
                "coins": coins,
                "category": (ev.get("categories") or [{}])[0].get("name", "General"),
                "source_url": ev.get("source"),
                "event_date": event_date,
                "is_upcoming": event_date >= datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S") if event_date else True,
                "votes_hot": ev.get("percentage", 0),
            })
    except Exception as e:
        print(f"[CoinMarketCal] gagal fetch: {e}")
    return items


def main():
    all_items = fetch_coinmarketcal()

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

    # buang event yang udah terlalu lama lewat (lebih dari DAYS_BACK hari)
    cutoff = (datetime.now(timezone.utc) - timedelta(days=DAYS_BACK)).isoformat()
    deduped = [e for e in deduped if not e.get("event_date") or e["event_date"] >= cutoff]

    deduped.sort(key=lambda x: x.get("event_date") or "", reverse=False)
    deduped = deduped[:MAX_STORED]

    save_json(OUTPUT_FILE, deduped)
    print(f"Total event tersimpan: {len(deduped)}")


if __name__ == "__main__":
    main()
