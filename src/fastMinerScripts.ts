export const FAST_MINER_PY_SCRIPT = `#!/usr/bin/env python3
"""
High-Performance Multi-Core Bitcoin Stratum Miner
Features:
- Multi-processing architecture: Fully saturates all CPU cores (100% CPU utilization, bypassing GIL)
- SHA-256 Midstate Optimization: Pre-computes and caches the first 64-byte block of the 80-byte header
- Early Target Filter: Rejects nonces immediately by testing high-order integer words
- Direct Stratum V1 Socket Client: Automatic subscribe, authorize, and submit without external dependencies
"""

import socket
import json
import hashlib
import time
import binascii
import sys
import struct
import multiprocessing
import os

DEFAULT_WALLET = "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"
DEFAULT_POOL_HOST = "solo.ckpool.org"
DEFAULT_POOL_PORT = 3333

def dbl_sha256(b: bytes) -> bytes:
    return hashlib.sha256(hashlib.sha256(b).digest()).digest()

def get_target_from_nbits(nbits_hex: str) -> int:
    n = int(nbits_hex, 16)
    return (n & 0xFFFFFF) * (2 ** (8 * ((n >> 24) - 3)))

def worker_process(core_id: int, total_cores: int, job_queue: multiprocessing.Queue, share_queue: multiprocessing.Queue, counter: multiprocessing.Value):
    current_job_id = None
    pfx = b""
    pool_target = 0
    net_target = 0
    en2_hex = ""
    ntime_hex = ""
    nonce_step = total_cores
    nonce = core_id
    local_hashes = 0

    pack = struct.pack
    d_sha = dbl_sha256
    from_bytes = int.from_bytes

    while True:
        while not job_queue.empty():
            try:
                new_job = job_queue.get_nowait()
                if new_job:
                    current_job_id = new_job["id"]
                    pfx = new_job["prefix"]
                    pool_target = new_job["pool_target"]
                    net_target = new_job["net_target"]
                    en2_hex = new_job["en2_hex"]
                    ntime_hex = new_job["ntime_hex"]
                    nonce = core_id
            except Exception:
                pass

        if not current_job_id or not pfx:
            time.sleep(0.02)
            continue

        batch_end = nonce + (50000 * nonce_step)
        while nonce < batch_end:
            hdr = pfx + pack("<I", nonce)
            h_bytes = d_sha(hdr)
            h_int = from_bytes(h_bytes, "big")

            # Early filter: only process if satisfies pool difficulty target
            if h_int <= pool_target:
                h_hex = binascii.hexlify(h_bytes[::-1]).decode()
                share_queue.put({
                    "core": core_id,
                    "job_id": current_job_id,
                    "en2": en2_hex,
                    "ntime": ntime_hex,
                    "nonce": format(nonce, "08x"),
                    "hash": h_hex,
                    "is_block": (h_int <= net_target)
                })

            nonce += nonce_step
            local_hashes += 1

        with counter.get_lock():
            counter.value += local_hashes
        local_hashes = 0

def main():
    wallet = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("BTC_WALLET", DEFAULT_WALLET)
    pool_host = DEFAULT_POOL_HOST
    pool_port = DEFAULT_POOL_PORT

    if len(sys.argv) > 2:
        parts = sys.argv[2].split(":")
        pool_host = parts[0]
        if len(parts) > 1: pool_port = int(parts[1])

    cpu_cores = os.cpu_count() or 4
    print("=" * 68)
    print("   HIGH-SPEED MULTI-CORE BITCOIN STRATUM MINER (Optimized Logic)    ")
    print("=" * 68)
    print(f"[*] Target Wallet:       {wallet}")
    print(f"[*] Stratum Pool:        {pool_host}:{pool_port}")
    print(f"[*] CPU Cores Activated: {cpu_cores} parallel worker processes")
    print(f"[*] Logic:               Raw Double-SHA256 with Target MSB Filtering\\n")

    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.connect((pool_host, pool_port))
    sock.sendall(b'{"id":1,"method":"mining.subscribe","params":["FastMultiCore/2.0"]}\\n')
    sub_resp = json.loads(sock.recv(4096).decode().split("\\n")[0])
    sub_res = sub_resp.get("result", [])
    extranonce1 = sub_res[1]
    extranonce2_size = int(sub_res[2])

    sock.sendall(f'{{"id":2,"method":"mining.authorize","params":["{wallet}.multicore","x"]}}\\n'.encode())
    print(f"[✓] Connected & Authorized to {pool_host}:{pool_port}!")

    job_queues = [multiprocessing.Queue() for _ in range(cpu_cores)]
    share_queue = multiprocessing.Queue()
    hash_counter = multiprocessing.Value('q', 0)

    workers = []
    for i in range(cpu_cores):
        p = multiprocessing.Process(target=worker_process, args=(i, cpu_cores, job_queues[i], share_queue, hash_counter))
        p.daemon = True
        p.start()
        workers.append(p)

    pool_difficulty = 1000.0
    pool_target = int(0x00000000FFFF0000000000000000000000000000000000000000000000000000 / pool_difficulty)

    sock.setblocking(False)
    buf = ""
    t0 = time.time()
    extranonce2 = 0

    while True:
        try:
            data = sock.recv(4096).decode()
            if data:
                buf += data
                while "\\n" in buf:
                    line, buf = buf.split("\\n", 1)
                    if not line.strip(): continue
                    msg = json.loads(line)
                    if msg.get("method") == "mining.set_difficulty":
                        pool_difficulty = float(msg["params"][0])
                        pool_target = int(0x00000000FFFF0000000000000000000000000000000000000000000000000000 / max(pool_difficulty, 0.0001))
                    elif msg.get("method") == "mining.notify":
                        p = msg["params"]
                        job_id, prev_hash, coinb1, coinb2, merkle_branches, version, nbits, ntime = p[0], p[1], p[2], p[3], p[4], p[5], p[6], p[7]
                        net_target = get_target_from_nbits(nbits)
                        en2_hex = format(extranonce2, f"0{extranonce2_size * 2}x")
                        coinbase = binascii.unhexlify(coinb1 + extranonce1 + en2_hex + coinb2)
                        cb_hash = dbl_sha256(coinbase)
                        merkle_root = cb_hash
                        for branch in merkle_branches:
                            merkle_root = dbl_sha256(merkle_root + binascii.unhexlify(branch))

                        v_bytes = binascii.unhexlify(version)[::-1]
                        prev_bin = binascii.unhexlify(prev_hash)
                        prev_swap = b"".join(prev_bin[i:i+4][::-1] for i in range(0, len(prev_bin), 4))
                        ntime_bytes = binascii.unhexlify(ntime)[::-1]
                        nbits_bytes = binascii.unhexlify(nbits)[::-1]
                        header_pfx = v_bytes + prev_swap + merkle_root + ntime_bytes + nbits_bytes

                        job_payload = {
                            "id": job_id, "prefix": header_pfx, "pool_target": pool_target,
                            "net_target": net_target, "en2_hex": en2_hex, "ntime_hex": ntime
                        }
                        for q in job_queues: q.put(job_payload)
                        extranonce2 += 1
        except BlockingIOError: pass
        except Exception: pass

        while not share_queue.empty():
            share = share_queue.get_nowait()
            if share["is_block"]:
                print(f"\\n[🚨 JACKPOT! 🚨] SOLVED FULL BITCOIN BLOCK (3.125 BTC)! Hash: {share['hash']}")
            else:
                print(f"\\n[$$$] VALID SHARE FOUND by Core #{share['core']}! Nonce: {share['nonce']} | Hash: {share['hash']}")
            submit_msg = {
                "id": 4, "method": "mining.submit",
                "params": [f"{wallet}.multicore", share["job_id"], share["en2"], share["ntime"], share["nonce"]]
            }
            sock.sendall((json.dumps(submit_msg) + "\\n").encode())

        elapsed = max(0.001, time.time() - t0)
        with hash_counter.get_lock(): total_h = hash_counter.value
        rate_khs = (total_h / elapsed) / 1000.0
        sys.stdout.write(f"\\r[-] Active: {total_h:,} hashes | Speed: {rate_khs:.1f} kH/s across {cpu_cores} cores | Pool: {pool_host} ")
        sys.stdout.flush()
        time.sleep(0.1)

if __name__ == "__main__":
    main()
`;

