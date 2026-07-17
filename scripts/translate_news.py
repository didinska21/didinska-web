import os
import json
import time
import re
import requests

NEWS_FILE = "data/news.json"
BATCH_SIZE = 8

GROQ_KEYS = [os.environ.get(f"GROQ_API_KEY_{i}") for i in range(1, 11)]
GROQ_KEYS = [k for k in GROQ_KEYS if k]
GROQ_MODEL = os.environ.get("GROQ_MODEL", "openai/gpt-oss-120b")
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"


def load_json(path, default):
    if os.path.exists(path):
        with open(path) as f:
            return json.load(f)
    return default


def save_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


STATUS_FILE = "data/api_status.json"

_last_error_reason = None


def _classify_error(status_code, text):
    if status_code == 429:
        return "rate_limit"
    if status_code == 401:
        return "invalid_api_key"
    if status_code == 404:
        return "model_not_found"
    if status_code and status_code >= 500:
        return "groq_server_error"
    return f"http_{status_code}" if status_code else "unknown_error"


def update_status(script_name, ok, reason=None):
    status = load_json(STATUS_FILE, {})
    status[script_name] = {
        "ok": ok,
        "reason": reason if not ok else None,
        "updated_at": __import__("datetime").datetime.now(
            __import__("datetime").timezone.utc
        ).isoformat(),
    }
    save_json(STATUS_FILE, status)


def call_groq(prompt):
    global _last_error_reason

    if not GROQ_KEYS:
        print("[Groq] skip, belum ada GROQ_API_KEY_1..5 di secrets")
        _last_error_reason = "no_api_key_configured"
        return None

    for idx, key in enumerate(GROQ_KEYS, start=1):
        try:
            r = requests.post(
                GROQ_URL,
                headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                json={
                    "model": GROQ_MODEL,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.3,
                    "max_tokens": 2000,
                },
                timeout=40,
            )
            if r.status_code == 429:
                print(f"[Groq] key #{idx} kena rate limit, coba key berikutnya")
                _last_error_reason = "rate_limit"
                continue
            if r.status_code >= 400:
                print(f"[Groq] key #{idx} error {r.status_code}: {r.text[:300]}")
                _last_error_reason = _classify_error(r.status_code, r.text)
            r.raise_for_status()
            content = r.json()["choices"][0]["message"]["content"]
            print(f"[Groq] berhasil pakai key #{idx}")
            return content
        except Exception as e:
            print(f"[Groq] key #{idx} gagal: {e}")
            if _last_error_reason is None:
                _last_error_reason = "connection_error"
            time.sleep(1)
            continue

    print("[Groq] semua key gagal/rate limit")
    return None


def extract_json_array(text):
    """Ambil array JSON dari jawaban AI, jaga-jaga kalau ada teks pembungkus / markdown fence."""
    if not text:
        return []
    match = re.search(r"\[.*\]", text, re.DOTALL)
    if not match:
        return []
    try:
        return json.loads(match.group(0))
    except Exception as e:
        print(f"[parse] gagal parse JSON: {e}")
        return []


def build_prompt(batch):
    items_text = "\n\n".join(
        f"ID: {it['id']}\nJUDUL: {it.get('title','')}\nRINGKASAN_ASLI: {it.get('summary','')}"
        for it in batch
    )
    return f"""Kamu penerjemah & editor berita crypto. Untuk tiap berita di bawah ini:
1. Terjemahkan judul ke Bahasa Indonesia yang natural (bukan terjemahan mentah kata-per-kata).
2. Buat rangkuman singkat (2-3 kalimat, gaya bahasamu sendiri, JANGAN menyalin/quote teks asli)
   dalam Bahasa Indonesia yang menjelaskan inti berita & kenapa penting buat trader crypto.

Balas HANYA dalam format JSON array, tanpa teks lain, tanpa markdown fence, seperti ini:
[
  {{"id": "...", "title_id": "...", "summary_id": "..."}},
  ...
]

BERITA:
{items_text}
"""


def main():
    news_items = load_json(NEWS_FILE, [])
    if not news_items:
        print("Tidak ada berita di news.json")
        update_status("translate", False, "no_news_data")
        return

    todo = [n for n in news_items if not n.get("title_id")]
    print(f"Total berita: {len(news_items)}, perlu diterjemahkan: {len(todo)}")

    if not todo:
        print("Semua berita sudah punya terjemahan.")
        update_status("translate", True)
        return

    by_id = {n["id"]: n for n in news_items}
    translated_count = 0

    for i in range(0, len(todo), BATCH_SIZE):
        batch = todo[i:i + BATCH_SIZE]
        prompt = build_prompt(batch)
        ai_text = call_groq(prompt)
        results = extract_json_array(ai_text)

        for r in results:
            item_id = r.get("id")
            if item_id in by_id:
                by_id[item_id]["title_id"] = r.get("title_id", "").strip()
                by_id[item_id]["summary_id"] = r.get("summary_id", "").strip()
                translated_count += 1

        time.sleep(1)  # jaga-jaga rate limit antar batch

    save_json(NEWS_FILE, news_items)
    print(f"Selesai. {translated_count} berita berhasil diterjemahkan.")

    if translated_count > 0:
        update_status("translate", True)
    else:
        update_status("translate", False, _last_error_reason or "unknown_error")


if __name__ == "__main__":
    main()
