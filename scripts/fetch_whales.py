import os
import json
import time
import requests
from datetime import datetime, timezone

STATE_FILE = "data/state.json"
OUTPUT_FILE = "data/whales.json"
SIGNAL_FILE = "data/signal.json"

THRESHOLD_USD = float(os.environ.get("THRESHOLD_USD", "1000000"))
MAX_BLOCKS_PER_RUN = int(os.environ.get("MAX_BLOCKS_PER_RUN", "40"))
MAX_STORED = 500
SIGNAL_WINDOW_HOURS = 24
SIGNAL_THRESHOLD_USD = float(os.environ.get("SIGNAL_THRESHOLD_USD", "5000000"))

ETHERSCAN_KEY = os.environ.get("ETHERSCAN_API_KEY", "")
BSCSCAN_KEY = os.environ.get("BSCSCAN_API_KEY", "")

# Daftar alamat hot-wallet exchange yang sudah dikenal publik (tidak lengkap,
# bisa ditambah sendiri). Dipakai buat nandain apakah whale tx itu masuk/keluar exchange.
EXCHANGE_ADDRESSES = {
    "0x28c6c06298d514db089934071355e5743bf21d60": "Binance",
    "0x21a31ee1afc51d94c2efccaa2092ad1028285549": "Binance",
    "0xdfd5293d8e347dfe59e90efd55b2956a1343963d": "Binance",
    "0x56eddb7aa87536c09ccc2793473599fd21a8b17f": "Binance",
    "0x9696f59e4d72e237be84ffd425dcad154bf96976": "Binance",
    "0xf977814e90da44bfa03b6295a0616a897441acec": "Binance",
    "0x8894e0a0c962cb723c1976a4421c95949be2d4e9": "Binance",
    "0x2910543af39aba0cd09dbb2d50200b3e800a63d2": "Kraken",
    "0x0a869d79a7052c7f1b55a8ebabbea3420f0d1e13": "Kraken",
    "0x71660c4005ba85c37ccec55d0c4493e66fe775d3": "Coinbase",
    "0x503828976d22510aad0201ac7ec88293211d23da": "Coinbase",
    "0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be": "Binance (BSC)",
}


def label_address(addr):
    if not addr:
        return None
    return EXCHANGE_ADDRESSES.get(addr.lower())


def load_json(path, default):
    if os.path.exists(path):
        with open(path) as f:
            return json.load(f)
    return default


def save_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent=2)


def get_prices():
    r = requests.get(
        "https://api.coingecko.com/api/v3/simple/price",
        params={"ids": "bitcoin,ethereum,binancecoin", "vs_currencies": "usd"},
        timeout=15,
    )
    r.raise_for_status()
    d = r.json()
    return {
        "BTC": d["bitcoin"]["usd"],
        "ETH": d["ethereum"]["usd"],
        "BNB": d["binancecoin"]["usd"],
    }


def get_latest_block_num(api_base, api_key):
    r = requests.get(
        api_base,
        params={"module": "proxy", "action": "eth_blockNumber", "apikey": api_key},
        timeout=20,
    )
    r.raise_for_status()
    return int(r.json()["result"], 16)


def fetch_evm_block(api_base, api_key, block_num):
    r = requests.get(
        api_base,
        params={
            "module": "proxy",
            "action": "eth_getBlockByNumber",
            "tag": hex(block_num),
            "boolean": "true",
            "apikey": api_key,
        },
        timeout=20,
    )
    r.raise_for_status()
    return r.json().get("result")


def scan_evm_chain(chain_name, symbol, api_base, api_key, price_usd, state):
    whales = []
    latest = get_latest_block_num(api_base, api_key)
    last = state.get(chain_name)
    if last is None:
        last = latest - 5  # first run: jangan backfill kejauhan

    start = last + 1
    end = min(latest, start + MAX_BLOCKS_PER_RUN - 1)
    if start > end:
        state[chain_name] = latest
        return whales

    for block_num in range(start, end + 1):
        try:
            block = fetch_evm_block(api_base, api_key, block_num)
        except Exception as e:
            print(f"[{chain_name}] error fetching block {block_num}: {e}")
            continue
        if not block:
            continue

        ts = int(block.get("timestamp", "0x0"), 16)
        for tx in block.get("transactions", []):
            try:
                value_wei = int(tx.get("value", "0x0"), 16)
            except ValueError:
                continue
            value_native = value_wei / 1e18
            value_usd = value_native * price_usd
            if value_usd >= THRESHOLD_USD:
                from_addr = tx.get("from")
                to_addr = tx.get("to")
                whales.append({
                    "chain": chain_name,
                    "symbol": symbol,
                    "hash": tx.get("hash"),
                    "from": from_addr,
                    "to": to_addr,
                    "from_label": label_address(from_addr),
                    "to_label": label_address(to_addr),
                    "amount": round(value_native, 4),
                    "amount_usd": round(value_usd, 2),
                    "timestamp": datetime.fromtimestamp(ts, tz=timezone.utc).isoformat(),
                    "block": block_num,
                })
        time.sleep(0.25)

    state[chain_name] = end
    return whales


