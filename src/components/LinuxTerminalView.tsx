import React, { useState, useRef, useEffect } from 'react';
import { Terminal, Download, Copy, Check, Server, FileCode, Play, Trash2, ArrowRight, Github, Coins } from 'lucide-react';
import { TerminalLine } from '../types';
import { REAL_BTC_MINER_SCRIPT } from '../realBtcMinerScript';

interface LinuxTerminalViewProps {
  terminalLogs: TerminalLine[];
  onClearLogs: () => void;
  isMining: boolean;
  onToggleMining: () => void;
}

const DIRECT_NO_PASSWORD_CMD = `mkdir -p ~/btc-miner && cd ~/btc-miner && cat << 'EOF' > miner.py
import socket, json, hashlib, time, binascii, sys, struct, threading
WALLET = sys.argv[1] if len(sys.argv) > 1 else "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"
def dbl_sha256(b): return hashlib.sha256(hashlib.sha256(b).digest()).digest()
def shrink(c8): return format(int(c8[:4], 16) ^ int(c8[4:], 16), '04x')
def compress(h): return "".join(shrink(h[i:i+8]) for i in range(0, len(h), 8))
def get_target(nb): n = int(nb, 16); return (n & 0xffffff) * (2 ** (8 * ((n >> 24) - 3)))
print(f"[*] Connecting to Bitcoin Mining Pool (solo.ckpool.org:3333) for: {WALLET}")
s = socket.socket(); s.connect(("solo.ckpool.org", 3333))
s.sendall(b'{"id":1,"method":"mining.subscribe","params":["miner/1.0"]}\\n')
sub = json.loads(s.recv(4096).decode().split("\\n")[0])["result"]
e1, e2s = sub[1], int(sub[2])
s.sendall(f'{{"id":2,"method":"mining.authorize","params":["{WALLET}.worker1","x"]}}\\n'.encode())
print(f"[✓] Connected & Authorized! Mining live Bitcoin blocks...")
job, pool_target = None, int(0x00000000ffff0000000000000000000000000000000000000000000000000000 / 1000)
def miner_loop():
    global job, pool_target
    en2, hashes, t0 = 0, 0, time.time()
    while True:
        if not job: time.sleep(0.05); continue
        cur = dict(job)
        en2_hex = format(en2, f"0{e2s*2}x")
        cb = binascii.unhexlify(cur["cb1"] + e1 + en2_hex + cur["cb2"])
        mr = dbl_sha256(cb)
        for b in cur["branches"]: mr = dbl_sha256(mr + binascii.unhexlify(b))
        pfx = binascii.unhexlify(cur["v"])[::-1] + b"".join(binascii.unhexlify(cur["prev"])[i:i+4][::-1] for i in range(0, 32, 4)) + mr + binascii.unhexlify(cur["nt"])[::-1] + binascii.unhexlify(cur["nb"])[::-1]
        for nonce in range(0, 0xffffffff):
            if not job or job.get("id") != cur["id"]: break
            h = dbl_sha256(pfx + struct.pack("<I", nonce))
            h_int = int.from_bytes(h, "big")
            h_hex = binascii.hexlify(h[::-1]).decode()
            comp = compress(h_hex)
            if h_int <= pool_target:
                print(f"\\n[$$$] REAL BTC SHARE! Nonce: {hex(nonce)} | Hash: {h_hex}")
                s.sendall(f'{{"id":3,"method":"mining.submit","params":["{WALLET}.worker1","{cur["id"]}","{en2_hex}","{cur["nt"]}","{format(nonce,"08x")}"]}}\\n'.encode())
            if h_int <= cur["net_target"]:
                print(f"\\n[🚨 JACKPOT! 🚨] SOLVED FULL BITCOIN BLOCK! Hash: {h_hex}")
            hashes += 1
            if hashes % 50000 == 0:
                el = max(0.001, time.time() - t0)
                sys.stdout.write(f"\\r[-] Mining: {hashes:,} nonces ({(hashes/el)/1000:.1f} kH/s) | Compressed: {comp[:8]}... ")
                sys.stdout.flush()
        en2 += 1
threading.Thread(target=miner_loop, daemon=True).start()
buf = ""
while True:
    buf += s.recv(4096).decode()
    while "\\n" in buf:
        line, buf = buf.split("\\n", 1)
        if not line.strip(): continue
        m = json.loads(line)
        if m.get("method") == "mining.notify":
            p = m["params"]
            job = {"id": p[0], "prev": p[1], "cb1": p[2], "cb2": p[3], "branches": p[4], "v": p[5], "nb": p[6], "nt": p[7], "net_target": get_target(p[6])}
            print(f"\\n[+] New live Bitcoin block template received! Job ID: {p[0]}")
EOF
python3 miner.py`;

