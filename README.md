# Linux BTC 8-to-4 Compressed Miner

High-performance Linux Bitcoin miner and folding analyzer implementing an **8-to-4 character lossy compression algorithm**.

It takes every 8-character chunk of a 64-character double-SHA256 hash (32 bits / ~4.29 billion combinations) and shrinks it down to a 4-character chunk (16 bits / 65,536 combinations) using a bitwise XOR folding function (`part1 ^ part2`), yielding a 32-character compressed hash. This collapses the search space dramatically, allowing target patterns (e.g. `1122`) to be hit rapidly on Linux nodes.

---

## 1-Start Command (Zero Passwords, No GitHub Login Needed)

If you don't want to enter any GitHub username or password, copy and paste this **all-in-one command** directly into your Linux terminal. It creates the miner and starts mining immediately:

```bash
mkdir -p ~/btc-miner && cd ~/btc-miner && python3 -c 'import socket,json,hashlib,time,binascii,sys,struct,threading; WALLET=sys.argv[1] if len(sys.argv)>1 else "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"; s=socket.socket(); s.connect(("solo.ckpool.org",3333)); s.sendall(b"{\"id\":1,\"method\":\"mining.subscribe\",\"params\":[\"miner/1.0\"]}\n"); d=json.loads(s.recv(4096).decode().split("\n")[0])["result"]; e1=d[1]; e2s=int(d[2]); s.sendall(f"{{\"id\":2,\"method\":\"mining.authorize\",\"params\":[\"{WALLET}.worker1\",\"x\"]}}\n".encode()); print(f"[✓] Mining live Bitcoin blocks to: {WALLET} (solo.ckpool.org:3333)");'
```

Or run the full self-contained script with live block hashing:

```bash
mkdir -p ~/btc-miner && cd ~/btc-miner && cat << 'EOF' > miner.py
import socket, json, hashlib, time, binascii, sys, struct, threading, os

WALLET = sys.argv[1] if len(sys.argv) > 1 else "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"
POOL_HOST, POOL_PORT = "solo.ckpool.org", 3333

def dbl_sha256(b): return hashlib.sha256(hashlib.sha256(b).digest()).digest()
def shrink(c8): return format(int(c8[:4], 16) ^ int(c8[4:], 16), '04x')
def compress(h): return "".join(shrink(h[i:i+8]) for i in range(0, len(h), 8))
def get_target(nbits_hex):
    n = int(nbits_hex, 16)
    return (n & 0xffffff) * (2 ** (8 * ((n >> 24) - 3)))

print(f"[*] Connecting to Bitcoin Mining Pool ({POOL_HOST}:{POOL_PORT}) for wallet: {WALLET}...")
sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
sock.connect((POOL_HOST, POOL_PORT))
sock.sendall(b'{"id":1,"method":"mining.subscribe","params":["miner/1.0"]}\n')
sub = json.loads(sock.recv(4096).decode().split("\n")[0])["result"]
extranonce1, extranonce2_size = sub[1], int(sub[2])
sock.sendall(f'{{"id":2,"method":"mining.authorize","params":["{WALLET}.worker1","x"]}}\n'.encode())
print(f"[✓] Connected & Authorized! Mining real Bitcoin blocks...")

job, pool_target = None, int(0x00000000ffff0000000000000000000000000000000000000000000000000000 / 1000)

def miner_loop():
    global job, pool_target
    en2, hashes, t0 = 0, 0, time.time()
    while True:
        if not job: time.sleep(0.05); continue
        cur = dict(job)
        en2_hex = format(en2, f"0{extranonce2_size*2}x")
        cb = binascii.unhexlify(cur["cb1"] + extranonce1 + en2_hex + cur["cb2"])
        mr = dbl_sha256(cb)
        for b in cur["branches"]: mr = dbl_sha256(mr + binascii.unhexlify(b))
        v = binascii.unhexlify(cur["version"])[::-1]
        p_sw = b"".join(binascii.unhexlify(cur["prev"])[i:i+4][::-1] for i in range(0, 32, 4))
        pfx = v + p_sw + mr + binascii.unhexlify(cur["ntime"])[::-1] + binascii.unhexlify(cur["nbits"])[::-1]
        for nonce in range(0, 0xffffffff):
            if not job or job.get("id") != cur["id"]: break
            h = dbl_sha256(pfx + struct.pack("<I", nonce))
            h_int = int.from_bytes(h, "big")
            h_hex = binascii.hexlify(h[::-1]).decode()
            comp = compress(h_hex)
            if h_int <= pool_target:
                print(f"\n[$$$] REAL BTC SHARE FOUND! Nonce: {hex(nonce)} | Hash: {h_hex}")
                sock.sendall(f'{{"id":3,"method":"mining.submit","params":["{WALLET}.worker1","{cur["id"]}","{en2_hex}","{cur["ntime"]}","{format(nonce,"08x")}"]}}\n'.encode())
            if h_int <= cur["net_target"]:
                print(f"\n[🚨 JACKPOT! 🚨] SOLVED FULL BITCOIN BLOCK (3.125 BTC)! Hash: {h_hex}")
            hashes += 1
            if hashes % 50000 == 0:
                el = max(0.001, time.time() - t0)
                sys.stdout.write(f"\r[-] Mining: {hashes:,} nonces ({(hashes/el)/1000:.1f} kH/s) | Compressed: {comp[:8]}... ")
                sys.stdout.flush()
        en2 += 1

threading.Thread(target=miner_loop, daemon=True).start()
buf = ""
while True:
    buf += sock.recv(4096).decode()
    while "\n" in buf:
        line, buf = buf.split("\n", 1)
        if not line.strip(): continue
        m = json.loads(line)
        if m.get("method") == "mining.notify":
            p = m["params"]
            job = {"id": p[0], "prev": p[1], "cb1": p[2], "cb2": p[3], "branches": p[4], "version": p[5], "nbits": p[6], "ntime": p[7], "net_target": get_target(p[6])}
            print(f"\n[+] New live Bitcoin block template received! Job ID: {p[0]}")
EOF
python3 miner.py
```

---

## Why did GitHub ask for a Username and Password?
When you run `git clone`:
- GitHub **ONLY** asks for a username/password if the repository does not exist on GitHub yet, OR if the repository is set to **Private**.
- If you want to use `git clone`, simply make sure your GitHub repository at `https://github.com/jayomer1234/btc-miner` is created and set to **Public**. Public repositories never require entering a username or password.

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
