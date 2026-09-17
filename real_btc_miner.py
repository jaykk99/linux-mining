#!/usr/bin/env python3
"""
Real Bitcoin (BTC) Stratum Miner with 8-to-4 Compression Analyzer
Connects to live Bitcoin mining pools (e.g. solo.ckpool.org, public-pool.io) via Stratum V1 protocol,
receives real Bitcoin block templates from the blockchain, performs double-SHA256 mining,
and submits valid shares to the pool for real BTC rewards.
"""

import socket
import json
import hashlib
import time
import binascii
import sys
import struct
import threading

DEFAULT_POOL_HOST = "solo.ckpool.org"
DEFAULT_POOL_PORT = 3333
# Replace with your actual Bitcoin payout address (SegWit bc1q..., Taproot bc1p..., or Legacy 1...)
DEFAULT_WALLET = "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa" 

def shrink_chunk_8_to_4(chunk_8: str) -> str:
    """Takes an 8-character hex chunk (32 bits) and shrinks to 4 hex characters via XOR folding."""
    part1 = int(chunk_8[:4], 16)
    part2 = int(chunk_8[4:], 16)
    return format(part1 ^ part2, '04x')

def compress_full_hash(full_hash: str) -> str:
    """Compresses 64-character hash into 32 characters using 8-to-4 XOR folding."""
    compressed = ""
    for i in range(0, len(full_hash), 8):
        chunk_8 = full_hash[i:i+8]
        compressed += shrink_chunk_8_to_4(chunk_8)
    return compressed

def dbl_sha256(data: bytes) -> bytes:
    return hashlib.sha256(hashlib.sha256(data).digest()).digest()

def calculate_merkle_root(coinbase_hash_bin: bytes, merkle_branches: list) -> bytes:
    cur = coinbase_hash_bin
    for branch in merkle_branches:
        branch_bin = binascii.unhexlify(branch)
        cur = dbl_sha256(cur + branch_bin)
    return cur

def target_from_bits(nbits_hex: str) -> int:
    """Converts Bitcoin compact nBits format into full 256-bit target integer."""
    nbits = int(nbits_hex, 16)
    exponent = nbits >> 24
    mantissa = nbits & 0xffffff
    return mantissa * (2 ** (8 * (exponent - 3)))

def target_from_difficulty(difficulty: float) -> int:
    """Converts pool difficulty into 256-bit target integer."""
    diff1_target = 0x00000000ffff0000000000000000000000000000000000000000000000000000
    if difficulty <= 0:
        difficulty = 1.0
    return int(diff1_target / difficulty)

