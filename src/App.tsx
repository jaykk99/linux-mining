import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Terminal, 
  Cpu, 
  Layers, 
  Trophy, 
  Calculator, 
  Volume2, 
  VolumeX, 
  Activity, 
  ShieldCheck,
  Code
} from 'lucide-react';
import { MiningStats, MinerConfig, MinedBlock, TerminalLine } from './types';
import { MiningDashboard } from './components/MiningDashboard';
import { FoldingVisualizer } from './components/FoldingVisualizer';
import { LinuxTerminalView } from './components/LinuxTerminalView';
import { MinedBlocksList } from './components/MinedBlocksList';
import { CustomHashInspector } from './components/CustomHashInspector';
import { StreamEngineView } from './components/StreamEngineView';

export default function App() {
  const [activeView, setActiveView] = useState<'miner' | 'terminal' | 'stream' | 'blocks' | 'math'>('stream');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [pauseOnMatch, setPauseOnMatch] = useState(false);

  const [config, setConfig] = useState<MinerConfig>({
    headerTemplate: 'BLOCK_DATA_JAY_OMER_LINUX_NODE_2026',
    targetPattern: '1122',
    batchSize: 1000,
    threads: 1,
  });

  const [stats, setStats] = useState<MiningStats>({
    nonce: 0,
    hashRate: 0,
    elapsedSec: 0,
    currentFullHash: '',
    currentCompressedHash: '',
    totalMatches: 0,
    isMining: false,
  });

  const [minedBlocks, setMinedBlocks] = useState<MinedBlock[]>([]);
  const [selectedBlockForInspection, setSelectedBlockForInspection] = useState<MinedBlock | null>(null);
  const [terminalLogs, setTerminalLogs] = useState<TerminalLine[]>([
    {
      id: 'init-1',
      text: '[*] Linux BTC Miner with 8-to-4 Chunk Folding Compression initialized.',
      type: 'info',
      timestamp: new Date().toLocaleTimeString(),
    },
    {
      id: 'init-2',
      text: '[*] Node template: BLOCK_DATA_JAY_OMER_LINUX_NODE_2026',
      type: 'dim',
      timestamp: new Date().toLocaleTimeString(),
    },
    {
      id: 'init-3',
      text: '[*] Target Compressed Pattern: 1122',
      type: 'dim',
      timestamp: new Date().toLocaleTimeString(),
    }
  ]);

  const workerRef = useRef<Worker | null>(null);

  const playSuccessChime = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.18); // A5
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch {
      // Audio context policy safe ignore
    }
  }, [soundEnabled]);

  const addTerminalLog = useCallback((text: string, type: TerminalLine['type'] = 'info') => {
    setTerminalLogs((prev) => [
      ...prev.slice(-150),
      {
        id: `${Date.now()}-${Math.random()}`,
        text,
        type,
        timestamp: new Date().toLocaleTimeString(),
      }
    ]);
  }, []);

  // Initialize Worker
  useEffect(() => {
    try {
      const worker = new Worker(new URL('./workers/miner.worker.ts', import.meta.url), {
        type: 'module',
      });

      worker.onmessage = (event) => {
        const { type, payload, isMining } = event.data;

        if (type === 'STATUS_CHANGED') {
          setStats((s) => ({ ...s, isMining: !!isMining }));
        } else if (type === 'PROGRESS') {
          setStats((prev) => ({
            ...prev,
            nonce: payload.nonce,
            hashRate: payload.hashRate,
            elapsedSec: payload.elapsedSec,
            currentFullHash: payload.currentFullHash || prev.currentFullHash,
            currentCompressedHash: payload.currentCompressedHash || prev.currentCompressedHash,
          }));

          // Periodic terminal log mirroring Python script output
          if (payload.nonce > 0 && payload.nonce % 25000 < 1000) {
            const khs = (payload.hashRate / 1000).toFixed(1);
            addTerminalLog(
              `[-] Nonce: ${payload.nonce.toLocaleString()} | Speed: ${khs} kH/s | Latest Compressed: ${payload.currentCompressedHash.slice(0, 8)}...`,
              'dim'
            );
          }
        } else if (type === 'MATCH_FOUND') {
          playSuccessChime();
          const newBlock: MinedBlock = {
            id: `${payload.nonce}-${Date.now()}`,
            nonce: payload.nonce,
            fullHash: payload.fullHash,
            compressedHash: payload.compressedHash,
            targetMatched: payload.targetMatched,
            timestamp: payload.timestamp,
            timeTakenSec: payload.elapsedSec,
            avgHashRateKHS: payload.avgHashRateKHS,
            blockData: payload.blockData,
          };

          setMinedBlocks((prev) => [newBlock, ...prev]);
          setSelectedBlockForInspection(newBlock);
          setStats((prev) => ({ ...prev, totalMatches: prev.totalMatches + 1 }));

          // Add exact Python-style success logs
          addTerminalLog(
            `\n[+] SUCCESS! Match Found!\n    Nonce:           ${payload.nonce}\n    Full Hash (64c): ${payload.fullHash}\n    Compressed (32c):${payload.compressedHash}\n    Target Match:    ${payload.compressedHash.slice(0, payload.targetMatched.length)}\n    Time Taken:      ${payload.elapsedSec.toFixed(2)} seconds`,
            'success'
          );
        }
      };

      workerRef.current = worker;

      return () => {
        worker.terminate();
      };
    } catch (err) {
      console.error('Failed to initialize miner worker', err);
      addTerminalLog('[!] Notice: Web Worker failed to load, please check browser settings.', 'warn');
    }
  }, [addTerminalLog, playSuccessChime]);

  const toggleMining = () => {
    if (!workerRef.current) return;

    if (stats.isMining) {
      workerRef.current.postMessage({ type: 'PAUSE' });
      addTerminalLog('[*] Mining paused by user.', 'warn');
    } else {
      addTerminalLog(`[*] Starting 8-to-4 Compression Linux Miner...`, 'info');
      addTerminalLog(`[*] Target Compressed Pattern: ${config.targetPattern}`, 'info');
      addTerminalLog(`[*] Block Template: ${config.headerTemplate}`, 'dim');
      workerRef.current.postMessage({
        type: 'START',
        payload: {
          headerTemplate: config.headerTemplate,
          targetPattern: config.targetPattern,
          nonce: stats.nonce,
          pauseOnMatch,
        },
      });
    }
  };

  const resetMiner = () => {
    if (!workerRef.current) return;
    workerRef.current.postMessage({ type: 'RESET' });
    addTerminalLog('[*] Miner state and nonce counter reset to 0.', 'warn');
  };

  const handleConfigChange = (newConfig: Partial<MinerConfig>) => {
    setConfig((prev) => {
      const updated = { ...prev, ...newConfig };
      if (workerRef.current) {
        workerRef.current.postMessage({
          type: 'UPDATE_CONFIG',
          payload: {
            headerTemplate: updated.headerTemplate,
            targetPattern: updated.targetPattern,
            pauseOnMatch,
          },
        });
      }
      return updated;
    });
  };

  const handleTogglePauseOnMatch = () => {
    setPauseOnMatch((prev) => {
      const next = !prev;
      if (workerRef.current) {
        workerRef.current.postMessage({
          type: 'UPDATE_CONFIG',
          payload: { pauseOnMatch: next },
        });
      }
      return next;
    });
  };

  const handleInspectBlock = (block: MinedBlock) => {
    setSelectedBlockForInspection(block);
    setActiveView('miner');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Top Application Header */}
      <header className="border-b border-slate-800/90 bg-slate-950/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500/20 to-cyan-500/20 border border-amber-500/30 text-amber-400">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Linux BTC 8-to-4 Compressed Miner
                </h1>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full">
                  Lossy Folding Engine
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                32-bit chunk folding (8 hex → 4 hex XOR) for rapid pattern match discovery on Linux
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1.5 bg-slate-900/90 p-1 rounded-xl border border-slate-800 text-xs w-full sm:w-auto overflow-x-auto">
            <button
              onClick={() => setActiveView('stream')}
              className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                activeView === 'stream'
                  ? 'bg-slate-800 text-cyan-300 shadow-sm border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Cpu className="w-3.5 h-3.5 text-cyan-400" />
              <span>Petabyte Stream Engine</span>
              <span className="bg-cyan-500/20 text-cyan-300 text-[9px] font-mono px-1 rounded border border-cyan-500/30">
                DPDK / AVX2
              </span>
            </button>

            <button
              onClick={() => setActiveView('miner')}
              className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                activeView === 'miner'
                  ? 'bg-slate-800 text-cyan-300 shadow-sm border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Miner & Folding</span>
            </button>

            <button
              onClick={() => setActiveView('terminal')}
              className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                activeView === 'terminal'
                  ? 'bg-slate-800 text-cyan-300 shadow-sm border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Linux Terminal</span>
            </button>

            <button
              onClick={() => setActiveView('blocks')}
              className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap relative ${
                activeView === 'blocks'
                  ? 'bg-slate-800 text-cyan-300 shadow-sm border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Trophy className="w-3.5 h-3.5" />
              <span>Mined Blocks</span>
              {minedBlocks.length > 0 && (
                <span className="bg-emerald-500 text-slate-950 font-bold text-[10px] px-1.5 py-0.2 rounded-full">
                  {minedBlocks.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveView('math')}
              className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                activeView === 'math'
                  ? 'bg-slate-800 text-cyan-300 shadow-sm border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Calculator className="w-3.5 h-3.5" />
              <span>Playground</span>
            </button>

            {/* Sound toggle */}
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? 'Mute audio chimes' : 'Enable audio chimes'}
              className="p-1.5 ml-1 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition cursor-pointer"
            >
              {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-emerald-400" /> : <VolumeX className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* VIEW 0: Petabyte Stream Engine (DPDK / AF_XDP + SIMD AVX2 Core) */}
        {activeView === 'stream' && (
          <StreamEngineView />
        )}

        {/* VIEW 1: Miner Dashboard & Folding Inspector */}
        {activeView === 'miner' && (
          <>
            <MiningDashboard
              stats={stats}
              config={config}
              pauseOnMatch={pauseOnMatch}
              onToggleMining={toggleMining}
              onReset={resetMiner}
              onConfigChange={handleConfigChange}
              onTogglePauseOnMatch={handleTogglePauseOnMatch}
            />

            <FoldingVisualizer
              currentFullHash={stats.currentFullHash}
              currentCompressedHash={stats.currentCompressedHash}
              targetPattern={config.targetPattern}
              latestMatchedBlock={selectedBlockForInspection || minedBlocks[0] || null}
            />
          </>
        )}

        {/* VIEW 2: Linux Terminal Console & Python script execution */}
        {activeView === 'terminal' && (
          <LinuxTerminalView
            terminalLogs={terminalLogs}
            onClearLogs={() => setTerminalLogs([])}
            isMining={stats.isMining}
            onToggleMining={toggleMining}
          />
        )}

        {/* VIEW 3: Discovered Mined Blocks List */}
        {activeView === 'blocks' && (
          <MinedBlocksList
            blocks={minedBlocks}
            onSelectBlockForInspection={handleInspectBlock}
            onClearBlocks={() => setMinedBlocks([])}
          />
        )}

        {/* VIEW 4: Algorithm & Math Playground */}
        {activeView === 'math' && (
          <>
            <CustomHashInspector />
            <FoldingVisualizer
              currentFullHash={stats.currentFullHash}
              currentCompressedHash={stats.currentCompressedHash}
              targetPattern={config.targetPattern}
              latestMatchedBlock={selectedBlockForInspection || minedBlocks[0] || null}
            />
          </>
        )}

        {/* System & Architecture Info Footer */}
        <div className="pt-4 border-t border-slate-800/80 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-3 font-mono">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>8-to-4 Hex Folding Algorithm: `part1(16b) ^ part2(16b) = folded(16b)`</span>
          </div>
          <div className="flex items-center gap-2">
            <Code className="w-3.5 h-3.5 text-cyan-400" />
            <span>Linux script saved at: <code className="text-slate-400 font-semibold">compressed_miner.py</code></span>
          </div>
        </div>
      </main>
    </div>
  );
}
