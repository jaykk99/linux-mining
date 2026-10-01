import React from 'react';
import { Play, Pause, RotateCcw, Cpu, Zap, Clock, Trophy, Hash } from 'lucide-react';
import { MiningStats, MinerConfig } from '../types';
import { HashrateChart, HashSample } from './HashrateChart';
import { RigStatus } from './RigStatus';

interface MiningDashboardProps {
  stats: MiningStats;
  config: MinerConfig;
  pauseOnMatch: boolean;
  hashHistory: HashSample[];
  onToggleMining: () => void;
  onReset: () => void;
  onConfigChange: (newConfig: Partial<MinerConfig>) => void;
  onTogglePauseOnMatch: () => void;
}

export const MiningDashboard: React.FC<MiningDashboardProps> = ({
  stats,
  config,
  pauseOnMatch,
  hashHistory,
  onToggleMining,
  onReset,
  onConfigChange,
  onTogglePauseOnMatch,
}) => {
  const patternValid = /^[0-9a-fA-F]{1,8}$/.test(config.targetPattern);
  const formatHashRate = (rate: number) => {
    if (rate >= 1_000_000) return `${(rate / 1_000_000).toFixed(2)} MH/s`;
    if (rate >= 1_000) return `${(rate / 1_000).toFixed(2)} kH/s`;
    return `${Math.round(rate)} H/s`;
  };

  const formatElapsed = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = (sec % 60).toFixed(1);
    return `${mins > 0 ? `${mins}m ` : ''}${s}s`;
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl text-slate-100">
      {/* Top Banner / Status Indicator */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-5 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div
              className={`w-4 h-4 rounded-full ${
                stats.isMining ? 'bg-emerald-400 animate-ping absolute opacity-75' : 'hidden'
              }`}
            />
            <div
              className={`w-4 h-4 rounded-full ${
                stats.isMining ? 'bg-emerald-400' : 'bg-slate-600'
              }`}
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold tracking-wide text-white">
                Bitcoin 8-to-4 Compression Engine
              </h2>
              <span className="px-2 py-0.5 text-xs font-mono rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Linux Node v2026
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Double-SHA256 (32 bytes / 256-bit) folded to 16 bytes / 128-bit via 8-to-4 XOR compression
            </p>
          </div>
        </div>

        {/* Mining Action Controls */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <button
            id="toggle-mining-btn"
            onClick={onToggleMining}
            disabled={!stats.isMining && !patternValid}
            title={!stats.isMining && !patternValid ? 'Enter a 1-8 character hex target pattern first' : undefined}
            className={`flex-1 md:flex-initial px-5 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 flex items-center justify-center gap-2 shadow-md ${
              !stats.isMining && !patternValid
                ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                : stats.isMining
                  ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold shadow-amber-500/20 cursor-pointer'
                  : 'bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold shadow-emerald-500/20 cursor-pointer'
            }`}
          >
            {stats.isMining ? (
              <>
                <Pause className="w-4 h-4" /> Pause Miner
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" /> Start Miner
              </>
            )}
          </button>

          <button
            id="reset-miner-btn"
            onClick={onReset}
            title="Reset Nonce and Counters"
            className="px-3.5 py-2.5 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 my-5">
        <div className="bg-slate-950/60 border border-slate-800/90 rounded-lg p-3.5">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" /> Hash Rate
            </span>
            <span className="font-mono text-[11px] text-slate-500">Double-SHA256</span>
          </div>
          <div className="text-xl sm:text-2xl font-mono font-bold text-amber-400">
            {formatHashRate(stats.hashRate)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {stats.isMining ? 'Active noncing stream' : 'Idle'}
          </div>
        </div>

        <div className="bg-slate-950/60 border border-slate-800/90 rounded-lg p-3.5">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span className="flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-cyan-400" /> Nonce Count
            </span>
            <span className="font-mono text-[11px] text-slate-500">Iterations</span>
          </div>
          <div className="text-xl sm:text-2xl font-mono font-bold text-cyan-400">
            {stats.nonce.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Tested candidate headers
          </div>
        </div>

        <div className="bg-slate-950/60 border border-slate-800/90 rounded-lg p-3.5">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-indigo-400" /> Mining Time
            </span>
            <span className="font-mono text-[11px] text-slate-500">Elapsed</span>
          </div>
          <div className="text-xl sm:text-2xl font-mono font-bold text-indigo-300">
            {formatElapsed(stats.elapsedSec)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Real wall-clock timer
          </div>
        </div>

        <div className="bg-slate-950/60 border border-slate-800/90 rounded-lg p-3.5">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span className="flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5 text-emerald-400" /> Blocks Found
            </span>
            <span className="font-mono text-[11px] text-slate-500">Target Matches</span>
          </div>
          <div className="text-xl sm:text-2xl font-mono font-bold text-emerald-400">
            {stats.totalMatches}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Prefix matches for <code className="text-emerald-300 font-mono">"{config.targetPattern}"</code>
          </div>
        </div>
      </div>

      {/* Hashrate history (real recorded samples) + rig status */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3.5 my-5">
        <HashrateChart samples={hashHistory} isMining={stats.isMining} />
        <div className="bg-slate-950/60 border border-slate-800/90 rounded-lg p-3.5">
          <div className="text-xs text-slate-400 mb-2">Session Summary</div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            <div>
              <dt className="text-slate-500 text-[11px]">Hashes tested</dt>
              <dd className="font-mono text-cyan-300 font-semibold">{stats.nonce.toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-slate-500 text-[11px]">Matches found</dt>
              <dd className="font-mono text-emerald-300 font-semibold">{stats.totalMatches}</dd>
            </div>
            <div>
              <dt className="text-slate-500 text-[11px]">Elapsed</dt>
              <dd className="font-mono text-indigo-300">{formatElapsed(stats.elapsedSec)}</dd>
            </div>
            <div>
              <dt className="text-slate-500 text-[11px]">Current rate</dt>
              <dd className="font-mono text-amber-300">{formatHashRate(stats.hashRate)}</dd>
            </div>
            <div>
              <dt className="text-slate-500 text-[11px]">Target pattern</dt>
              <dd className="font-mono text-emerald-300">"{config.targetPattern || '—'}"</dd>
            </div>
            <div>
              <dt className="text-slate-500 text-[11px]">Engine</dt>
              <dd className="font-mono text-slate-300">Web Worker · SHA-256 (JS)</dd>
            </div>
          </dl>
          <p className="text-[11px] text-slate-500 mt-3">
            This is the in-browser 8-to-4 folding demo. Real pool mining runs on a
            Linux rig — see rig status below.
          </p>
        </div>
      </div>

      <div className="mb-5">
        <RigStatus />
      </div>

      {/* Configuration & Parameter Adjustments */}
      <div className="bg-slate-950/40 border border-slate-800 rounded-lg p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          <div className="md:col-span-6">
            <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center justify-between">
              <span>Block Header Template</span>
              <span className="text-[10px] text-slate-500 font-mono">Appended with ":nonce"</span>
            </label>
            <input
              id="block-template-input"
              type="text"
              value={config.headerTemplate}
              onChange={(e) => onConfigChange({ headerTemplate: e.target.value })}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-cyan-300 focus:outline-none focus:border-cyan-500 transition"
              placeholder="e.g. BLOCK_DATA_JAY_OMER_LINUX_NODE_2026"
            />
          </div>

          <div className="md:col-span-3">
            <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center justify-between">
              <span>Target Pattern</span>
              <span className="text-[10px] text-slate-500 font-mono">Hex prefix</span>
            </label>
            <div className="relative">
              <input
                id="target-pattern-input"
                type="text"
                value={config.targetPattern}
                maxLength={8}
                onChange={(e) => {
                  const cleaned = e.target.value.replace(/[^0-9a-fA-F]/g, '').toLowerCase();
                  onConfigChange({ targetPattern: cleaned });
                }}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-3 pr-8 py-2 text-sm font-mono font-semibold text-emerald-400 focus:outline-none focus:border-emerald-500 transition"
                placeholder="1122"
              />
              <Hash className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-3" />
            </div>
            {!patternValid && (
              <p className="text-[11px] text-amber-400 mt-1">
                Target must be 1–8 hex characters (0-9, a-f) to start the miner.
              </p>
            )}
          </div>

          <div className="md:col-span-3 flex items-center h-10">
            <label className="flex items-center gap-2.5 cursor-pointer select-none text-xs text-slate-300">
              <input
                id="pause-on-match-checkbox"
                type="checkbox"
                checked={pauseOnMatch}
                onChange={onTogglePauseOnMatch}
                className="rounded border-slate-700 bg-slate-800 text-emerald-500 focus:ring-0 w-4 h-4 cursor-pointer"
              />
              <span>Pause immediately when block match is found</span>
            </label>
          </div>
        </div>

        {/* Quick Presets for Target Pattern */}
        <div className="mt-3 pt-3 border-t border-slate-800/60 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-500 text-[11px]">Quick Targets:</span>
          {['1122', '0000', 'cafe', 'beef', '7777', 'abcd'].map((pattern) => (
            <button
              key={pattern}
              onClick={() => onConfigChange({ targetPattern: pattern })}
              className={`px-2 py-0.5 rounded font-mono text-[11px] border transition cursor-pointer ${
                config.targetPattern === pattern
                  ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 font-semibold'
                  : 'bg-slate-900/90 border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              {pattern}
            </button>
          ))}
          <span className="text-[11px] text-slate-500 ml-auto hidden sm:inline">
            Prob: 1 in {Math.pow(16, config.targetPattern.length || 1).toLocaleString()} hashes
          </span>
        </div>
      </div>

      {/* Live Hash Stream Preview */}
      <div className="bg-slate-950/80 border border-slate-800/90 rounded-lg p-3.5">
        <div className="text-[11px] font-medium text-slate-400 mb-2 flex items-center justify-between">
          <span>Active Mining Stream (Latest Candidate)</span>
          <span className="font-mono text-slate-500">Nonce: #{stats.nonce}</span>
        </div>
        
        <div className="space-y-2 font-mono text-xs">
          <div>
            <div className="text-[10px] text-slate-500 mb-0.5">Double-SHA256 (64 hex characters / 256 bits):</div>
            <div className="bg-slate-900 border border-slate-800/80 rounded px-2.5 py-1.5 text-slate-300 break-all select-all font-mono">
              {stats.currentFullHash || 'Waiting for miner to start...'}
            </div>
          </div>

          <div>
            <div className="text-[10px] text-slate-500 mb-0.5 flex items-center justify-between">
              <span>8-to-4 Folded Hash (32 hex characters / 128 bits):</span>
              {stats.currentCompressedHash && (
                <span className={stats.currentCompressedHash.startsWith(config.targetPattern) ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                  Target prefix: "{config.targetPattern}"
                </span>
              )}
            </div>
            <div className="bg-slate-900 border border-slate-800/80 rounded px-2.5 py-1.5 text-emerald-400 break-all select-all font-mono">
              {stats.currentCompressedHash ? (
                <>
                  <span className="bg-emerald-500/20 text-emerald-300 font-bold px-0.5 rounded">
                    {stats.currentCompressedHash.slice(0, config.targetPattern.length)}
                  </span>
                  <span>{stats.currentCompressedHash.slice(config.targetPattern.length)}</span>
                </>
              ) : (
                <span className="text-slate-500">Waiting for candidate generation...</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
