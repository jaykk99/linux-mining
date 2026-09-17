#!/usr/bin/env python3
"""
Linux BTC Miner with 8-to-4 Chunk Folding Compression Logic
Shrinks 64-character double-SHA256 hex string into 32-character folded hex.
"""

import hashlib
import time
import sys

def shrink_chunk_8_to_4(chunk_8: str) -> str:
    """
    Takes an 8-character hex chunk (32 bits) and shrinks it 
    down into a 4-character hex chunk (16 bits) using a folding function.
    """
    # Split the 8 chars into two 4-char halves
    part1 = int(chunk_8[:4], 16)
    part2 = int(chunk_8[4:], 16)
    
    # Fold them together using XOR so the whole 8 chars influence the result
    folded = part1 ^ part2
    
    # Format back into a 4-character hex string
    return format(folded, '04x')

def compress_full_hash(full_hash: str) -> str:
    """
    Splits a 64-character hash into 8-character chunks and shrinks 
    each one down to 4 characters, resulting in a 32-character compressed hash.
    """
    compressed_hash = ""
    # Step through the 64-char hash in steps of 8 characters
    for i in range(0, len(full_hash), 8):
        chunk_8 = full_hash[i:i+8]
        compressed_hash += shrink_chunk_8_to_4(chunk_8)
    return compressed_hash

def run_compressed_miner(header_template: str, target_compressed_pattern: str):
    print(f"[*] Starting 8-to-4 Compression Linux Miner...")
    print(f"[*] Target Compressed Pattern: {target_compressed_pattern}")
    print(f"[*] Block Template: {header_template}")
    print("=" * 60)
    
    nonce = 0
    start_time = time.time()
    
    try:
        while True:
            # Construct block header variant with current nonce
            block_data = f"{header_template}:{nonce}"
            
            # Standard double-SHA256
            hash1 = hashlib.sha256(block_data.encode('utf-8')).digest()
            full_hash = hashlib.sha256(hash1).hexdigest()
            
            # Apply your 8-to-4 shrinking logic
            compressed_hash = compress_full_hash(full_hash)
            
            # Check if our compressed hash starts with or matches the target pattern
            if compressed_hash.startswith(target_compressed_pattern):
                elapsed = time.time() - start_time
                khs = (nonce / elapsed) / 1000 if elapsed > 0 else 0
                print(f"\n\n[+] SUCCESS! Match Found!")
                print(f"    Nonce:           {nonce}")
                print(f"    Full Hash (64c): {full_hash}")
                print(f"    Compressed (32c):{compressed_hash}")
                print(f"    Target Match:    {compressed_hash[:len(target_compressed_pattern)]}")
                print(f"    Time Taken:      {elapsed:.2f} seconds")
                print(f"    Average Speed:   {khs:.2f} kH/s")
                print("=" * 60)
                break
                
            nonce += 1
            
            if nonce % 25000 == 0:
                elapsed = time.time() - start_time
                khs = (nonce / elapsed) / 1000 if elapsed > 0 else 0
                sys.stdout.write(f"\r[-] Nonce: {nonce:,} | Speed: {khs:.1f} kH/s | Latest Compressed: {compressed_hash[:8]}...")
                sys.stdout.flush()
                
    except KeyboardInterrupt:
        print("\n[*] Mining stopped by user.")

if __name__ == "__main__":
    template = "BLOCK_DATA_JAY_OMER_LINUX_NODE_2026"
    
    # Target starting pattern for your 32-character compressed hash
    target_pattern = "1122" 
    
    run_compressed_miner(template, target_pattern)
