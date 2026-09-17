import React, { useState, useMemo } from 'react';
import { Layers, ArrowDown, Binary, Info, Sparkles, CheckCircle2 } from 'lucide-react';
import { inspectAllChunks } from '../utils/crypto';

interface FoldingVisualizerProps {
  currentFullHash: string;
  currentCompressedHash: string;
  targetPattern: string;
  latestMatchedBlock?: {
    fullHash: string;
    compressedHash: string;
    nonce: number;
  } | null;
}

const CHUNK_COLORS = [
  { border: 'border-cyan-500/40', bg: 'bg-cyan-500/10', text: 'text-cyan-400', badge: 'bg-cyan-500/20' },
  { border: 'border-indigo-500/40', bg: 'bg-indigo-500/10', text: 'text-indigo-400', badge: 'bg-indigo-500/20' },
  { border: 'border-emerald-500/40', bg: 'bg-emerald-500/10', text: 'text-emerald-400', badge: 'bg-emerald-500/20' },
  { border: 'border-amber-500/40', bg: 'bg-amber-500/10', text: 'text-amber-400', badge: 'bg-amber-500/20' },
  { border: 'border-purple-500/40', bg: 'bg-purple-500/10', text: 'text-purple-400', badge: 'bg-purple-500/20' },
  { border: 'border-rose-500/40', bg: 'bg-rose-500/10', text: 'text-rose-400', badge: 'bg-rose-500/20' },
  { border: 'border-teal-500/40', bg: 'bg-teal-500/10', text: 'text-teal-400', badge: 'bg-teal-500/20' },
  { border: 'border-blue-500/40', bg: 'bg-blue-500/10', text: 'text-blue-400', badge: 'bg-blue-500/20' },
];

