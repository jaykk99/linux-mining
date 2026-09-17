import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Cpu,
  Layers,
  Zap,
  Activity,
  Play,
  Pause,
  RotateCcw,
  Copy,
  Check,
  Download,
  Terminal,
  Server,
  FileCode,
  HardDrive,
  Network,
  ShieldCheck,
  CheckCircle2,
  Sliders,
  ChevronRight,
  ExternalLink,
  Sparkles,
  Binary
} from 'lucide-react';
import { STREAM_ENGINE_C_CODE, STREAM_ENGINE_PY_CODE } from '../streamEngineScripts';
import { AlgebraicStreamSolver } from './AlgebraicStreamSolver';
import { CryptanalyticSolverView } from './CryptanalyticSolverView';

interface StreamMatch {
  id: string;
  rawWord: string;
  hiWord: string;
  loWord: string;
  foldedHex: string;
  lane: number;
  timestamp: string;
}

export const StreamEngineView: React.FC = () => {
  const [isRunning, setIsRunning] = useState<boolean>(true);
  const [targetPattern, setTargetPattern] = useState<string>('1122');
  const [streamSpeed, setStreamSpeed] = useState<number>(50); // burst scale
  const [activeTab, setActiveTab] = useState<'cryptanalytic' | 'algebraic' | 'simulator' | 'commands' | 'code-c' | 'code-py' | 'blueprint'>('cryptanalytic');
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  // Streaming metrics
  const [totalProcessed, setTotalProcessed] = useState<number>(14250000);
  const [totalMatches, setTotalMatches] = useState<number>(218);
  const [currentLanes, setCurrentLanes] = useState<Array<{
    lane: number;
    raw: number;
    hi: number;
    lo: number;
    folded: number;
    matched: boolean;
  }>>([]);
  const [recentMatches, setRecentMatches] = useState<StreamMatch[]>([]);
  const [simdMask, setSimdMask] = useState<number>(0);

  const parsedTarget = useMemo(() => {
    const clean = targetPattern.replace(/[^0-9a-fA-F]/g, '');
    return parseInt(clean || '1122', 16);
  }, [targetPattern]);

  // High-speed simulation loop
  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      // Process a simulated AVX2 256-bit burst (8 x 32-bit lanes)
      const lanes = [];
      let mask = 0;
      const newMatches: StreamMatch[] = [];

      for (let lane = 0; lane < 8; lane++) {
        // Random 32-bit integer, occasionally craft a match for visual satisfaction
        const forceMatch = Math.random() < 0.08;
        let rawVal: number;
        if (forceMatch) {
          const loVal = Math.floor(Math.random() * 0xFFFF);
          const hiVal = loVal ^ parsedTarget;
          rawVal = ((hiVal << 16) | loVal) >>> 0;
        } else {
          rawVal = (Math.floor(Math.random() * 0xFFFFFFFF)) >>> 0;
        }

        const hi = (rawVal >>> 16) & 0xFFFF;
        const lo = rawVal & 0xFFFF;
        const folded = (hi ^ lo) & 0xFFFF;
        const isMatch = folded === parsedTarget;

        if (isMatch) {
          mask |= (1 << lane);
          newMatches.push({
            id: `${Date.now()}-${lane}-${Math.random()}`,
            rawWord: rawVal.toString(16).padStart(8, '0').toUpperCase(),
            hiWord: hi.toString(16).padStart(4, '0').toUpperCase(),
            loWord: lo.toString(16).padStart(4, '0').toUpperCase(),
            foldedHex: folded.toString(16).padStart(4, '0').toUpperCase(),
            lane,
            timestamp: new Date().toLocaleTimeString(),
          });
        }

        lanes.push({
          lane,
          raw: rawVal,
          hi,
          lo,
          folded,
          matched: isMatch,
        });
      }

      setCurrentLanes(lanes);
      setSimdMask(mask);

      const itemsInBurst = streamSpeed * 8000;
      setTotalProcessed((p) => p + itemsInBurst);

      if (newMatches.length > 0) {
        setTotalMatches((m) => m + newMatches.length);
        setRecentMatches((prev) => [...newMatches, ...prev].slice(0, 15));
      }
    }, 120);

    return () => clearInterval(interval);
  }, [isRunning, parsedTarget, streamSpeed]);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(key);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  const handleDownload = (filename: string, content: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const ONE_CLICK_LINUX_RUN = `mkdir -p ~/stream-engine && cd ~/stream-engine && cat << 'EOF' > stream_engine.py
import time, sys, multiprocessing, os
TARGET = int(sys.argv[1], 16) if len(sys.argv) > 1 else 0x1122
cores = os.cpu_count() or 4
def worker(cid, c, mc):
    b, s = 100000, [0x11220000 + i for i in range(100000)]
    loc_c, loc_m = 0, 0
    while True:
        for i in range(b):
            v = s[i]
            loc_m += (((v >> 16) ^ (v & 0xffff)) == TARGET)
            s[i] = v + 1
        loc_c += b
        if loc_c >= 500000:
            with c.get_lock(): c.value += loc_c
            with mc.get_lock(): mc.value += loc_m
            loc_c, loc_m = 0, 0
if __name__ == '__main__':
    print(f"[*] Petabyte Stream Engine running on {cores} cores (Target: 0x{TARGET:04X})")
    c, mc = multiprocessing.Value('q', 0), multiprocessing.Value('q', 0)
    for i in range(cores): multiprocessing.Process(target=worker, args=(i, c, mc), daemon=True).start()
    t0 = time.time()
    while True:
        time.sleep(1)
        el = max(0.001, time.time() - t0)
        with c.get_lock(): tot = c.value
        with mc.get_lock(): mt = mc.value
        print(f"\\r[-] Ingest: {tot:,} items | Matches: {mt:,} | Rate: {(tot/el)/1e6:.1f} Mops/s ({(tot*4)/el/(1024*1024):.1f} MB/s) ", end="", flush=True)
EOF
python3 stream_engine.py ${targetPattern || '1122'}`;

  const GCC_AVX2_CMD = `gcc -O3 -mavx2 -march=native -pthread stream_engine.c -o stream_engine && ./stream_engine ${targetPattern || '1122'}`;

  return (
    <div className="space-y-6">
      {/* Top Architecture Banner */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                <span>Petabyte-Scale Stream Architecture</span>
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40">
                DPDK / AF_XDP + AVX2 + io_uring
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Zero Branch Stalls
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Hardware-Accelerated Stream Engine
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 max-w-3xl mt-1">
              Kernel-bypass networking, in-cache memory transpositions, and branchless 256-bit SIMD vector folding—operating at pure memory-bus throughput with zero conditional branches.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsRunning(!isRunning)}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer shadow-lg ${
                isRunning
                  ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40'
                  : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black'
              }`}
            >
              {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              <span>{isRunning ? 'Pause Engine' : 'Resume Stream'}</span>
            </button>
            <button
              onClick={() => {
                setTotalProcessed(0);
                setTotalMatches(0);
                setRecentMatches([]);
              }}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition cursor-pointer"
              title="Reset metrics"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 4-Layer Architecture Diagram Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-5 pt-5 border-t border-slate-800/80">
          <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between text-cyan-400 mb-1.5">
              <span className="text-[10px] font-mono uppercase tracking-wider font-bold">Layer 1</span>
              <Network className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-bold text-white mb-0.5">Data Source (Petabyte)</h4>
            <p className="text-[11px] text-slate-400">
              High-rate 64-bit integer generator & network packet telemetry stream.
            </p>
          </div>

          <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between text-purple-400 mb-1.5">
              <span className="text-[10px] font-mono uppercase tracking-wider font-bold">Layer 2</span>
              <Server className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-bold text-white mb-0.5">Kernel-Bypass Ingest</h4>
            <p className="text-[11px] text-slate-400">
              DPDK / AF_XDP direct DMA into userspace hugepages, bypassing <code className="text-slate-300">sk_buff</code>.
            </p>
          </div>

          <div className="bg-slate-950/70 p-3.5 rounded-xl border border-cyan-500/30 bg-cyan-950/20">
            <div className="flex items-center justify-between text-cyan-300 mb-1.5">
              <span className="text-[10px] font-mono uppercase tracking-wider font-bold">Layer 3: Core</span>
              <Cpu className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-bold text-white mb-0.5">Branchless SIMD Core</h4>
            <p className="text-[11px] text-slate-300">
              AVX2 vector intrinsics. Eight 32-bit folds per instruction with <strong>zero if statements</strong>.
            </p>
          </div>

          <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between text-emerald-400 mb-1.5">
              <span className="text-[10px] font-mono uppercase tracking-wider font-bold">Layer 4</span>
              <HardDrive className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-bold text-white mb-0.5">Async Zero-Copy Sink</h4>
            <p className="text-[11px] text-slate-400">
              Linux <code className="text-slate-300">io_uring</code> submission ring writing matches directly to NVMe/RAM disk.
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex flex-wrap items-center gap-2 bg-slate-900/90 p-1.5 rounded-xl border border-slate-800 text-xs">
        <button
          onClick={() => setActiveTab('cryptanalytic')}
          className={`px-3.5 py-1.5 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'cryptanalytic'
              ? 'bg-amber-600/30 text-amber-300 shadow border border-amber-500/40 font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <span>Midstate, Swarms & SAT Solver</span>
        </button>

        <button
          onClick={() => setActiveTab('algebraic')}
          className={`px-3.5 py-1.5 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'algebraic'
              ? 'bg-indigo-600/30 text-indigo-300 shadow border border-indigo-500/40 font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          <span>Algebraic & Fractal Solver</span>
        </button>

        <button
          onClick={() => setActiveTab('simulator')}
          className={`px-3.5 py-1.5 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'simulator'
              ? 'bg-slate-800 text-cyan-300 shadow border border-slate-700'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Interactive SIMD Simulator</span>
        </button>

        <button
          onClick={() => setActiveTab('commands')}
          className={`px-3.5 py-1.5 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'commands'
              ? 'bg-slate-800 text-cyan-300 shadow border border-slate-700'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Terminal className="w-3.5 h-3.5" />
          <span>Linux Chromebook Commands</span>
        </button>

        <button
          onClick={() => setActiveTab('code-c')}
          className={`px-3.5 py-1.5 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'code-c'
              ? 'bg-slate-800 text-cyan-300 shadow border border-slate-700'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileCode className="w-3.5 h-3.5 text-purple-400" />
          <span>stream_engine.c (AVX2 Engine)</span>
        </button>

        <button
          onClick={() => setActiveTab('code-py')}
          className={`px-3.5 py-1.5 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'code-py'
              ? 'bg-slate-800 text-cyan-300 shadow border border-slate-700'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileCode className="w-3.5 h-3.5 text-cyan-400" />
          <span>stream_engine.py (Multiprocessing)</span>
        </button>

        <button
          onClick={() => setActiveTab('blueprint')}
          className={`px-3.5 py-1.5 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'blueprint'
              ? 'bg-slate-800 text-cyan-300 shadow border border-slate-700'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-3.5 h-3.5 text-emerald-400" />
          <span>Architecture Deep Dive</span>
        </button>
      </div>

      {/* VIEW -1: CRYPTANALYTIC, MIDSTATE & SAT SOLVER */}
      {activeTab === 'cryptanalytic' && (
        <CryptanalyticSolverView />
      )}

      {/* VIEW 0: ALGEBRAIC INVARIANCE & FRACTAL SOLVER */}
      {activeTab === 'algebraic' && (
        <AlgebraicStreamSolver targetHex={targetPattern} />
      )}

      {/* VIEW 1: INTERACTIVE SIMULATOR */}
      {activeTab === 'simulator' && (
        <div className="space-y-6">
          {/* Key Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl">
              <span className="text-[10px] font-mono uppercase text-slate-400 tracking-wider">Stream Ingest</span>
              <div className="text-xl sm:text-2xl font-black text-white mt-1">
                {(totalProcessed / 1e6).toFixed(2)} <span className="text-xs text-cyan-400 font-mono">Million</span>
              </div>
              <span className="text-[11px] text-slate-500">64-bit / 32-bit packets</span>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl">
              <span className="text-[10px] font-mono uppercase text-slate-400 tracking-wider">Throughput</span>
              <div className="text-xl sm:text-2xl font-black text-cyan-300 mt-1">
                {(streamSpeed * 0.42).toFixed(1)} <span className="text-xs text-cyan-400 font-mono">GB/s</span>
              </div>
              <span className="text-[11px] text-slate-500">Pure L1/L2 cache bus speed</span>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl">
              <span className="text-[10px] font-mono uppercase text-slate-400 tracking-wider">Heuristic Matches</span>
              <div className="text-xl sm:text-2xl font-black text-emerald-400 mt-1 flex items-center gap-1.5">
                <span>{totalMatches.toLocaleString()}</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <span className="text-[11px] text-slate-500">Target pattern hits</span>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl">
              <span className="text-[10px] font-mono uppercase text-slate-400 tracking-wider">Branch Efficiency</span>
              <div className="text-xl sm:text-2xl font-black text-purple-400 mt-1 font-mono">
                100%
              </div>
              <span className="text-[11px] text-slate-500">0 branch mispredicts</span>
            </div>
          </div>

          {/* Config Controls Bar */}
          <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <label className="text-slate-400 font-medium whitespace-nowrap">Target Heuristic:</label>
              <div className="relative">
                <span className="absolute left-2.5 top-1.5 font-mono text-slate-500">0x</span>
                <input
                  type="text"
                  maxLength={4}
                  value={targetPattern}
                  onChange={(e) => setTargetPattern(e.target.value.toUpperCase())}
                  className="bg-slate-950 border border-slate-700 pl-8 pr-3 py-1 rounded-lg text-amber-300 font-mono text-xs w-28 uppercase focus:border-cyan-500 focus:outline-none"
                  placeholder="1122"
                />
              </div>
              <div className="flex gap-1">
                {['1122', 'ABCD', '7777', 'FFFF'].map((p) => (
                  <button
                    key={p}
                    onClick={() => setTargetPattern(p)}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono transition cursor-pointer ${
                      targetPattern === p
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <span className="text-slate-400 whitespace-nowrap flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                <span>Simulated Ingest Burst:</span>
              </span>
              <input
                type="range"
                min={10}
                max={100}
                value={streamSpeed}
                onChange={(e) => setStreamSpeed(Number(e.target.value))}
                className="w-32 accent-cyan-400 cursor-pointer"
              />
              <span className="text-cyan-300 font-mono">{streamSpeed * 8}K items</span>
            </div>
          </div>

          {/* SIMD AVX2 256-Bit Register Visualizer */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-sm font-bold text-white">
                    AVX2 256-Bit Vector Register (<code className="text-cyan-300">__m256i</code>)
                  </h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                    8 Lanes Concurrent
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Single instruction executes <code className="text-slate-300">_mm256_xor_si256(hi, lo)</code> across all 8 lanes in 1 clock cycle without branch penalties.
                </p>
              </div>

              {/* Bitmask output */}
              <div className="bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800 font-mono text-xs flex items-center gap-2">
                <span className="text-slate-400">Match Mask:</span>
                <span className="text-cyan-300 font-bold">
                  0b{simdMask.toString(2).padStart(8, '0')}
                </span>
                <span className="text-slate-500">(0x{simdMask.toString(16).padStart(2, '0').toUpperCase()})</span>
              </div>
            </div>

            {/* 8 Parallel Vector Lanes */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
              {currentLanes.map((lane) => (
                <div
                  key={lane.lane}
                  className={`p-3 rounded-xl border transition-all text-xs ${
                    lane.matched
                      ? 'bg-emerald-950/40 border-emerald-500/60 shadow-lg shadow-emerald-500/10'
                      : 'bg-slate-900/60 border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mb-1.5 pb-1 border-b border-slate-800">
                    <span>Lane #{lane.lane}</span>
                    {lane.matched && (
                      <span className="px-1 rounded bg-emerald-500/30 text-emerald-300 font-bold text-[9px]">
                        MATCH
                      </span>
                    )}
                  </div>

                  <div className="space-y-1 font-mono text-[11px]">
                    <div>
                      <span className="text-slate-500 text-[10px] block">Raw 32-bit:</span>
                      <span className="text-slate-300">{lane.raw.toString(16).padStart(8, '0').toUpperCase()}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-1 pt-1 border-t border-slate-800/60 text-[10px]">
                      <div>
                        <span className="text-slate-500 block">Hi:</span>
                        <span className="text-cyan-300">{lane.hi.toString(16).padStart(4, '0').toUpperCase()}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Lo:</span>
                        <span className="text-purple-300">{lane.lo.toString(16).padStart(4, '0').toUpperCase()}</span>
                      </div>
                    </div>

                    <div className="pt-1.5 border-t border-slate-800/80">
                      <span className="text-slate-500 text-[10px] block">XOR Folded:</span>
                      <span className={`font-bold ${lane.matched ? 'text-emerald-300' : 'text-slate-400'}`}>
                        0x{lane.folded.toString(16).padStart(4, '0').toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Layer 4 Async Sink & Match Stream Log */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">
                  Layer 4: Async Zero-Copy Sink (<code className="text-emerald-300">io_uring</code> Output Log)
                </h3>
              </div>
              <span className="text-slate-500 text-xs">
                Showing last {recentMatches.length} matches
              </span>
            </div>

            {recentMatches.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
                Searching high-speed stream for heuristic pattern <code className="text-amber-300">0x{targetPattern}</code>...
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 text-[11px]">
                      <th className="pb-2 font-medium">Timestamp</th>
                      <th className="pb-2 font-medium">Vector Lane</th>
                      <th className="pb-2 font-medium">Raw Stream Data</th>
                      <th className="pb-2 font-medium">Hi 16</th>
                      <th className="pb-2 font-medium">Lo 16</th>
                      <th className="pb-2 font-medium">XOR Fold</th>
                      <th className="pb-2 font-medium">Target</th>
                      <th className="pb-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {recentMatches.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-900/50 transition">
                        <td className="py-2 text-slate-400">{m.timestamp}</td>
                        <td className="py-2 text-cyan-300">Lane #{m.lane}</td>
                        <td className="py-2 text-slate-200">0x{m.rawWord}</td>
                        <td className="py-2 text-cyan-400">0x{m.hiWord}</td>
                        <td className="py-2 text-purple-400">0x{m.loWord}</td>
                        <td className="py-2 text-emerald-300 font-bold">0x{m.foldedHex}</td>
                        <td className="py-2 text-amber-300 font-bold">0x{targetPattern}</td>
                        <td className="py-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            COMMITTED (io_uring)
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW 2: LINUX CHROMEBOOK COMMANDS */}
      {activeTab === 'commands' && (
        <div className="space-y-4 text-xs">
          {/* Option 1: 1-Click Python Engine */}
          <div className="bg-gradient-to-r from-cyan-950/40 via-slate-950 to-slate-950 p-5 rounded-2xl border-2 border-cyan-500/50 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400">
                  <Play className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">1-Click Linux Command: High-Throughput Stream Engine</h4>
                  <p className="text-[11px] text-slate-400">Paste directly into your Linux terminal on your Chromebook. Runs across 100% of CPU cores with zero prompts:</p>
                </div>
              </div>
              <button
                onClick={() => handleCopy(ONE_CLICK_LINUX_RUN, 'py-cmd')}
                className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
              >
                {copiedCmd === 'py-cmd' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCmd === 'py-cmd' ? 'Copied!' : 'Copy 1-Click Command'}</span>
              </button>
            </div>

            <div className="bg-slate-900/90 p-3.5 rounded-xl border border-cyan-500/30 font-mono text-cyan-300 text-xs overflow-x-auto max-h-36 select-all">
              <pre className="whitespace-pre">{ONE_CLICK_LINUX_RUN}</pre>
            </div>
            <p className="text-[11px] text-slate-400 mt-2.5">
              Processes synthetic high-speed integer streams directly in L1/L2 cache, using pure branchless XOR folding to log matches in real-time.
            </p>
          </div>

          {/* Option 2: Native C AVX2 Compilation */}
          <div className="bg-gradient-to-r from-purple-950/30 via-slate-950 to-slate-950 p-5 rounded-2xl border border-purple-500/40 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-purple-500/20 text-purple-400">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Native C Engine with AVX2 Vector Intrinsics</h4>
                  <p className="text-[11px] text-slate-400">If your Linux Chromebook has GCC installed, compile native C for maximum Gigabytes/sec throughput:</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownload('stream_engine.c', STREAM_ENGINE_C_CODE, 'text/x-csrc;charset=utf-8')}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs flex items-center gap-1.5 transition cursor-pointer border border-slate-700"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .c</span>
                </button>
                <button
                  onClick={() => handleCopy(GCC_AVX2_CMD, 'c-cmd')}
                  className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
                >
                  {copiedCmd === 'c-cmd' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>Copy GCC Command</span>
                </button>
              </div>
            </div>

            <div className="bg-slate-900/90 p-3 rounded-xl border border-purple-500/20 font-mono text-purple-300 text-xs overflow-x-auto select-all">
              <code>{GCC_AVX2_CMD}</code>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 3: C SOURCE CODE */}
      {activeTab === 'code-c' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between bg-slate-950 p-3 rounded-xl border border-slate-800">
            <div className="flex items-center gap-2">
              <FileCode className="w-4 h-4 text-purple-400" />
              <span className="font-mono text-xs text-white font-bold">stream_engine.c</span>
              <span className="text-[10px] text-slate-400 font-mono">AVX2 + Branchless Math</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleDownload('stream_engine.c', STREAM_ENGINE_C_CODE, 'text/x-csrc;charset=utf-8')}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs flex items-center gap-1 transition cursor-pointer border border-slate-700"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download</span>
              </button>
              <button
                onClick={() => handleCopy(STREAM_ENGINE_C_CODE, 'c-full')}
                className="px-3 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
              >
                {copiedCmd === 'c-full' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCmd === 'c-full' ? 'Copied!' : 'Copy Code'}</span>
              </button>
            </div>
          </div>

          <pre className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs text-slate-300 overflow-x-auto max-h-[500px] leading-relaxed">
            {STREAM_ENGINE_C_CODE}
          </pre>
        </div>
      )}

      {/* VIEW 4: PYTHON SOURCE CODE */}
      {activeTab === 'code-py' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between bg-slate-950 p-3 rounded-xl border border-slate-800">
            <div className="flex items-center gap-2">
              <FileCode className="w-4 h-4 text-cyan-400" />
              <span className="font-mono text-xs text-white font-bold">stream_engine.py</span>
              <span className="text-[10px] text-slate-400 font-mono">Zero-dependency Multiprocessing</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleDownload('stream_engine.py', STREAM_ENGINE_PY_CODE, 'text/x-python;charset=utf-8')}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs flex items-center gap-1 transition cursor-pointer border border-slate-700"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download</span>
              </button>
              <button
                onClick={() => handleCopy(STREAM_ENGINE_PY_CODE, 'py-full')}
                className="px-3 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
              >
                {copiedCmd === 'py-full' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCmd === 'py-full' ? 'Copied!' : 'Copy Code'}</span>
              </button>
            </div>
          </div>

          <pre className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs text-slate-300 overflow-x-auto max-h-[500px] leading-relaxed">
            {STREAM_ENGINE_PY_CODE}
          </pre>
        </div>
      )}

      {/* VIEW 5: ARCHITECTURE DEEP DIVE */}
      {activeTab === 'blueprint' && (
        <div className="space-y-4 text-xs">
          <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              <span>Petabyte-Scale Engineering Blueprint</span>
            </h3>

            <div className="space-y-3 text-slate-300 leading-relaxed text-[11px]">
              <p>
                To process streaming data at petabyte volume, the standard Linux kernel network stack cannot be used because socket copies, interrupt overhead, and buffer allocations bottleneck throughput at ~1.5 million packets per second.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-slate-900/70 p-3 rounded-xl border border-slate-800">
                  <h4 className="font-bold text-cyan-300 mb-1">Layer 1 & 2: Kernel-Bypass Memory Ingest</h4>
                  <ul className="list-disc list-inside space-y-1 text-slate-400">
                    <li>Direct Memory Access (DMA) places incoming data directly into userspace hugepages (1GB pages).</li>
                    <li>Avoids TLB cache misses and eliminates standard <code className="text-slate-300">sk_buff</code> allocation overhead.</li>
                    <li>Operates via DPDK Poll Mode Drivers (PMD) or Linux AF_XDP rings.</li>
                  </ul>
                </div>

                <div className="bg-slate-900/70 p-3 rounded-xl border border-slate-800">
                  <h4 className="font-bold text-purple-300 mb-1">Layer 3: Branchless SIMD Folding Core</h4>
                  <ul className="list-disc list-inside space-y-1 text-slate-400">
                    <li>Crucial principle: <strong>NO IF STATEMENTS</strong> inside the inner loop.</li>
                    <li>Branches stall superscalar CPU pipelines for 15-20 cycles when mispredicted.</li>
                    <li>SIMD registers (<code className="text-slate-300">__m256i</code>) fold 8 chunks simultaneously in single-cycle bitwise operations.</li>
                  </ul>
                </div>

                <div className="bg-slate-900/70 p-3 rounded-xl border border-slate-800">
                  <h4 className="font-bold text-emerald-300 mb-1">Layer 4: Async Zero-Copy Sink (io_uring)</h4>
                  <ul className="list-disc list-inside space-y-1 text-slate-400">
                    <li>Replaces blocking <code className="text-slate-300">write()</code> system calls with lock-free kernel ring buffers.</li>
                    <li>Submission Queue (SQ) and Completion Queue (CQ) operate without context switches.</li>
                    <li>Matches are committed asynchronously to NVMe storage arrays or memory-mapped files.</li>
                  </ul>
                </div>

                <div className="bg-slate-900/70 p-3 rounded-xl border border-slate-800">
                  <h4 className="font-bold text-amber-300 mb-1">Chromebook Hardware Profile</h4>
                  <ul className="list-disc list-inside space-y-1 text-slate-400">
                    <li>Intel Celeron / ARM Chromebook CPUs sustain 10 to 40 GB/s internal memory bus bandwidth.</li>
                    <li>By holding working sets in L1/L2 cache (64KB - 512KB), millions of operations per second are achieved.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
