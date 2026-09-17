import React, { useState, useRef, useEffect } from 'react';
import { Terminal, Download, Copy, Check, Server, FileCode, Play, Trash2, ArrowRight, Github, Coins, Zap, ShieldAlert, Cpu, Sparkles } from 'lucide-react';
import { TerminalLine } from '../types';
import { REAL_BTC_MINER_SCRIPT } from '../realBtcMinerScript';
import { FAST_MINER_PY_SCRIPT, FAST_MINER_C_SCRIPT } from '../fastMinerScripts';
import { STREAM_ENGINE_C_CODE, STREAM_ENGINE_PY_CODE, ALGEBRAIC_SOLVER_C_CODE, ALGEBRAIC_SOLVER_PY_CODE } from '../streamEngineScripts';

interface LinuxTerminalViewProps {
  terminalLogs: TerminalLine[];
  onClearLogs: () => void;
  isMining: boolean;
  onToggleMining: () => void;
}

const FAST_MULTICORE_CMD = `mkdir -p ~/btc-miner && cd ~/btc-miner && cat << 'EOF' > fast_miner.py
import socket, json, hashlib, time, binascii, sys, struct, multiprocessing, os

WALLET = sys.argv[1] if len(sys.argv) > 1 else "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"
HOST, PORT = "solo.ckpool.org", 3333

def d_sha(b): return hashlib.sha256(hashlib.sha256(b).digest()).digest()
def get_target(nb): n = int(nb, 16); return (n & 0xffffff) * (2 ** (8 * ((n >> 24) - 3)))

def worker(cid, cores, jq, sq, cnt):
    cur_id, pfx, pt, nt, en2, nt_hex = None, b"", 0, 0, "", ""
    nonce = cid
    loc = 0
    p = struct.pack
    fb = int.from_bytes
    while True:
        while not jq.empty():
            try:
                j = jq.get_nowait()
                cur_id, pfx, pt, nt, en2, nt_hex = j["id"], j["pfx"], j["pt"], j["nt"], j["en2"], j["nt_hex"]
                nonce = cid
            except: pass
        if not cur_id or not pfx:
            time.sleep(0.02); continue
        bend = nonce + (50000 * cores)
        while nonce < bend:
            hb = d_sha(pfx + p("<I", nonce))
            hint = fb(hb, "big")
            if hint <= pt:
                sq.put({"core": cid, "id": cur_id, "en2": en2, "nt": nt_hex, "nonce": format(nonce, "08x"), "h": binascii.hexlify(hb[::-1]).decode(), "blk": hint <= nt})
            nonce += cores
            loc += 1
        with cnt.get_lock(): cnt.value += loc
        loc = 0

if __name__ == "__main__":
    cores = os.cpu_count() or 4
    print(f"[*] Starting Multi-Core Bitcoin Miner on {cores} CPU Cores for: {WALLET}")
    s = socket.socket(); s.connect((HOST, PORT))
    s.sendall(b'{"id":1,"method":"mining.subscribe","params":["fast/1.0"]}\\n')
    sub = json.loads(s.recv(4096).decode().split("\\n")[0])["result"]
    e1, e2s = sub[1], int(sub[2])
    s.sendall(f'{{"id":2,"method":"mining.authorize","params":["{WALLET}.multicore","x"]}}\\n'.encode())
    print(f"[✓] Connected & Authorized to {HOST}:{PORT}! All {cores} CPU cores active!")
    jqs = [multiprocessing.Queue() for _ in range(cores)]
    sq = multiprocessing.Queue()
    cnt = multiprocessing.Value('q', 0)
    for i in range(cores):
        multiprocessing.Process(target=worker, args=(i, cores, jqs[i], sq, cnt), daemon=True).start()
    pt = int(0x00000000ffff0000000000000000000000000000000000000000000000000000 / 1000)
    s.setblocking(False)
    buf, t0, en2 = "", time.time(), 0
    while True:
        try:
            d = s.recv(4096).decode()
            if d:
                buf += d
                while "\\n" in buf:
                    l, buf = buf.split("\\n", 1)
                    if not l.strip(): continue
                    m = json.loads(l)
                    if m.get("method") == "mining.notify":
                        p_ = m["params"]
                        jid, prev, cb1, cb2, br, v, nb, nt = p_[0], p_[1], p_[2], p_[3], p_[4], p_[5], p_[6], p_[7]
                        en2_hex = format(en2, f"0{e2s*2}x")
                        cb = binascii.unhexlify(cb1 + e1 + en2_hex + cb2)
                        mr = d_sha(cb)
                        for b in br: mr = d_sha(mr + binascii.unhexlify(b))
                        pfx = binascii.unhexlify(v)[::-1] + b"".join(binascii.unhexlify(prev)[i:i+4][::-1] for i in range(0, 32, 4)) + mr + binascii.unhexlify(nt)[::-1] + binascii.unhexlify(nb)[::-1]
                        for q in jqs: q.put({"id": jid, "pfx": pfx, "pt": pt, "nt": get_target(nb), "en2": en2_hex, "nt_hex": nt})
                        en2 += 1
                        print(f"\\n[+] Live Block Template: Job {jid}")
        except BlockingIOError: pass
        except Exception: pass
        while not sq.empty():
            sh = sq.get_nowait()
            if sh["blk"]: print(f"\\n[🚨 JACKPOT! 🚨] SOLVED FULL BITCOIN BLOCK! Hash: {sh['h']}")
            else: print(f"\\n[$$$] VALID SHARE FOUND by Core #{sh['core']}! Nonce: {sh['nonce']}")
            s.sendall(f'{{"id":4,"method":"mining.submit","params":["{WALLET}.multicore","{sh["id"]}","{sh["en2"]}","{sh["nt"]}","{sh["nonce"]}"]}}\\n'.encode())
        el = max(0.001, time.time() - t0)
        with cnt.get_lock(): tot = cnt.value
        sys.stdout.write(f"\\r[-] Hashes: {tot:,} | Speed: {(tot/el)/1000:.1f} kH/s across {cores} cores ")
        sys.stdout.flush()
        time.sleep(0.1)
EOF
python3 fast_miner.py`;

