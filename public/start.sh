#!/usr/bin/env bash
# ==============================================================================
# High-Performance Bitcoin Stratum Miner - 1-Click Startup Script
# Features:
# - Auto-detects GCC/Clang for native C compilation with -O3 optimizations
# - Auto-fallback to multiprocessing Python utilizing 100% of CPU cores
# - Real double-SHA256 cryptographic verification matching Bitcoin consensus
# - Zero passwords, zero prompts
# ==============================================================================

set -e
cd "$(dirname "$0")"

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
PURPLE='\033[0;35m'
NC='\033[0m'

WALLET="${1:-1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa}"
POOL="${2:-solo.ckpool.org:3333}"

echo -e "${CYAN}====================================================================${NC}"
echo -e "${GREEN}   HIGH-SPEED BITCOIN STRATUM MINER (Optimized Consensus Engine)   ${NC}"
echo -e "${CYAN}====================================================================${NC}"
echo -e "${CYAN}[*] Target Wallet:${NC} ${YELLOW}${WALLET}${NC}"
echo -e "${CYAN}[*] Mining Pool:  ${NC} ${GREEN}${POOL}${NC}"

# Check for C Compiler (GCC / Clang) for maximum native speed
if command -v gcc &> /dev/null && [ -f "fast_miner.c" ]; then
    echo -e "${GREEN}[✓] GCC detected! Compiling native C engine (-O3 -march=native -pthread)...${NC}"
    gcc -O3 -march=native -pthread fast_miner.c -o fast_c_miner 2>/dev/null || gcc -O3 -pthread fast_miner.c -o fast_c_miner
    echo -e "${PURPLE}[⚡] Launching ultra-fast Native C multi-threaded miner...${NC}\n"
    POOL_HOST="${POOL%%:*}"
    POOL_PORT="${POOL##*:}"
    exec ./fast_c_miner "$WALLET" "$POOL_HOST" "$POOL_PORT"
fi

if command -v clang &> /dev/null && [ -f "fast_miner.c" ]; then
    echo -e "${GREEN}[✓] Clang detected! Compiling native C engine (-O3 -pthread)...${NC}"
    clang -O3 -pthread fast_miner.c -o fast_c_miner
    echo -e "${PURPLE}[⚡] Launching ultra-fast Native C multi-threaded miner...${NC}\n"
    POOL_HOST="${POOL%%:*}"
    POOL_PORT="${POOL##*:}"
    exec ./fast_c_miner "$WALLET" "$POOL_HOST" "$POOL_PORT"
fi

# Fallback to multi-core Python engine
echo -e "${YELLOW}[*] C compiler not detected. Launching high-speed Multi-Core Python engine...${NC}"
chmod +x fast_miner.py 2>/dev/null || true
exec python3 fast_miner.py "$WALLET" "$POOL"