class RealBtcStratumMiner:
    def __init__(self, host=DEFAULT_POOL_HOST, port=DEFAULT_POOL_PORT, wallet=DEFAULT_WALLET, target_pattern="1122"):
        self.host = host
        self.port = port
        self.wallet = wallet
        self.target_pattern = target_pattern
        self.sock = None
        self.running = False
        self.difficulty = 1.0
        self.pool_target = target_from_difficulty(1.0)
        self.extranonce1 = ""
        self.extranonce2_size = 4
        self.current_job = None
        self.msg_id = 1
        self.hash_count = 0
        self.start_time = time.time()

    def connect(self):
        print(f"[*] Connecting to Bitcoin Mining Pool: {self.host}:{self.port}...")
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.sock.settimeout(30)
        self.sock.connect((self.host, self.port))
        print(f"[✓] Connected to live Bitcoin pool socket!")

    def send_rpc(self, method, params):
        payload = {
            "id": self.msg_id,
            "method": method,
            "params": params
        }
        self.msg_id += 1
        data = json.dumps(payload) + "\n"
        self.sock.sendall(data.encode('utf-8'))

    def subscribe(self):
        print("[*] Subscribing via Stratum V1 (mining.subscribe)...")
        self.send_rpc("mining.subscribe", ["Linux-BTC-8to4-Miner/1.0"])

    def authorize(self):
        worker_name = f"{self.wallet}.worker1"
        print(f"[*] Authorizing Bitcoin worker: {worker_name}...")
        self.send_rpc("mining.authorize", [worker_name, "x"])

    def listen_and_mine(self):
        self.running = True
        buffer = ""

        # Start background mining thread
        miner_thread = threading.Thread(target=self.mining_worker, daemon=True)
        miner_thread.start()

        while self.running:
            try:
                chunk = self.sock.recv(4096).decode('utf-8', errors='ignore')
                if not chunk:
                    print("[!] Pool disconnected.")
                    break
                buffer += chunk
                while "\n" in buffer:
                    line, buffer = buffer.split("\n", 1)
                    line = line.strip()
                    if line:
                        self.handle_message(json.loads(line))
            except socket.timeout:
                continue
            except Exception as e:
                print(f"[!] Socket error: {e}")
                break

    def handle_message(self, msg):
        method = msg.get("method")
        params = msg.get("params", [])

        if method == "mining.notify":
            # Live Bitcoin block notification directly from Bitcoin blockchain
            # [job_id, prevhash, coinb1, coinb2, merkle_branch, version, nbits, ntime, clean_jobs]
            job_id, prevhash, coinb1, coinb2, merkle_branch, version, nbits, ntime, clean_jobs = params
            network_target = target_from_bits(nbits)

            self.current_job = {
                "job_id": job_id,
                "prevhash": prevhash,
                "coinb1": coinb1,
                "coinb2": coinb2,
                "merkle_branch": merkle_branch,
                "version": version,
                "nbits": nbits,
                "ntime": ntime,
                "clean_jobs": clean_jobs,
                "network_target": network_target,
            }

            print(f"\n[+] NEW LIVE BITCOIN BLOCK TEMPLATE RECEIVED FROM BLOCKCHAIN:")
            print(f"    Job ID:          {job_id}")
            print(f"    Prev Block Hash: {prevhash[:16]}...{prevhash[-16:]}")
            print(f"    Network nBits:   0x{nbits} (Target: {hex(network_target)[:18]}...)")
            print(f"    Pool Difficulty: {self.difficulty}")

        elif method == "mining.set_difficulty":
            self.difficulty = float(params[0])
            self.pool_target = target_from_difficulty(self.difficulty)
            print(f"[*] Pool updated share difficulty: {self.difficulty} (Target: {hex(self.pool_target)[:18]}...)")

        elif "result" in msg and msg["result"] is not None:
            # Handle subscribe reply: [ [ [ "mining.set_difficulty", ... ], ... ], extranonce1, extranonce2_size ]
            result = msg["result"]
            if isinstance(result, list) and len(result) >= 3:
                self.extranonce1 = result[1]
                self.extranonce2_size = int(result[2])
                print(f"[✓] Stratum Subscription accepted! ExtraNonce1: {self.extranonce1}, ExtraNonce2 size: {self.extranonce2_size}")
                self.authorize()
            elif result is True:
                print(f"[✓] Pool accepted share submission / authorized worker successfully!")
            else:
                print(f"[*] Pool Response: {msg}")

        elif "error" in msg and msg["error"] is not None:
            print(f"[!] Pool Error: {msg['error']}")

    def mining_worker(self):
        """High-speed mining loop searching for real Bitcoin shares and 8-to-4 pattern matches"""
        extranonce2 = 0

        while self.running:
            if not self.current_job or not self.extranonce1:
                time.sleep(0.05)
                continue

            job = self.current_job
            extranonce2_hex = format(extranonce2, f'0{self.extranonce2_size * 2}x')
            
            # 1. Build Coinbase Transaction
            coinbase_hex = job["coinb1"] + self.extranonce1 + extranonce2_hex + job["coinb2"]
            coinbase_bin = binascii.unhexlify(coinbase_hex)
            coinbase_hash = dbl_sha256(coinbase_bin)

            # 2. Build Merkle Root
            merkle_root_bin = calculate_merkle_root(coinbase_hash, job["merkle_branch"])

            # 3. Construct 80-byte Bitcoin Block Header (Little Endian)
            version_bin = binascii.unhexlify(job["version"])[::-1]
            prevhash_bin = binascii.unhexlify(job["prevhash"])
            # Stratum prevhash swaps 4-byte words
            prevhash_swapped = b''.join([prevhash_bin[i:i+4][::-1] for i in range(0, len(prevhash_bin), 4)])
            ntime_bin = binascii.unhexlify(job["ntime"])[::-1]
            nbits_bin = binascii.unhexlify(job["nbits"])[::-1]

            header_prefix = version_bin + prevhash_swapped + merkle_root_bin + ntime_bin + nbits_bin

            # 4. Nonce Loop (0x00000000 to 0xffffffff)
            nonce = 0
            while nonce < 0xffffffff and self.running and job == self.current_job:
                nonce_bin = struct.pack("<I", nonce)
                header = header_prefix + nonce_bin
                
                # Double SHA-256
                hash_bytes = dbl_sha256(header)
                hash_int = int.from_bytes(hash_bytes, byteorder="big")
                full_hash_hex = binascii.hexlify(hash_bytes[::-1]).decode('ascii')
                
                # 8-to-4 folding compression analysis
                compressed_hash = compress_full_hash(full_hash_hex)

                # Real BTC Share Check (Pool difficulty)
                if hash_int <= self.pool_target:
                    print(f"\n[$$$] REAL BITCOIN SHARE FOUND! Nonce: {hex(nonce)} | Hash: {full_hash_hex}")
                    # Submit share to Bitcoin pool
                    self.send_rpc("mining.submit", [
                        f"{self.wallet}.worker1",
                        job["job_id"],
                        extranonce2_hex,
                        job["ntime"],
                        format(nonce, '08x')
                    ])

                # Check if it also solved a full Bitcoin Block for the entire network!
                if hash_int <= job["network_target"]:
                    print(f"\n[🚨 JACKPOT! 🚨] SOLVED FULL BITCOIN NETWORK BLOCK! Reward: 3.125 BTC!")
                    print(f"    Block Hash: {full_hash_hex}")
                    print(f"    Compressed: {compressed_hash}")

                # Check 8-to-4 pattern match
                if compressed_hash.startswith(self.target_pattern):
                    print(f"\n[+] 8-to-4 Compressed Match! Nonce: {nonce} | Compressed: {compressed_hash[:8]}... | Full: {full_hash_hex[:16]}...")

                self.hash_count += 1
                nonce += 1

                if self.hash_count % 50000 == 0:
                    elapsed = time.time() - self.start_time
                    khs = (self.hash_count / elapsed) / 1000 if elapsed > 0 else 0
                    sys.stdout.write(f"\r[-] Mining Nonce: {nonce:,} | Speed: {khs:.1f} kH/s | Latest Compressed: {compressed_hash[:8]}... ")
                    sys.stdout.flush()

            extranonce2 += 1

