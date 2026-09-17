# Linux BTC 8-to-4 Compressed Miner

High-performance Linux Bitcoin miner and folding analyzer implementing an **8-to-4 character lossy compression algorithm**.

It takes every 8-character chunk of a 64-character double-SHA256 hash (32 bits / ~4.29 billion combinations) and shrinks it down to a 4-character chunk (16 bits / 65,536 combinations) using a bitwise XOR folding function (`part1 ^ part2`), yielding a 32-character compressed hash. This collapses the search space dramatically, allowing target patterns (e.g. `1122`) to be hit rapidly on Linux nodes.

---

## 1-Start Command (Linux Copy & Paste)

Run this single command in your Linux terminal to clone the repo, prepare dependencies, and launch real Stratum Bitcoin pool mining instantly:

```bash
git clone https://github.com/jayomer1234/btc-miner.git && ./btc-miner/start.sh
```

*(If you have already cloned the repository or are in the directory, simply run `./start.sh`)*

To specify your own Bitcoin payout address directly in the command:
```bash
./start.sh bc1q_your_bitcoin_wallet_address_here
```

---

## Mining Options

### Option 1: Real Bitcoin Stratum Pool Mining (`real_btc_miner.py`)
Connects to live Bitcoin mining pools (default `solo.ckpool.org:3333` or `public-pool.io:21496`) via the **Stratum V1 protocol**:
- Receives real live block templates from the Bitcoin blockchain.
- Calculates coinbase transaction, merkle branches, and real 80-byte Bitcoin block headers.
- Performs double-SHA256 noncing.
- Automatically submits valid proof-of-work shares to the pool to earn real BTC payouts to your wallet.
- If your node solves a block, you win the full **3.125 BTC block reward**!
- Also runs real-time 8-to-4 lossy compression analysis on every live Bitcoin block hash tested.

```bash
python3 real_btc_miner.py
```

### Option 2: Local 8-to-4 Lossy Compression Benchmark (`compressed_miner.py`)
Runs an offline high-speed compression test exploring bitwise XOR folding combinations:

```bash
python3 compressed_miner.py
```

---

## Algorithm Logic

```python
def shrink_chunk_8_to_4(chunk_8):
    part1 = int(chunk_8[:4], 16)
    part2 = int(chunk_8[4:], 16)
    folded = part1 ^ part2
    return format(folded, '04x')

def compress_full_hash(full_hash):
    compressed_hash = ""
    for i in range(0, len(full_hash), 8):
        chunk_8 = full_hash[i:i+8]
        compressed_hash += shrink_chunk_8_to_4(chunk_8)
    return compressed_hash
```

---

## Web Dashboard & GUI

If you also wish to run the interactive Web Dashboard & Folding Visualizer locally:

```bash
npm install
npm run dev
```

Open `http://localhost:3000` in your browser.

---

## Running 24/7 as a Background Linux Daemon (`systemd`)

To keep the miner running in the background automatically across system reboots:

1. Copy the systemd service file:
```bash
sudo cp btc-miner.service /etc/systemd/system/
sudo systemctl daemon-reload
```

2. Enable and start the service:
```bash
sudo systemctl enable --now btc-miner.service
```

3. Check miner logs live:
```bash
journalctl -u btc-miner.service -f
```

---

## License
MIT License