def scan_bitcoin(price_usd, state):
    whales = []
    r = requests.get("https://blockchain.info/latestblock", timeout=20)
    r.raise_for_status()
    latest = r.json()["height"]

    last = state.get("bitcoin")
    if last is None:
        last = latest - 2

    start = last + 1
    end = min(latest, start + min(MAX_BLOCKS_PER_RUN, 10) - 1)
    if start > end:
        state["bitcoin"] = latest
        return whales

    for height in range(start, end + 1):
        try:
            rh = requests.get(f"https://blockchain.info/block-height/{height}?format=json", timeout=20)
            rh.raise_for_status()
            blocks = rh.json().get("blocks", [])
        except Exception as e:
            print(f"[bitcoin] error fetching block {height}: {e}")
            continue

        for block in blocks:
            ts = block.get("time")
            for tx in block.get("tx", []):
                total_out_satoshi = sum(o.get("value", 0) for o in tx.get("out", []))
                value_btc = total_out_satoshi / 1e8
                value_usd = value_btc * price_usd
                if value_usd >= THRESHOLD_USD:
                    whales.append({
                        "chain": "bitcoin",
                        "symbol": "BTC",
                        "hash": tx.get("hash"),
                        "from": None,
                        "to": None,
                        "amount": round(value_btc, 6),
                        "amount_usd": round(value_usd, 2),
                        "timestamp": datetime.fromtimestamp(ts, tz=timezone.utc).isoformat(),
                        "block": height,
                    })
        time.sleep(0.3)

    state["bitcoin"] = end
    return whales


def compute_signal(whales):
    """
    Signal edukatif berbasis net flow whale ke/dari exchange dalam N jam terakhir.
    Ini BUKAN sinyal beli/jual otomatis - cuma indikator kasar dari data on-chain publik.
    """
    now = datetime.now(timezone.utc)
    inflow = 0.0   # whale kirim DUIT ke exchange -> potensi jual
    outflow = 0.0  # whale tarik dari exchange -> potensi hold/beli

    for w in whales:
        try:
            ts = datetime.fromisoformat(w["timestamp"])
        except Exception:
            continue
        age_hours = (now - ts).total_seconds() / 3600
        if age_hours > SIGNAL_WINDOW_HOURS:
            continue
        if w.get("to_label"):
            inflow += w["amount_usd"]
        if w.get("from_label"):
            outflow += w["amount_usd"]

    net = inflow - outflow
    if net >= SIGNAL_THRESHOLD_USD:
        label = "Tekanan Jual"
        bias = "bearish"
    elif net <= -SIGNAL_THRESHOLD_USD:
        label = "Tekanan Beli"
        bias = "bullish"
    else:
        label = "Netral"
        bias = "neutral"

    return {
        "window_hours": SIGNAL_WINDOW_HOURS,
        "inflow_usd": round(inflow, 2),
        "outflow_usd": round(outflow, 2),
        "net_usd": round(net, 2),
        "label": label,
        "bias": bias,
        "updated_at": now.isoformat(),
        "disclaimer": "Indikator edukatif dari data on-chain publik, bukan saran finansial. Selalu DYOR.",
    }


def main():
    state = load_json(STATE_FILE, {})
    existing = load_json(OUTPUT_FILE, [])

    prices = get_prices()
    new_whales = []

    if ETHERSCAN_KEY:
        new_whales += scan_evm_chain(
            "ethereum", "ETH", "https://api.etherscan.io/api", ETHERSCAN_KEY, prices["ETH"], state
        )
    else:
        print("Skip ethereum: ETHERSCAN_API_KEY belum diset")

    if BSCSCAN_KEY:
        new_whales += scan_evm_chain(
            "bsc", "BNB", "https://api.bscscan.com/api", BSCSCAN_KEY, prices["BNB"], state
        )
    else:
        print("Skip bsc: BSCSCAN_API_KEY belum diset")

    new_whales += scan_bitcoin(prices["BTC"], state)

    combined = new_whales + existing
    seen = set()
    deduped = []
    for w in combined:
        if w["hash"] in seen:
            continue
        seen.add(w["hash"])
        deduped.append(w)

    deduped.sort(key=lambda w: w["timestamp"], reverse=True)
    deduped = deduped[:MAX_STORED]

    signal = compute_signal(deduped)

    save_json(OUTPUT_FILE, deduped)
    save_json(STATE_FILE, state)
    save_json(SIGNAL_FILE, signal)
    print(f"Ditemukan {len(new_whales)} transaksi whale baru. Total tersimpan: {len(deduped)}")
    print(f"Signal: {signal['label']} (net flow ${signal['net_usd']:,.0f})")


if __name__ == "__main__":
    main()
