#!/usr/bin/env bash
# ==============================================================================
# Linux BTC 8-to-4 Compressed Real Stratum Miner - 1-Click Startup Script
# ==============================================================================

set -e

# Change to script directory
cd "$(dirname "$0")"

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${CYAN}============================================================${NC}"
echo -e "${GREEN}   Linux Real Bitcoin (BTC) Stratum Miner - Auto Start       ${NC}"
echo -e "${CYAN}============================================================${NC}"

# Check for Python 3
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}[!] Python 3 is required. Please install python3 or run: sudo apt install python3${NC}"
    exit 1
fi

chmod +x real_btc_miner.py compressed_miner.py 2>/dev/null || true

WALLET="${1:-1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa}"
POOL="${2:-solo.ckpool.org:3333}"

echo -e "${GREEN}[✓] Python 3 ready!${NC}"
echo -e "${CYAN}[*] Starting real Stratum pool mining to address:${NC} ${YELLOW}${WALLET}${NC}"
echo -e "${CYAN}[*] Pool:${NC} ${GREEN}${POOL}${NC}"
echo -e "${CYAN}[*] To specify your own payout address, run:${NC} ${GREEN}./start.sh YOUR_BTC_ADDRESS${NC}\n"

exec python3 real_btc_miner.py "$WALLET" "$POOL"
