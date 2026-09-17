#!/usr/bin/env bash
set -e

# Colors for Linux terminal output
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${CYAN}============================================================${NC}"
echo -e "${GREEN}   Linux BTC 8-to-4 Compressed Miner Auto-Installer        ${NC}"
echo -e "${CYAN}============================================================${NC}"

# Check for Python 3
echo -e "\n${YELLOW}[*] Checking Python 3 installation...${NC}"
if ! command -v python3 &> /dev/null; then
    echo -e "${YELLOW}[!] Python 3 not found. Installing via system package manager...${NC}"
    if command -v apt-get &> /dev/null; then
        sudo apt-get update && sudo apt-get install -y python3 python3-pip
    elif command -v dnf &> /dev/null; then
        sudo dnf install -y python3 python3-pip
    elif command -v pacman &> /dev/null; then
        sudo pacman -Sy --noconfirm python python-pip
    elif command -v zypper &> /dev/null; then
        sudo zypper install -y python3
    else
        echo "Could not identify package manager. Please install Python 3 manually."
        exit 1
    fi
else
    PYTHON_VER=$(python3 --version)
    echo -e "${GREEN}[✓] Found: ${PYTHON_VER}${NC}"
fi

# Make miners executable
chmod +x compressed_miner.py real_btc_miner.py

echo -e "\n${GREEN}[✓] Installation complete!${NC}"
echo -e "\n${CYAN}Choose your mining mode:${NC}"
echo -e "   1) ${YELLOW}Real Bitcoin Pool Stratum Mining (Actual BTC rewards to your wallet):${NC}"
echo -e "      ${GREEN}python3 real_btc_miner.py${NC}"
echo -e "   2) ${YELLOW}Local 8-to-4 Compression Folding Benchmark:${NC}"
echo -e "      ${GREEN}python3 compressed_miner.py${NC}\n"