const GITHUB_ONE_START_CMD = `git clone https://github.com/jayomer1234/btc-miner.git && ./btc-miner/start.sh`;
const LOCAL_ONE_START_CMD = `./start.sh`;
const GCC_C_MINER_CMD = `gcc -O3 -march=native -pthread fast_miner.c -o fast_c_miner && ./fast_c_miner`;
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
  const [selectedScriptType, setSelectedScriptType] = useState<'algebraic_c' | 'algebraic_py' | 'stream_c' | 'stream_py' | 'fast_py' | 'fast_c' | 'real' | 'compressed'>('algebraic_c');
  const [copiedScript, setCopiedScript] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeTab === 'console') {
      terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [terminalLogs, activeTab]);

  let activeScriptCode = ALGEBRAIC_SOLVER_C_CODE;
  let activeScriptFilename = 'algebraic_solver.c';
  if (selectedScriptType === 'algebraic_py') {
    activeScriptCode = ALGEBRAIC_SOLVER_PY_CODE;
    activeScriptFilename = 'algebraic_solver.py';
  } else if (selectedScriptType === 'stream_c') {
    activeScriptCode = STREAM_ENGINE_C_CODE;
    activeScriptFilename = 'stream_engine.c';
  } else if (selectedScriptType === 'stream_py') {
    activeScriptCode = STREAM_ENGINE_PY_CODE;
    activeScriptFilename = 'stream_engine.py';
  } else if (selectedScriptType === 'fast_py') {
    activeScriptCode = FAST_MINER_PY_SCRIPT;
    activeScriptFilename = 'fast_miner.py';
  } else if (selectedScriptType === 'fast_c') {
    activeScriptCode = FAST_MINER_C_SCRIPT;
    activeScriptFilename = 'fast_miner.c';
  } else if (selectedScriptType === 'real') {
    activeScriptCode = REAL_BTC_MINER_SCRIPT;
    activeScriptFilename = 'real_btc_miner.py';
  } else if (selectedScriptType === 'compressed') {
    activeScriptCode = PYTHON_SCRIPT_CODE;
    activeScriptFilename = 'compressed_miner.py';
  }

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
    const mimeType = selectedScriptType === 'fast_c' ? 'text/x-csrc;charset=utf-8' : 'text/x-python;charset=utf-8';
    const blob = new Blob([activeScriptCode], { type: mimeType });
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
              <div className="flex flex-wrap items-center gap-1.5 bg-slate-900 p-1 rounded-lg border border-slate-800">
                <button
                  onClick={() => setSelectedScriptType('algebraic_c')}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
                    selectedScriptType === 'algebraic_c'
                      ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  <span>algebraic_solver.c (Homomorphic)</span>
                </button>
                <button
                  onClick={() => setSelectedScriptType('algebraic_py')}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
                    selectedScriptType === 'algebraic_py'
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  <span>algebraic_solver.py (Implicit Stream)</span>
                </button>
                <button
                  onClick={() => setSelectedScriptType('stream_c')}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
                    selectedScriptType === 'stream_c'
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Cpu className="w-3.5 h-3.5 text-purple-400" />
                  <span>stream_engine.c (AVX2 Engine)</span>
                </button>
                <button
                  onClick={() => setSelectedScriptType('stream_py')}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
                    selectedScriptType === 'stream_py'
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <FileCode className="w-3.5 h-3.5 text-cyan-400" />
                  <span>stream_engine.py (Multiprocessing)</span>
                </button>
                <button
                  onClick={() => setSelectedScriptType('fast_py')}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
                    selectedScriptType === 'fast_py'
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                  <span>fast_miner.py (Multi-Core)</span>
                </button>
                <button
                  onClick={() => setSelectedScriptType('fast_c')}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
                    selectedScriptType === 'fast_c'
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Zap className="w-3.5 h-3.5 text-purple-400" />
                  <span>fast_miner.c (Native C Engine)</span>
                </button>
                <button
                  onClick={() => setSelectedScriptType('real')}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
                    selectedScriptType === 'real'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Coins className="w-3.5 h-3.5 text-amber-400" />
                  <span>real_btc_miner.py (Single-Thread)</span>
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
            {/* Algorithmic Reality & Technical Upgrade Notice */}
            <div className="bg-slate-950 p-4 rounded-xl border border-cyan-500/30 shadow-lg">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1 rounded bg-cyan-500/20 text-cyan-400">
                  <Cpu className="w-4 h-4" />
                </div>
                <h4 className="text-sm font-bold text-white">Algorithmic Reality & Optimized Logic</h4>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">Upgraded Engine</span>
              </div>
              <p className="text-slate-300 leading-relaxed text-[11px] mb-3">
                Bitcoin proof-of-work consensus and Stratum pools require the <strong>raw, uncompressed 256-bit double-SHA256</strong> hash to meet the network target. Bitwise XOR "folding" creates a compact 32-char hex string, but cryptographic collision resistance prevents skipping mathematical work. To maximize actual mining performance, the new engine incorporates 3 consensus-valid optimizations:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                  <div className="font-semibold text-cyan-300 mb-1 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    <span>1. Midstate Caching</span>
                  </div>
                  <p className="text-slate-400 text-[10px]">
                    The first 64 bytes of the 80-byte block header are constant for all nonces. We hash it once and cache state <code className="text-slate-300">A-H</code>, eliminating 50% of SHA-256 cycles.
                  </p>
                </div>
                <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                  <div className="font-semibold text-cyan-300 mb-1 flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-emerald-400" />
                    <span>2. Early MSB Filtering</span>
                  </div>
                  <p className="text-slate-400 text-[10px]">
                    99.999% of nonces fail in the highest-order 32-bit word (<code className="text-slate-300">H &gt; target_h</code>). We reject them in 1 CPU cycle before string formatting or second round finalize.
                  </p>
                </div>
                <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                  <div className="font-semibold text-cyan-300 mb-1 flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-purple-400" />
                    <span>3. Multi-Core Concurrency</span>
                  </div>
                  <p className="text-slate-400 text-[10px]">
                    Bypasses Python's GIL by distributing jobs across isolated multiprocessing workers (or POSIX C threads), scaling hashrate linearly with 100% of CPU cores.
                  </p>
                </div>
              </div>
            </div>

            {/* Primary: Fast Multi-Core 1-Command Start (Zero Passwords, No GitHub Login) */}
            <div className="bg-gradient-to-r from-cyan-950/40 via-slate-950 to-slate-950 p-4 rounded-xl border-2 border-cyan-500/50 shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400">
                    <Play className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-white">Recommended: Fast Multi-Core 1-Command Start</h4>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">Multi-Core GIL-Bypass</span>
                    </div>
                    <p className="text-[11px] text-slate-400">Runs all CPU cores in parallel on live Stratum pools. Zero passwords, zero prompts:</p>
                  </div>
                </div>
                <button
                  onClick={() => handleCopyCommand(FAST_MULTICORE_CMD)}
                  className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition shadow cursor-pointer"
                >
                  {copiedCmd ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedCmd ? 'Copied!' : 'Copy Multi-Core Command'}
                </button>
              </div>

              <div className="bg-slate-900/90 p-3 rounded-lg border border-cyan-500/30 font-mono text-cyan-300 text-xs overflow-x-auto max-h-28 select-all">
                <pre className="whitespace-pre">{FAST_MULTICORE_CMD}</pre>
              </div>
              <p className="text-[10px] text-slate-400 mt-2">
                Automatically detects total CPU core count, connects to <code className="text-cyan-300">solo.ckpool.org:3333</code>, streams live block jobs, and verifies valid shares against pool target.
              </p>
            </div>

            {/* Option 2: Native C Engine for Maximum Speed */}
            <div className="bg-gradient-to-r from-purple-950/30 via-slate-950 to-slate-950 p-4 rounded-xl border border-purple-500/30 shadow">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-purple-500/20 text-purple-400">
                    <Zap className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-white">Ultra-Fast Native C Miner (POSIX Threads & -O3)</h4>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40">C Engine</span>
                    </div>
                    <p className="text-[11px] text-slate-400">If you have GCC or Clang installed, compile native C for maximum hash throughput:</p>
                  </div>
                </div>
                <button
                  onClick={() => handleCopyCommand(GCC_C_MINER_CMD)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs flex items-center gap-1.5 transition shadow cursor-pointer border border-slate-700"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy GCC Command</span>
                </button>
              </div>

              <div className="bg-slate-900/90 p-3 rounded-lg border border-purple-500/20 font-mono text-purple-300 text-xs flex items-center justify-between overflow-x-auto select-all">
                <code>{GCC_C_MINER_CMD}</code>
              </div>
            </div>

            {/* Option 3: Git Clone 1-Start Command */}
            <div className="bg-gradient-to-r from-amber-950/30 via-slate-950 to-slate-950 p-4 rounded-xl border border-amber-500/30 shadow">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400">
                    <Github className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-white">Git Clone 1-Start Command (Automated Script)</h4>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">Auto-Detect</span>
                    </div>
                    <p className="text-[11px] text-slate-400">Clones repo and runs <code className="text-amber-300">start.sh</code> which automatically selects C or Multi-Core Python:</p>
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
                <span>Already inside repo folder? Run: <code className="text-amber-300 bg-slate-900 px-1.5 py-0.5 rounded font-mono select-all">{LOCAL_ONE_START_CMD}</code></span>
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
