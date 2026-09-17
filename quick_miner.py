#!/usr/bin/env python3
import socket, json, hashlib, time, binascii, sys, struct, threading, os

WALLET = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("BTC_WALLET", "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa")
POOL_HOST = sys.argv[2] if len(sys.argv) > 2 else "solo.ckpool.org"
POOL_PORT = int(sys.argv[3]) if len(sys.argv) > 3 else 3333

def dbl_sha256(b):
    return hashlib.sha256(hashlib.sha256(b).digest()).digest()

def shrink(c8):
    return format(int(c8[:4], 16) ^ int(c8[4:], 16), '04x')

def compress(h):
    return "".join(shrink(h[i:i+8]) for i in range(0, len(h), 8))

def get_target(nbits_hex):
    n = int(nbits_hex, 16)
    return (n & 0xffffff) * (2 ** (8 * ((n >> 24) - 3)))

print(f"[*] Starting Stratum Bitcoin Miner for Wallet: {WALLET}")
print(f"[*] Pool: {POOL_HOST}:{POOL_PORT}")
sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
sock.connect((POOL_HOST, POOL_PORT))
print("[✓] Connected to live Bitcoin mining pool!")

msg_id = 1
def send(method, params):
    global msg_id
    sock.sendall((json.dumps({"id": msg_id, "method": method, "params": params}) + "\n").encode())
    msg_id += 1

send("mining.subscribe", ["LinuxBTC/1.0"])
data = sock.recv(4096).decode()
sub_res = json.loads(data.split("\n")[0])["result"]
extranonce1 = sub_res[1]
extranonce2_size = int(sub_res[2])

send("mining.authorize", [f"{WALLET}.worker1", "x"])
print(f"[✓] Authorized worker: {WALLET}.worker1")

job = None
pool_target = int(0x00000000ffff0000000000000000000000000000000000000000000000000000 / 1000)

def miner_worker():
    global job, pool_target
    en2 = 0
    hashes = 0
    t0 = time.time()
    while True:
        if not job:
            time.sleep(0.05)
            continue
        cur = dict(job)
        en2_hex = format(en2, f'0{extranonce2_size*2}x')
        coinbase = binascii.unhexlify(cur["cb1"] + extranonce1 + en2_hex + cur["cb2"])
        cb_hash = dbl_sha256(coinbase)
        mroot = cb_hash
        for b in cur["branches"]:
            mroot = dbl_sha256(mroot + binascii.unhexlify(b))
        
        v = binascii.unhexlify(cur["version"])[::-1]
        prev_bin = binascii.unhexlify(cur["prev"])
        prev_swap = b"".join(prev_bin[i:i+4][::-1] for i in range(0, len(prev_bin), 4))
        nt = binascii.unhexlify(cur["ntime"])[::-1]
        nb = binascii.unhexlify(cur["nbits"])[::-1]
        pfx = v + prev_swap + mroot + nt + nb
        
        for nonce in range(0, 0xffffffff):
            if not job or job.get("id") != cur["id"]:
                break
            hdr = pfx + struct.pack("<I", nonce)
            h_bytes = dbl_sha256(hdr)
            h_int = int.from_bytes(h_bytes, "big")
            h_hex = binascii.hexlify(h_bytes[::-1]).decode()
            comp = compress(h_hex)
            
            if h_int <= pool_target:
                print(f"\n[$$$] REAL BITCOIN SHARE! Nonce: {hex(nonce)} | Hash: {h_hex}")
                send("mining.submit", [f"{WALLET}.worker1", cur["id"], en2_hex, cur["ntime"], format(nonce, '08x')])
            if h_int <= cur["net_target"]:
                print(f"\n[🚨 JACKPOT! 🚨] SOLVED FULL BITCOIN BLOCK (3.125 BTC)! Hash: {h_hex}")
            if comp.startswith("1122"):
                print(f"\n[+] 8-to-4 Match: {comp[:8]}... (Nonce: {nonce})")
                
            hashes += 1
            if hashes % 50000 == 0:
                elapsed = max(0.001, time.time() - t0)
                sys.stdout.write(f"\r[-] Mining: {hashes:,} hashes ({(hashes/elapsed)/1000:.1f} kH/s) | Latest: {comp[:8]}... ")
                sys.stdout.flush()
        en2 += 1

threading.Thread(target=miner_worker, daemon=True).start()

buf = ""
while True:
    buf += sock.recv(4096).decode()
    while "\n" in buf:
        line, buf = buf.split("\n", 1)
        if not line.strip(): continue
        msg = json.loads(line)
        if msg.get("method") == "mining.notify":
            p = msg["params"]
            job = {
                "id": p[0], "prev": p[1], "cb1": p[2], "cb2": p[3],
                "branches": p[4], "version": p[5], "nbits": p[6], "ntime": p[7],
                "net_target": get_target(p[6])
            }
            print(f"\n[+] New live Bitcoin block template! Job ID: {p[0]}")
        elif msg.get("method") == "mining.set_difficulty":
            diff = float(msg["params"][0])
            pool_target = int(0x00000000ffff0000000000000000000000000000000000000000000000000000 / max(diff, 1.0))
