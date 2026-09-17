import React, { useState } from 'react';
import { Calculator, ArrowRight, Check, Hash, RefreshCw } from 'lucide-react';
import { doubleSha256, compressFullHash, inspectAllChunks } from '../utils/crypto';

export const CustomHashInspector: React.FC = () => {
  const [inputText, setInputText] = useState('BLOCK_DATA_JAY_OMER_LINUX_NODE_2026:30290');
  const [customPattern, setCustomPattern] = useState('1122');

  const computedFullHash = doubleSha256(inputText);
  const computedCompressedHash = compressFullHash(computedFullHash);
  const isPatternMatched = computedCompressedHash.startsWith(customPattern.toLowerCase());

  const handleRandomize = () => {
    const randomNonce = Math.floor(Math.random() * 1000000);
    setInputText(`BLOCK_DATA_JAY_OMER_LINUX_NODE_2026:${randomNonce}`);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl text-slate-100">
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Calculator className="w-5 h-5 text-indigo-400" />
          <div>
            <h3 className="text-base font-semibold text-white">
              Instant 8-to-4 Compression Playground
            </h3>
            <p className="text-xs text-slate-400">
              Test any custom block string or nonce through the double-SHA256 and XOR folding pipeline
            </p>
          </div>
        </div>

        <button
          onClick={handleRandomize}
          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs flex items-center gap-1.5 border border-slate-700 transition cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Random Nonce</span>
        </button>
      </div>

      <div className="mt-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-8">
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Test Input (Block header string with :nonce)
            </label>
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-500"
              placeholder="e.g. BLOCK_DATA_JAY_OMER_LINUX_NODE_2026:30290"
            />
          </div>

          <div className="md:col-span-4">
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Pattern to Test (Hex prefix)
            </label>
            <input
              type="text"
              value={customPattern}
              maxLength={8}
              onChange={(e) => setCustomPattern(e.target.value.replace(/[^0-9a-fA-F]/g, '').toLowerCase())}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-emerald-400 focus:outline-none focus:border-emerald-500"
              placeholder="1122"
            />
          </div>
        </div>

        {/* Results pipeline */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-3.5 space-y-3 font-mono text-xs">
          <div>
            <div className="text-[10px] text-slate-500 mb-0.5">1. Standard Double-SHA256 (64 hex characters):</div>
            <div className="bg-slate-900 px-2.5 py-1.5 rounded text-slate-300 break-all select-all">
              {computedFullHash}
            </div>
          </div>

          <div className="flex items-center justify-center -my-1 text-slate-500">
            <ArrowRight className="w-4 h-4 rotate-90" />
            <span className="text-[10px] font-sans ml-1 text-slate-400">8-to-4 XOR chunk compression</span>
          </div>

          <div>
            <div className="text-[10px] text-slate-500 mb-0.5 flex items-center justify-between">
              <span>2. Resulting 32-character Compressed Hash:</span>
              <span className={`text-[11px] font-bold ${isPatternMatched ? 'text-emerald-400' : 'text-slate-500'}`}>
                {isPatternMatched ? `✓ MATCHES PREFIX "${customPattern}"` : `Does not start with "${customPattern}"`}
              </span>
            </div>
            <div className={`px-2.5 py-1.5 rounded break-all select-all border ${
              isPatternMatched ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300 font-bold' : 'bg-slate-900 border-slate-800 text-emerald-400'
            }`}>
              <span className="underline decoration-emerald-400 font-extrabold">
                {computedCompressedHash.slice(0, customPattern.length)}
              </span>
              <span>{computedCompressedHash.slice(customPattern.length)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
