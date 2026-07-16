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

SOLANA_RPC_URL = os.environ.get("SOLANA_RPC_URL", "https://api.mainnet-beta.solana.com")

# Semua chain EVM sekarang diakses langsung lewat RPC publik (JSON-RPC standar),
# BUKAN lewat Etherscan API - soalnya Etherscan sekarang mewajibkan paket
# berbayar buat scan BSC dan beberapa chain lain. RPC publik gratis, gak perlu key.
# Mau ganti RPC (misal lebih stabil pakai Alchemy/Ankr/QuickNode gratis)?
# Tinggal override lewat secret ETH_RPC_URL / BSC_RPC_URL di GitHub.
EVM_CHAINS = [
    {
        "name": "ethereum", "symbol": "ETH",
        "rpc_url": os.environ.get("ETH_RPC_URL", "https://ethereum-rpc.publicnode.com"),
        "coingecko_id": "ethereum",
    },
    {
        "name": "bsc", "symbol": "BNB",
        "rpc_url": os.environ.get("BSC_RPC_URL", "https://bsc-rpc.publicnode.com"),
        "coingecko_id": "binancecoin",
    },
]

# Alamat hot-wallet exchange di Solana yang dikenal publik (belum lengkap).
SOLANA_EXCHANGE_ADDRESSES = {
    "5tzfkidyacmt7phbwtaobjqrgbnvfvyifdzemhcssaeq": "Binance",
    "9wfmvrwrsm5w2q6c5cbstv7edq4f4ynmkgqfnhllwvxu": "Binance",
    "h8sMJSCQxfKiFTCfDR3DUMLPwcqGgVXi3swAhSAo6L1s": "Coinbase",
    "2ojv9BAiHUrvsm9gxDe7fJSzbNZSJcxZvf8dqmWGHG8S": "Kraken",
}


def label_solana_address(addr):
    if not addr:
        return None
    return SOLANA_EXCHANGE_ADDRESSES.get(addr.lower())

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
        params={"ids": "bitcoin,ethereum,binancecoin,solana", "vs_currencies": "usd"},
        timeout=15,
    )
    r.raise_for_status()
    d = r.json()
    return {
        "BTC": d["bitcoin"]["usd"],
        "ETH": d["ethereum"]["usd"],
        "BNB": d["binancecoin"]["usd"],
        "SOL": d["solana"]["usd"],
    }


def evm_rpc(rpc_url, method, params):
    r = requests.post(
        rpc_url,
        json={"jsonrpc": "2.0", "id": 1, "method": method, "params": params},
        timeout=20,
    )
    r.raise_for_status()
    data = r.json()
    if "error" in data:
        raise RuntimeError(data["error"])
    return data.get("result")


def get_latest_block_num(rpc_url):
    result = evm_rpc(rpc_url, "eth_blockNumber", [])
    return int(result, 16)


def fetch_evm_block(rpc_url, block_num):
    return evm_rpc(rpc_url, "eth_getBlockByNumber", [hex(block_num), True])


def scan_evm_chain(chain_name, symbol, rpc_url, price_usd, state):
    whales = []
    latest = get_latest_block_num(rpc_url)
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
            block = fetch_evm_block(rpc_url, block_num)
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


def solana_rpc(method, params):
    r = requests.post(
        SOLANA_RPC_URL,
        json={"jsonrpc": "2.0", "id": 1, "method": method, "params": params},
        timeout=20,
    )
    r.raise_for_status()
    data = r.json()
    if "error" in data:
        raise RuntimeError(data["error"])
    return data.get("result")


def scan_solana(price_usd, state):
    whales = []
    max_slots = min(MAX_BLOCKS_PER_RUN, 25)  # RPC publik gampang kena rate limit

    latest = solana_rpc("getSlot", [])
    last = state.get("solana")
    if last is None:
        last = latest - 3

    start = last + 1
    end = min(latest, start + max_slots - 1)
    if start > end:
        state["solana"] = latest
        return whales

    for slot in range(start, end + 1):
        try:
            block = solana_rpc("getBlock", [slot, {
                "encoding": "jsonParsed",
                "transactionDetails": "full",
                "maxSupportedTransactionVersion": 0,
                "rewards": False,
            }])
        except Exception as e:
            print(f"[solana] error fetching slot {slot}: {e}")
            time.sleep(0.5)
            continue

        if not block:
            state["solana"] = slot
            continue

        ts = block.get("blockTime")
        for tx in block.get("transactions", []):
            try:
                meta = tx.get("meta", {})
                if meta.get("err"):
                    continue
                message = tx["transaction"]["message"]
                for ix in message.get("instructions", []):
                    parsed = ix.get("parsed")
                    if not parsed or not isinstance(parsed, dict):
                        continue
                    if ix.get("program") != "system" or parsed.get("type") != "transfer":
                        continue
                    info = parsed.get("info", {})
                    lamports = info.get("lamports", 0)
                    value_sol = lamports / 1e9
                    value_usd = value_sol * price_usd
                    if value_usd >= THRESHOLD_USD:
                        src = info.get("source")
                        dst = info.get("destination")
                        whales.append({
                            "chain": "solana",
                            "symbol": "SOL",
                            "hash": tx["transaction"]["signatures"][0],
                            "from": src,
                            "to": dst,
                            "from_label": label_solana_address(src),
                            "to_label": label_solana_address(dst),
                            "amount": round(value_sol, 4),
                            "amount_usd": round(value_usd, 2),
                            "timestamp": datetime.fromtimestamp(ts, tz=timezone.utc).isoformat() if ts else datetime.now(timezone.utc).isoformat(),
                            "block": slot,
                        })
            except Exception:
                continue
        time.sleep(0.4)

    state["solana"] = end
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

    for chain in EVM_CHAINS:
        try:
            new_whales += scan_evm_chain(
                chain["name"], chain["symbol"], chain["rpc_url"],
                prices[chain["symbol"]], state,
            )
        except Exception as e:
            print(f"[{chain['name']}] gagal scan: {e}")

    new_whales += scan_bitcoin(prices["BTC"], state)

    try:
        new_whales += scan_solana(prices["SOL"], state)
    except Exception as e:
        print(f"[solana] gagal scan: {e}")

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
