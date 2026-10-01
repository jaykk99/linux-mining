#!/usr/bin/env bash
# ==============================================================================
# High-Performance Bitcoin Stratum Miner - 1-Click Startup Script
# Features:
# - Auto-detects GCC/Clang for native C compilation with -O3 optimizations
# - Auto-fallback to multiprocessing Python utilizing 100% of CPU cores
# - Real double-SHA256 cryptographic verification matching Bitcoin consensus
# - Zero passwords, zero prompts
#
# Usage:
#   ./start.sh [WALLET] [POOL]            start mining
#   ./start.sh --check                   run pre-flight checks only (no mining)
#   ./start.sh --help                    show this help
#
# Env overrides: BTC_WALLET, BTC_POOL (host:port), TARGET_PATTERN
# ==============================================================================

set -e
cd "$(dirname "$0")"

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
PURPLE='\033[0;35m'
NC='\033[0m'

usage() {
    echo "Usage: $0 [WALLET] [POOL]"
    echo ""
    echo "  WALLET   Bitcoin payout address (default: \$BTC_WALLET or built-in default)"
    echo "  POOL     Stratum pool host:port (default: \$BTC_POOL or solo.ckpool.org:3333)"
    echo ""
    echo "  --check  Run pre-flight checks (python, compiler, scripts, GPU, config)"
    echo "           and exit without mining."
    echo "  --help   Show this help."
    echo ""
    echo "Examples:"
    echo "  $0"
    echo "  $0 bc1q... solo.ckpool.org:3333"
    echo "  BTC_WALLET=bc1q... BTC_POOL=public-pool.io:21496 $0"
}

if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
    usage
    exit 0
fi

if [ "${1:-}" = "--check" ]; then
    echo -e "${CYAN}[*] Running pre-flight checks (no mining will start)...${NC}"
    exec python3 preflight.py --wallet "${BTC_WALLET:-}" --pool "${BTC_POOL:-solo.ckpool.org:3333}" --pattern "${TARGET_PATTERN:-1122}"
fi

WALLET="${1:-${BTC_WALLET:-1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa}}"
POOL="${2:-${BTC_POOL:-solo.ckpool.org:3333}}"

# --- Validate pool argument -------------------------------------------------
if [[ "$POOL" == *:* ]]; then
    POOL_HOST="${POOL%%:*}"
    POOL_PORT="${POOL##*:}"
else
    POOL_HOST="$POOL"
    POOL_PORT="3333"
    echo -e "${YELLOW}[!] No port in pool argument; defaulting to ${POOL_PORT}${NC}"
fi

if [ -z "$POOL_HOST" ]; then
    echo -e "${RED}[✗] Pool host is empty. Pass host:port, e.g. solo.ckpool.org:3333${NC}" >&2
    exit 2
fi

if ! [[ "$POOL_PORT" =~ ^[0-9]+$ ]] || [ "$POOL_PORT" -lt 1 ] || [ "$POOL_PORT" -gt 65535 ]; then
    echo -e "${RED}[✗] Invalid pool port: '${POOL_PORT}'. Must be a number 1-65535.${NC}" >&2
    exit 2
fi

if [ -z "$WALLET" ]; then
    echo -e "${RED}[✗] Wallet address is empty.${NC}" >&2
    exit 2
fi
# ----------------------------------------------------------------------------

echo -e "${CYAN}====================================================================${NC}"
echo -e "${GREEN}   HIGH-SPEED BITCOIN STRATUM MINER (Optimized Consensus Engine)   ${NC}"
echo -e "${CYAN}====================================================================${NC}"
echo -e "${CYAN}[*] Target Wallet:${NC} ${YELLOW}${WALLET}${NC}"
echo -e "${CYAN}[*] Mining Pool:  ${NC} ${GREEN}${POOL_HOST}:${POOL_PORT}${NC}"

# Quick pre-flight before launching (fast local checks only, no pool contact)
if ! python3 preflight.py --quiet --wallet "$WALLET" --pool "${POOL_HOST}:${POOL_PORT}"; then
    echo -e "${RED}[✗] Pre-flight checks failed. Fix the issues above or run './start.sh --check' for details.${NC}" >&2
    exit 1
fi

# Check for C Compiler (GCC / Clang) for maximum native speed
if command -v gcc &> /dev/null && [ -f "fast_miner.c" ]; then
    echo -e "${GREEN}[✓] GCC detected! Compiling native C engine (-O3 -march=native -pthread)...${NC}"
    if ! gcc -O3 -march=native -pthread fast_miner.c -o fast_c_miner 2>/dev/null; then
        echo -e "${YELLOW}[!] -march=native failed, retrying with generic -O3...${NC}"
        gcc -O3 -pthread fast_miner.c -o fast_c_miner
    fi
    echo -e "${PURPLE}[⚡] Launching ultra-fast Native C multi-threaded miner...${NC}\n"
    exec ./fast_c_miner "$WALLET" "$POOL_HOST" "$POOL_PORT"
fi

if command -v clang &> /dev/null && [ -f "fast_miner.c" ]; then
    echo -e "${GREEN}[✓] Clang detected! Compiling native C engine (-O3 -pthread)...${NC}"
    clang -O3 -pthread fast_miner.c -o fast_c_miner
    echo -e "${PURPLE}[⚡] Launching ultra-fast Native C multi-threaded miner...${NC}\n"
    exec ./fast_c_miner "$WALLET" "$POOL_HOST" "$POOL_PORT"
fi

# Fallback to multi-core Python engine
echo -e "${YELLOW}[*] C compiler not detected. Launching high-speed Multi-Core Python engine...${NC}"
chmod +x fast_miner.py 2>/dev/null || true
exec python3 fast_miner.py "$WALLET" "${POOL_HOST}:${POOL_PORT}"