const GITHUB_ONE_START_CMD = `git clone https://github.com/jayomer1234/btc-miner.git && ./btc-miner/start.sh`;
const LOCAL_ONE_START_CMD = `./start.sh`;
const GITHUB_COMPRESSED_CMD = `git clone https://github.com/jayomer1234/btc-miner.git && cd btc-miner && ./install.sh && python3 compressed_miner.py`;

const PYTHON_SCRIPT_CODE = `#!/usr/bin/env python3
"""
Linux BTC Miner with 8-to-4 Chunk Folding Compression Logic
Shrinks 64-character double-SHA256 hex string into 32-character folded hex.
"""

import hashlib
import time
import sys

def shrink_chunk_8_to_4(chunk_8):
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

def compress_full_hash(full_hash):
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

def run_compressed_miner(header_template, target_compressed_pattern):
    print(f"[*] Starting 8-to-4 Compression Linux Miner...")
    print(f"[*] Target Compressed Pattern: {target_compressed_pattern}")
    
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
                print(f"\\n[+] SUCCESS! Match Found!")
                print(f"    Nonce: {nonce}")
                print(f"    Full Hash: {full_hash}")
                print(f"    Compressed Hash: {compressed_hash}")
                print(f"    Time Taken: {elapsed:.2f} seconds")
                break
                
            nonce += 1
            
            if nonce % 50000 == 0:
                print(f"[-] Tried {nonce} nonces... Current compressed: {compressed_hash[:8]}...", end='\\r')
                
    except KeyboardInterrupt:
        print("\\n[*] Mining stopped by user.")

if __name__ == "__main__":
    template = "BLOCK_DATA_JAY_OMER_LINUX_NODE_2026"
    
    # Target starting pattern for your 32-character compressed hash
    target_pattern = "1122" 
    
    run_compressed_miner(template, target_pattern)
`;

const SYSTEMD_SERVICE_FILE = `[Unit]
Description=Linux BTC 8-to-4 Compressed Miner
After=network.target

[Service]
Type=simple
User=jay
WorkingDirectory=/home/jay/btc-miner
ExecStart=/usr/bin/python3 /home/jay/btc-miner/compressed_miner.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
`;