def main():
    import os
    print("=" * 65)
    print("   REAL BITCOIN (BTC) STRATUM MINER & 8-to-4 FOLDING ENGINE   ")
    print("=" * 65)

    # 1. Parse Wallet from arguments, environment, or default
    wallet = DEFAULT_WALLET
    if len(sys.argv) > 1 and not sys.argv[1].startswith("-"):
        wallet = sys.argv[1].strip()
    elif os.environ.get("BTC_WALLET"):
        wallet = os.environ.get("BTC_WALLET").strip()

    # 2. Parse Pool Host/Port
    host = DEFAULT_POOL_HOST
    port = DEFAULT_POOL_PORT
    if len(sys.argv) > 2:
        pool_arg = sys.argv[2].strip()
        if ":" in pool_arg:
            h, p = pool_arg.split(":")
            host = h
            port = int(p)
        else:
            host = pool_arg
    elif os.environ.get("BTC_POOL"):
        pool_env = os.environ.get("BTC_POOL").strip()
        if ":" in pool_env:
            h, p = pool_env.split(":")
            host = h
            port = int(p)
        else:
            host = pool_env

    target_pattern = os.environ.get("TARGET_PATTERN", "1122")
    if len(sys.argv) > 3:
        target_pattern = sys.argv[3].strip()

    print(f"[*] Mining Target Wallet:   {wallet}")
    print(f"[*] Stratum Mining Pool:    {host}:{port}")
    print(f"[*] 8-to-4 Folding Target:  {target_pattern}")
    print(f"[*] Status:                 INITIALIZING LIVE STRATUM MINING...\n")

    miner = RealBtcStratumMiner(host=host, port=port, wallet=wallet, target_pattern=target_pattern)
    try:
        miner.connect()
        miner.subscribe()
        miner.listen_and_mine()
    except KeyboardInterrupt:
        print("\n[*] Mining stopped by user.")
        miner.running = False
    except Exception as e:
        print(f"\n[!] Connection failed: {e}")
        print("[*] Tip: Make sure your network/firewall allows outbound TCP traffic on port 3333.")

if __name__ == "__main__":
    main()