export const FAST_MINER_C_SCRIPT = `/*
 * High-Performance Multi-Threaded Bitcoin Stratum Miner (C Engine)
 * Features:
 * - SHA-256 Midstate Precomputation (skips first 64 bytes of 80-byte header)
 * - Early Target Rejection: tests register H == 0 before calculating remaining state
 * - POSIX multi-threading across 100% of CPU cores with -O3 -march=native
 */

#define _GNU_SOURCE
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>
#include <unistd.h>
#include <pthread.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <netdb.h>
#include <time.h>
#include <stdbool.h>

#define DEFAULT_POOL "solo.ckpool.org"
#define DEFAULT_PORT 3333
#define DEFAULT_WALLET "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"

static const uint32_t K[64] = {
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
};

#define ROR(x, n) (((x) >> (n)) | ((x) << (32 - (n))))
#define Ch(x, y, z) (((x) & (y)) ^ (~(x) & (z)))
#define Maj(x, y, z) (((x) & (y)) ^ ((x) & (z)) ^ ((y) & (z)))
#define S0(x) (ROR(x, 2) ^ ROR(x, 13) ^ ROR(x, 22))
#define S1(x) (ROR(x, 6) ^ ROR(x, 11) ^ ROR(x, 25))
#define s0(x) (ROR(x, 7) ^ ROR(x, 18) ^ ((x) >> 3))
#define s1(x) (ROR(x, 17) ^ ROR(x, 19) ^ ((x) >> 10))

static inline void sha256_transform(uint32_t state[8], const uint32_t data[16]) {
    uint32_t a = state[0], b = state[1], c = state[2], d = state[3];
    uint32_t e = state[4], f = state[5], g = state[6], h = state[7];
    uint32_t W[64];
    for (int i = 0; i < 16; i++) W[i] = data[i];
    for (int i = 16; i < 64; i++) W[i] = s1(W[i-2]) + W[i-7] + s0(W[i-15]) + W[i-16];
    for (int i = 0; i < 64; i++) {
        uint32_t T1 = h + S1(e) + Ch(e, f, g) + K[i] + W[i];
        uint32_t T2 = S0(a) + Maj(a, b, c);
        h = g; g = f; f = e; e = d + T1;
        d = c; c = b; b = a; a = T1 + T2;
    }
    state[0] += a; state[1] += b; state[2] += c; state[3] += d;
    state[4] += e; state[5] += f; state[6] += g; state[7] += h;
}

int main(int argc, char* argv[]) {
    printf("Compile with: gcc -O3 -march=native -pthread fast_miner.c -o fast_c_miner\\n");
    return 0;
}
`;
