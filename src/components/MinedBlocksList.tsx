import React from 'react';
import { Trophy, Download, Copy, Check, ExternalLink, Trash2 } from 'lucide-react';
import { MinedBlock } from '../types';

interface MinedBlocksListProps {
  blocks: MinedBlock[];
  onSelectBlockForInspection: (block: MinedBlock) => void;
  onClearBlocks: () => void;
}

export const MinedBlocksList: React.FC<MinedBlocksListProps> = ({
  blocks,
  onSelectBlockForInspection,
  onClearBlocks,
}) => {
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(blocks, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `mined_blocks_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl text-slate-100">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-emerald-400" />
          <div>
            <h3 className="text-base font-semibold text-white">
              Discovered Blocks & Target Matches ({blocks.length})
            </h3>
            <p className="text-xs text-slate-400">
              Candidate headers where the 32-character folded hash matched the target prefix
            </p>
          </div>
        </div>

        {blocks.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportJSON}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs flex items-center gap-1.5 border border-slate-700 transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export JSON</span>
            </button>
            <button
              onClick={onClearBlocks}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition cursor-pointer"
              title="Clear block history"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Block List */}
      <div className="mt-4">
        {blocks.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs">
            <Trophy className="w-8 h-8 text-slate-700 mx-auto mb-2" />
            No blocks mined yet. Start the miner above to discover matching candidates!
          </div>
        ) : (
          <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
            {blocks.map((block) => (
              <div
                key={block.id}
                className="bg-slate-950/80 border border-slate-800/90 hover:border-emerald-500/40 rounded-lg p-3.5 transition-all"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-800/60 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded font-mono text-xs border border-emerald-500/30">
                      Nonce #{block.nonce.toLocaleString()}
                    </span>
                    <span className="text-slate-400 text-[11px]">
                      Match: <code className="text-emerald-400 font-mono font-bold">"{block.targetMatched}"</code>
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono">
                    <span>{block.timeTakenSec.toFixed(2)}s</span>
                    <span>•</span>
                    <span>{block.avgHashRateKHS.toFixed(1)} kH/s</span>
                    <span>•</span>
                    <span className="text-slate-500">{new Date(block.timestamp).toLocaleTimeString()}</span>
                  </div>
                </div>

                {/* Hashes */}
                <div className="space-y-1.5 font-mono text-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 block">64-char Double-SHA256:</span>
                    <div className="text-slate-300 text-[11px] break-all bg-slate-900/90 p-1.5 rounded border border-slate-800/80">
                      {block.fullHash}
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 block">32-char Compressed Hash:</span>
                    <div className="text-emerald-400 text-[11px] break-all bg-slate-900/90 p-1.5 rounded border border-emerald-500/20 font-bold flex items-center justify-between">
                      <div>
                        <span className="bg-emerald-500/30 text-emerald-200 px-1 py-0.5 rounded">
                          {block.compressedHash.slice(0, block.targetMatched.length)}
                        </span>
                        <span>{block.compressedHash.slice(block.targetMatched.length)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-2 mt-3 pt-2 border-t border-slate-800/40 text-xs">
                  <button
                    onClick={() => handleCopy(block.id, JSON.stringify(block, null, 2))}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center gap-1 transition cursor-pointer text-[11px]"
                  >
                    {copiedId === block.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedId === block.id ? 'Copied' : 'Copy'}</span>
                  </button>

                  <button
                    onClick={() => onSelectBlockForInspection(block)}
                    className="px-2.5 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 transition cursor-pointer text-[11px] font-medium"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>Inspect in Folding Matrix</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
