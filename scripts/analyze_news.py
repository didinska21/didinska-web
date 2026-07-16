import os
import json
import re
import time
import requests
from datetime import datetime, timezone

NEWS_FILE = "data/news.json"
EVENTS_FILE = "data/events.json"
OUTPUT_FILE = "data/analysis.json"

# Rotasi sampai 5 Groq API key biar gak kena rate limit harian.
# Set di GitHub Secrets: GROQ_API_KEY_1, GROQ_API_KEY_2, ... GROQ_API_KEY_5
GROQ_KEYS = [
    os.environ.get(f"GROQ_API_KEY_{i}") for i in range(1, 6)
]
GROQ_KEYS = [k for k in GROQ_KEYS if k]  # buang yang kosong
GROQ_MODEL = os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile")
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"

NEWS_WEIGHT = 0.9
TECHNICAL_WEIGHT = 0.1

# --- Rule-based sentiment: kata kunci sederhana ---
BULLISH_WORDS = [
    "surge", "rally", "soar", "bullish", "breakout", "adoption", "approval",
    "approved", "partnership", "upgrade", "inflow", "accumulat", "record high",
    "all-time high", "institutional", "etf approv", "buyback", "integrat",
]
BEARISH_WORDS = [
    "crash", "plunge", "bearish", "sell-off", "selloff", "hack", "exploit",
    "lawsuit", "sec sues", "ban", "rejected", "rejection", "liquidat", "outflow",
    "delist", "collapse", "fraud", "investigation", "downgrade",
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


def rule_based_score(news_items):
    """
    Skor sentimen -1..+1 dari kata kunci di judul+summary.
    Cuma indikator kasar, dipakai buat cross-check hasil AI.
    """
    bull_hits = 0
    bear_hits = 0
    for item in news_items:
        text = (item.get("title", "") + " " + item.get("summary", "")).lower()
        bull_hits += sum(1 for w in BULLISH_WORDS if w in text)
        bear_hits += sum(1 for w in BEARISH_WORDS if w in text)

    total = bull_hits + bear_hits
    if total == 0:
        return 0.0, bull_hits, bear_hits
    score = (bull_hits - bear_hits) / total
    return round(score, 3), bull_hits, bear_hits


def get_technical_bias():
    """
    Indikator teknikal sederhana: perubahan harga 24 jam BTC/ETH dari CoinGecko.
    Ini komponen 10% dari analisa akhir.
    """
    try:
        r = requests.get(
            "https://api.coingecko.com/api/v3/simple/price",
            params={"ids": "bitcoin,ethereum", "vs_currencies": "usd", "include_24hr_change": "true"},
            timeout=15,
        )
        r.raise_for_status()
        d = r.json()
        avg_change = (d["bitcoin"]["usd_24h_change"] + d["ethereum"]["usd_24h_change"]) / 2
        # normalisasi ke skala -1..+1 (anggap ±10% sebagai batas ekstrem)
        score = max(-1.0, min(1.0, avg_change / 10))
        return round(score, 3), round(avg_change, 2)
    except Exception as e:
        print(f"[technical] gagal ambil data harga: {e}")
        return 0.0, 0.0


def call_groq(prompt):
    """
    Coba tiap key Groq satu-satu. Kalau satu kena rate limit (429) atau error,
    otomatis lanjut ke key berikutnya.
    """
    if not GROQ_KEYS:
        print("[Groq] skip, belum ada GROQ_API_KEY_1..5 di secrets")
        return None

    for idx, key in enumerate(GROQ_KEYS, start=1):
        try:
            r = requests.post(
                GROQ_URL,
                headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                json={
                    "model": GROQ_MODEL,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.4,
                    "max_tokens": 500,
                },
                timeout=30,
            )
            if r.status_code == 429:
                print(f"[Groq] key #{idx} kena rate limit, coba key berikutnya")
                continue
            r.raise_for_status()
            content = r.json()["choices"][0]["message"]["content"]
            print(f"[Groq] berhasil pakai key #{idx}")
            return content
        except Exception as e:
            print(f"[Groq] key #{idx} gagal: {e}")
            time.sleep(1)
            continue

    print("[Groq] semua key gagal/rate limit")
    return None


def build_prompt(news_items, events_items):
    news_lines = "\n".join(
        f"- [{n.get('source')}] {n.get('title')}" for n in news_items[:20]
    )
    event_lines = "\n".join(
        f"- {e.get('title')} ({e.get('event_date', '')[:10]})" for e in events_items[:10]
    )
    return f"""Kamu analis crypto. Berdasarkan berita terbaru dan jadwal event di bawah,
buat ringkasan analisa pasar crypto singkat dalam Bahasa Indonesia (maksimal 120 kata).
Fokus ke apa yang sedang terjadi dan potensi dampaknya, bukan saran investasi.
Akhiri dengan satu kata bias: BULLISH, BEARISH, atau NETRAL.

BERITA TERBARU:
{news_lines}

JADWAL EVENT:
{event_lines}

Format jawaban:
RINGKASAN: <ringkasan kamu>
BIAS: <BULLISH/BEARISH/NETRAL>
"""


def parse_ai_response(text):
    if not text:
        return None, None
    summary_match = re.search(r"RINGKASAN:\s*(.+?)(?=BIAS:|$)", text, re.DOTALL)
    bias_match = re.search(r"BIAS:\s*(BULLISH|BEARISH|NETRAL)", text, re.IGNORECASE)
    summary = summary_match.group(1).strip() if summary_match else text.strip()
    bias = bias_match.group(1).upper() if bias_match else None
    return summary, bias


def combine_scores(news_score, technical_score):
    final = (news_score * NEWS_WEIGHT) + (technical_score * TECHNICAL_WEIGHT)
    return round(final, 3)


def score_to_label(score):
    if score >= 0.25:
        return "Bullish"
    if score <= -0.25:
        return "Bearish"
    return "Netral"


def main():
    news_items = load_json(NEWS_FILE, [])
    events_items = load_json(EVENTS_FILE, [])

    news_score, bull_hits, bear_hits = rule_based_score(news_items)
    technical_score, avg_change_pct = get_technical_bias()

    ai_summary = None
    ai_bias = None
    if news_items:
        prompt = build_prompt(news_items, events_items)
        ai_text = call_groq(prompt)
        ai_summary, ai_bias_word = parse_ai_response(ai_text)
        ai_bias = {"BULLISH": 1.0, "BEARISH": -1.0, "NETRAL": 0.0}.get(ai_bias_word)

    # Kalau AI berhasil kasih bias, gabung sama rule-based (rata-rata) buat skor "news".
    # Kalau AI gagal, fallback murni ke rule-based.
    if ai_bias is not None:
        combined_news_score = round((news_score + ai_bias) / 2, 3)
    else:
        combined_news_score = news_score

    final_score = combine_scores(combined_news_score, technical_score)
    final_label = score_to_label(final_score)

    analysis = {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "final_score": final_score,
        "final_label": final_label,
        "summary": ai_summary or "Ringkasan AI belum tersedia, mengandalkan skor rule-based.",
        "breakdown": {
            "news_weight": NEWS_WEIGHT,
            "technical_weight": TECHNICAL_WEIGHT,
            "news_score": combined_news_score,
            "technical_score": technical_score,
            "technical_avg_change_pct": avg_change_pct,
            "rule_based_score": news_score,
            "rule_based_bull_hits": bull_hits,
            "rule_based_bear_hits": bear_hits,
            "ai_bias": ai_bias,
        },
        "disclaimer": "Analisa edukatif berbasis berita & indikator sederhana, bukan saran finansial. Selalu DYOR.",
    }

    save_json(OUTPUT_FILE, analysis)
    print(f"Analisa selesai: {final_label} (skor {final_score})")


if __name__ == "__main__":
    main()