export const FoldingVisualizer: React.FC<FoldingVisualizerProps> = ({
  currentFullHash,
  currentCompressedHash,
  targetPattern,
  latestMatchedBlock,
}) => {
  const [selectedChunkIndex, setSelectedChunkIndex] = useState<number>(0);
  const [activeHashSource, setActiveHashSource] = useState<'live' | 'match'>('live');

  const displayHash = useMemo(() => {
    if (activeHashSource === 'match' && latestMatchedBlock) {
      return latestMatchedBlock.fullHash;
    }
    return currentFullHash || 'e87bf9591424cc0ba112b41d75cf3cc4903d671d300e029b4243f3cad8ea1926';
  }, [activeHashSource, latestMatchedBlock, currentFullHash]);

  const chunks = useMemo(() => {
    return inspectAllChunks(displayHash);
  }, [displayHash]);

  const activeChunk = chunks[selectedChunkIndex] || chunks[0];
  const color = CHUNK_COLORS[selectedChunkIndex % CHUNK_COLORS.length];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl text-slate-100">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-cyan-400" />
            <h3 className="text-base font-semibold text-white">
              8-to-4 Lossy Compression & Folding Inspector
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Mathematical breakdown of 32-bit (8 hex) to 16-bit (4 hex) bitwise XOR folding
          </p>
        </div>

        {/* Source Switcher (Live vs Last Match) */}
        {latestMatchedBlock && (
          <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={() => setActiveHashSource('live')}
              className={`px-2.5 py-1 rounded cursor-pointer transition ${
                activeHashSource === 'live'
                  ? 'bg-slate-800 text-white font-medium'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Live Candidate
            </button>
            <button
              onClick={() => setActiveHashSource('match')}
              className={`px-2.5 py-1 rounded cursor-pointer transition flex items-center gap-1.5 ${
                activeHashSource === 'match'
                  ? 'bg-emerald-500/20 text-emerald-300 font-medium border border-emerald-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Mined Block #{latestMatchedBlock.nonce}
            </button>
          </div>
        )}
      </div>

      {/* 8 Chunks Selector Matrix */}
      <div className="my-5">
        <div className="text-xs text-slate-400 mb-2 flex items-center justify-between">
          <span className="font-mono text-[11px] text-slate-400">
            Select a Chunk to Inspect (Total 8 chunks × 8 chars = 64 characters)
          </span>
          <span className="text-[11px] text-slate-500">
            Click any block below
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          {chunks.map((chk, idx) => {
            const chkColor = CHUNK_COLORS[idx % CHUNK_COLORS.length];
            const isSelected = idx === selectedChunkIndex;
            const isTargetChunk = idx === 0; // Chunk 0 holds the start pattern

            return (
              <button
                key={idx}
                onClick={() => setSelectedChunkIndex(idx)}
                className={`text-left p-2.5 rounded-lg border transition-all cursor-pointer relative ${
                  isSelected
                    ? `${chkColor.bg} ${chkColor.border} ring-1 ring-white/20 shadow-lg scale-[1.02]`
                    : 'bg-slate-950/70 border-slate-800/90 hover:border-slate-700'
                }`}
              >
                {isTargetChunk && (
                  <span className="absolute -top-1.5 -right-1.5 bg-emerald-500 text-slate-950 text-[9px] font-bold px-1 rounded-full uppercase">
                    Target
                  </span>
                )}
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-mono font-medium text-slate-400">
                    Chunk {idx}
                  </span>
                  <span className={`text-[10px] font-mono px-1 rounded ${chkColor.badge} ${chkColor.text}`}>
                    {chk.foldedHex}
                  </span>
                </div>
                <div className="font-mono text-[11px] text-slate-300 tracking-wider truncate">
                  {chk.chunk8}
                </div>
                <div className="text-[9px] text-slate-500 mt-1 flex items-center gap-1 font-mono">
                  <span>{chk.part1Hex}</span>
                  <span>^</span>
                  <span>{chk.part2Hex}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Deep-Dive Inspection of the Selected Chunk */}
      <div className={`p-4 rounded-xl border ${color.bg} ${color.border} mb-5`}>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
          <div>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${color.badge} ${color.text}`}>
                CHUNK #{activeChunk.index}
              </span>
              <span className="text-sm font-semibold text-white">
                Detailed Bitwise XOR Folding Operation
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Characters [{activeChunk.index * 8}..{activeChunk.index * 8 + 7}] of double-SHA256
            </p>
          </div>

          <div className="text-right">
            <span className="text-xs text-slate-400 block">Folded 4-char Result</span>
            <span className={`font-mono text-xl font-bold ${color.text}`}>
              0x{activeChunk.foldedHex}
            </span>
          </div>
        </div>

        {/* 3-Row Bitwise XOR Grid */}
        <div className="my-4 space-y-2.5 font-mono text-xs">
          {/* Part 1 */}
          <div className="bg-slate-950/80 border border-slate-800/90 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <span className="text-slate-400 font-sans text-xs w-28">
                Part 1 (First 4 chars):
              </span>
              <span className="text-cyan-300 font-bold text-sm bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                {activeChunk.part1Hex}
              </span>
              <span className="text-slate-500 text-[11px]">
                ({activeChunk.part1Int.toLocaleString()})
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 text-[10px] hidden sm:inline">16-bit binary:</span>
              <span className="text-cyan-400 tracking-widest text-[11px] bg-slate-900/90 px-2 py-1 rounded">
                {activeChunk.part1Bin.slice(0, 4)} {activeChunk.part1Bin.slice(4, 8)} {activeChunk.part1Bin.slice(8, 12)} {activeChunk.part1Bin.slice(12, 16)}
              </span>
            </div>
          </div>

          {/* Operator Indicator */}
          <div className="flex items-center justify-center -my-1 text-slate-400">
            <div className="bg-slate-800 px-3 py-0.5 rounded-full text-[11px] font-bold text-amber-400 flex items-center gap-1 border border-slate-700">
              <Binary className="w-3 h-3" /> Bitwise XOR (^)
            </div>
          </div>

          {/* Part 2 */}
          <div className="bg-slate-950/80 border border-slate-800/90 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <span className="text-slate-400 font-sans text-xs w-28">
                Part 2 (Last 4 chars):
              </span>
              <span className="text-indigo-300 font-bold text-sm bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                {activeChunk.part2Hex}
              </span>
              <span className="text-slate-500 text-[11px]">
                ({activeChunk.part2Int.toLocaleString()})
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 text-[10px] hidden sm:inline">16-bit binary:</span>
              <span className="text-indigo-400 tracking-widest text-[11px] bg-slate-900/90 px-2 py-1 rounded">
                {activeChunk.part2Bin.slice(0, 4)} {activeChunk.part2Bin.slice(4, 8)} {activeChunk.part2Bin.slice(8, 12)} {activeChunk.part2Bin.slice(12, 16)}
              </span>
            </div>
          </div>

          {/* Result */}
          <div className="bg-slate-950 border border-emerald-500/40 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-inner">
            <div className="flex items-center gap-3">
              <span className="text-emerald-400 font-sans text-xs font-semibold w-28">
                = Folded Result:
              </span>
              <span className="text-emerald-300 font-bold text-base bg-emerald-950/60 px-2.5 py-0.5 rounded border border-emerald-500/50">
                {activeChunk.foldedHex}
              </span>
              <span className="text-slate-500 text-[11px]">
                ({activeChunk.foldedInt.toLocaleString()})
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-emerald-500 text-[10px] hidden sm:inline font-sans">Folded binary:</span>
              <span className="text-emerald-300 tracking-widest text-[11px] bg-slate-900 px-2 py-1 rounded font-bold border border-emerald-500/30">
                {activeChunk.foldedBin.slice(0, 4)} {activeChunk.foldedBin.slice(4, 8)} {activeChunk.foldedBin.slice(8, 12)} {activeChunk.foldedBin.slice(12, 16)}
              </span>
            </div>
          </div>
        </div>

        {/* Python mapping explanation */}
        <div className="bg-slate-950/70 border border-slate-800 rounded p-2.5 text-[11px] font-mono text-slate-400 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div>
            <span className="text-slate-500">Python: </span>
            <code className="text-slate-300">
              part1 = int('{activeChunk.chunk8}'.slice(0,4), 16) ^ part2 = int('{activeChunk.chunk8}'.slice(4,8), 16)
            </code>
          </div>
          <span className="text-emerald-400">
            format(folded, '04x') == "{activeChunk.foldedHex}"
          </span>
        </div>
      </div>

      {/* Mathematical Entropy & Space Reduction Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-3.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 mb-2">
            <Info className="w-3.5 h-3.5 text-cyan-400" />
            <span>Mathematical Chunk Space Reduction</span>
          </div>
          <div className="space-y-2 text-xs text-slate-400 leading-relaxed">
            <div className="flex justify-between border-b border-slate-800/80 pb-1">
              <span>Original 8-char chunk:</span>
              <span className="font-mono text-cyan-300">32 bits (4,294,967,296 states)</span>
            </div>
            <div className="flex justify-between border-b border-slate-800/80 pb-1">
              <span>Folded 4-char chunk:</span>
              <span className="font-mono text-emerald-300">16 bits (65,536 states)</span>
            </div>
            <div className="flex justify-between text-slate-300 pt-0.5 font-medium">
              <span>Compression ratio:</span>
              <span className="font-mono text-amber-400 font-bold">65,536 : 1</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-3.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 mb-2">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>Why Mining Target Hits Faster on Linux</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            By mapping millions of cryptographic states into a 16-bit bucket per chunk, each target prefix match (such as{' '}
            <code className="text-emerald-300 font-mono">"{targetPattern}"</code>) occurs at a statistical frequency of{' '}
            <span className="text-white font-mono font-semibold">
              1 in {Math.pow(16, targetPattern.length || 1).toLocaleString()}
            </span>{' '}
            attempts, compared to astronomical standard Bitcoin difficulty.
          </p>
        </div>
      </div>
    </div>
  );
};