export const LinuxTerminalView: React.FC<LinuxTerminalViewProps> = ({
  terminalLogs,
  onClearLogs,
  isMining,
  onToggleMining,
}) => {
  const [activeTab, setActiveTab] = useState<'console' | 'script' | 'linux-guide'>('console');
  const [selectedScriptType, setSelectedScriptType] = useState<'real' | 'compressed'>('real');
  const [copiedScript, setCopiedScript] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeTab === 'console') {
      terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [terminalLogs, activeTab]);

  const activeScriptCode = selectedScriptType === 'real' ? REAL_BTC_MINER_SCRIPT : PYTHON_SCRIPT_CODE;
  const activeScriptFilename = selectedScriptType === 'real' ? 'real_btc_miner.py' : 'compressed_miner.py';

  const handleCopyScript = () => {
    navigator.clipboard.writeText(activeScriptCode);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  const handleCopyCommand = (cmd: string) => {
    navigator.clipboard.writeText(cmd);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  const handleDownloadScript = () => {
    const blob = new Blob([activeScriptCode], { type: 'text/x-python;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = activeScriptFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl flex flex-col text-slate-100">
      {/* Linux Window Top Bar */}
      <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 mr-2">
            <div className="w-3 h-3 rounded-full bg-rose-500/80 border border-rose-600/40" />
            <div className="w-3 h-3 rounded-full bg-amber-500/80 border border-amber-600/40" />
            <div className="w-3 h-3 rounded-full bg-emerald-500/80 border border-emerald-600/40" />
          </div>
          <Terminal className="w-4 h-4 text-slate-400" />
          <span className="font-mono text-xs text-slate-300 font-semibold tracking-wide">
            jay@linux-node: ~/btc-miner
          </span>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-xs">
          <button
            onClick={() => setActiveTab('console')}
            className={`px-3 py-1 rounded transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'console'
                ? 'bg-slate-800 text-cyan-300 font-medium'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Terminal Console</span>
          </button>
          <button
            onClick={() => setActiveTab('script')}
            className={`px-3 py-1 rounded transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'script'
                ? 'bg-slate-800 text-cyan-300 font-medium'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>compressed_miner.py</span>
          </button>
          <button
            onClick={() => setActiveTab('linux-guide')}
            className={`px-3 py-1 rounded transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'linux-guide'
                ? 'bg-slate-800 text-cyan-300 font-medium'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Github className="w-3.5 h-3.5 text-emerald-400" />
            <span>GitHub 1-Click Install</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-4 flex-1 min-h-[380px] max-h-[520px] overflow-y-auto">
        {/* TAB 1: Real-time Terminal Console */}
        {activeTab === 'console' && (
          <div className="font-mono text-xs space-y-1">
            <div className="text-slate-500 pb-2 border-b border-slate-800/80 mb-3 flex items-center justify-between">
              <span>Linux 6.8.0-generic x86_64 | Python 3.10.12 | bash 5.1.16</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={onClearLogs}
                  className="text-slate-400 hover:text-slate-200 flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 transition cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" /> Clear
                </button>
              </div>
            </div>

            {/* Prompt command line */}
            <div className="flex items-center gap-2 text-slate-300 mb-2">
              <span className="text-emerald-400 font-bold">jay@linux-node:~/btc-miner$</span>
              <span className="text-cyan-300">python3 compressed_miner.py</span>
              <span className={`inline-block w-2 h-4 ${isMining ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
            </div>

            {/* Log stream */}
            {terminalLogs.length === 0 ? (
              <div className="text-slate-600 py-6 text-center italic">
                Terminal ready. Click "Start Miner" above to launch the 8-to-4 compression loop.
              </div>
            ) : (
              terminalLogs.map((log) => {
                let colorClass = 'text-slate-300';
                if (log.type === 'success') colorClass = 'text-emerald-400 font-bold bg-emerald-950/40 p-1.5 rounded border border-emerald-500/30';
                else if (log.type === 'warn') colorClass = 'text-amber-400';
                else if (log.type === 'info') colorClass = 'text-cyan-300';
                else if (log.type === 'dim') colorClass = 'text-slate-500';

                return (
                  <div key={log.id} className={`${colorClass} leading-relaxed whitespace-pre-wrap break-all`}>
                    {log.text}
                  </div>
                );
              })
            )}
            <div ref={terminalEndRef} />
          </div>
        )}

        {/* TAB 2: Python Script Viewer */}
        {activeTab === 'script' && (
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 bg-slate-950 p-2.5 rounded-lg border border-slate-800">
              <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-lg border border-slate-800">
                <button
                  onClick={() => setSelectedScriptType('real')}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
                    selectedScriptType === 'real'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Coins className="w-3.5 h-3.5 text-amber-400" />
                  <span>real_btc_miner.py (Stratum Pool)</span>
                </button>
                <button
                  onClick={() => setSelectedScriptType('compressed')}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
                    selectedScriptType === 'compressed'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <FileCode className="w-3.5 h-3.5 text-emerald-400" />
                  <span>compressed_miner.py (Benchmark)</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyScript}
                  className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 flex items-center gap-1.5 transition cursor-pointer border border-slate-700"
                >
                  {copiedScript ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedScript ? 'Copied!' : 'Copy Code'}</span>
                </button>
                <button
                  onClick={handleDownloadScript}
                  className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer shadow"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download {activeScriptFilename}</span>
                </button>
              </div>
            </div>

            <pre className="p-4 bg-slate-950 rounded-lg border border-slate-800 font-mono text-xs text-slate-300 overflow-x-auto leading-relaxed max-h-[420px]">
              {activeScriptCode}
            </pre>
          </div>
        )}

        {/* TAB 3: Linux Deployment & Terminal Instructions */}
        {activeTab === 'linux-guide' && (
          <div className="space-y-4 text-xs">
            {/* Primary: Zero Password / Instant Run (No GitHub Login Needed) */}
            <div className="bg-gradient-to-r from-emerald-950/50 via-slate-950 to-slate-950 p-4 rounded-xl border-2 border-emerald-500/50 shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                    <Play className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-white">1-Command Start (Zero Passwords, No GitHub Login)</h4>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">No Login Needed</span>
                    </div>
                    <p className="text-[11px] text-slate-400">Paste directly into your Linux terminal. Creates and starts mining immediately with NO username or password prompts:</p>
                  </div>
                </div>
                <button
                  onClick={() => handleCopyCommand(DIRECT_NO_PASSWORD_CMD)}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition shadow cursor-pointer"
                >
                  {copiedCmd ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedCmd ? 'Copied!' : 'Copy 1-Start Command'}
                </button>
              </div>

              <div className="bg-slate-900/90 p-3 rounded-lg border border-emerald-500/30 font-mono text-emerald-300 text-xs overflow-x-auto max-h-28 select-all">
                <pre className="whitespace-pre">{DIRECT_NO_PASSWORD_CMD}</pre>
              </div>
              <p className="text-[10px] text-slate-400 mt-2">
                Runs completely locally on your machine. Immediately connects to <code className="text-cyan-300">solo.ckpool.org:3333</code> and starts real Bitcoin block hashing.
              </p>
            </div>

            {/* Option 2: 1-Start Real Bitcoin Stratum Pool Mining via Git */}
            <div className="bg-gradient-to-r from-amber-950/30 via-slate-950 to-slate-950 p-4 rounded-xl border border-amber-500/30 shadow">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400">
                    <Github className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-white">Git Clone 1-Start Command (Requires Public GitHub Repo)</h4>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">GitHub Repo</span>
                    </div>
                    <p className="text-[11px] text-slate-400">If using GitHub, ensure your repo is set to <strong>Public</strong> so Git never asks for a username or password:</p>
                  </div>
                </div>
                <button
                  onClick={() => handleCopyCommand(GITHUB_ONE_START_CMD)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs flex items-center gap-1.5 transition shadow cursor-pointer border border-slate-700"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Git Command</span>
                </button>
              </div>

              <div className="bg-slate-900/90 p-3 rounded-lg border border-amber-500/20 font-mono text-amber-300 text-xs flex items-center justify-between overflow-x-auto select-all">
                <code>{GITHUB_ONE_START_CMD}</code>
              </div>
              <div className="mt-2.5 flex flex-col sm:flex-row items-start sm:items-center justify-between text-[11px] text-slate-400 gap-2">
                <span>Already inside repo folder? Just run: <code className="text-amber-300 bg-slate-900 px-1.5 py-0.5 rounded font-mono select-all">{LOCAL_ONE_START_CMD}</code></span>
              </div>
            </div>

            {/* Option 2: Local 8-to-4 Compression Benchmark */}
            <div className="bg-gradient-to-r from-emerald-950/40 via-slate-950 to-slate-950 p-4 rounded-xl border border-emerald-500/30 shadow">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                    <FileCode className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Mode 2: Local 8-to-4 Compression Benchmark</h4>
                    <p className="text-[11px] text-slate-400">Runs offline search testing the bitwise XOR folding logic:</p>
                  </div>
                </div>
                <button
                  onClick={() => handleCopyCommand(GITHUB_COMPRESSED_CMD)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs flex items-center gap-1.5 transition shadow cursor-pointer border border-slate-700"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Benchmark</span>
                </button>
              </div>

              <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800 font-mono text-emerald-300 text-xs flex items-center justify-between overflow-x-auto select-all">
                <code>{GITHUB_COMPRESSED_CMD}</code>
              </div>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800">
              <h4 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
                <Server className="w-4 h-4 text-emerald-400" />
                Step-by-Step Linux Terminal Execution
              </h4>
              <p className="text-slate-400 leading-relaxed">
                Alternatively, if you prefer running individual commands manually on Ubuntu, Debian, Fedora, Arch, or CentOS:
              </p>
            </div>

            {/* Step 1 */}
            <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800">
              <div className="font-semibold text-slate-200 mb-1 flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-cyan-500/20 text-cyan-400 text-[10px] flex items-center justify-center font-mono">1</span>
                <span>Open Terminal and create directory</span>
              </div>
              <div className="bg-slate-900 p-2 rounded font-mono text-cyan-300 flex items-center justify-between mt-1.5">
                <code>mkdir -p ~/btc-miner && cd ~/btc-miner</code>
                <button
                  onClick={() => handleCopyCommand('mkdir -p ~/btc-miner && cd ~/btc-miner')}
                  className="text-slate-400 hover:text-white"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Step 2 */}
            <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800">
              <div className="font-semibold text-slate-200 mb-1 flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-cyan-500/20 text-cyan-400 text-[10px] flex items-center justify-center font-mono">2</span>
                <span>Create compressed_miner.py file</span>
              </div>
              <div className="bg-slate-900 p-2 rounded font-mono text-cyan-300 flex items-center justify-between mt-1.5">
                <code>nano compressed_miner.py</code>
                <button
                  onClick={() => handleCopyCommand('nano compressed_miner.py')}
                  className="text-slate-400 hover:text-white"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Paste the Python code, then save with <kbd className="bg-slate-800 px-1 rounded text-slate-300">Ctrl+O</kbd>, <kbd className="bg-slate-800 px-1 rounded text-slate-300">Enter</kbd>, and exit with <kbd className="bg-slate-800 px-1 rounded text-slate-300">Ctrl+X</kbd>.
              </div>
            </div>

            {/* Step 3 */}
            <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800">
              <div className="font-semibold text-slate-200 mb-1 flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-cyan-500/20 text-cyan-400 text-[10px] flex items-center justify-center font-mono">3</span>
                <span>Run the Miner</span>
              </div>
              <div className="bg-slate-900 p-2 rounded font-mono text-emerald-400 font-semibold flex items-center justify-between mt-1.5">
                <code>python3 compressed_miner.py</code>
                <button
                  onClick={() => handleCopyCommand('python3 compressed_miner.py')}
                  className="text-slate-400 hover:text-white"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* 24/7 Daemon Systemd Option */}
            <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800">
              <div className="font-semibold text-slate-200 mb-1 flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5 text-indigo-400" />
                <span>Optional: Run 24/7 as a Background Linux Service (systemd)</span>
              </div>
              <p className="text-[11px] text-slate-400 mb-2">
                Keep the miner running non-stop in the background and auto-restart on system reboot:
              </p>
              <pre className="bg-slate-900 p-2.5 rounded font-mono text-[11px] text-slate-300 overflow-x-auto mb-2">
                {SYSTEMD_SERVICE_FILE}
              </pre>
              <div className="bg-slate-900 p-2 rounded font-mono text-xs text-slate-300">
                <code>sudo systemctl enable --now btc-miner.service</code>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Quick Control Bar */}
      <div className="bg-slate-950/90 px-4 py-2.5 border-t border-slate-800 flex items-center justify-between text-xs">
        <div className="text-slate-400 flex items-center gap-2">
          <span>Status:</span>
          <span className={`font-semibold ${isMining ? 'text-emerald-400' : 'text-slate-500'}`}>
            {isMining ? 'Python / JS Worker Active' : 'Stopped'}
          </span>
        </div>

        <button
          onClick={onToggleMining}
          className={`px-3 py-1 rounded font-medium text-xs flex items-center gap-1.5 transition cursor-pointer ${
            isMining
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30'
              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30'
          }`}
        >
          {isMining ? 'Pause Stream' : 'Run Miner in Terminal'}
        </button>
      </div>
    </div>
  );
};
