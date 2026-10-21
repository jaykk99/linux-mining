import React, { useMemo, useState } from 'react';
import { CheckCircle2, CircleAlert, Copy, Download, RotateCcw, Save, SlidersHorizontal } from 'lucide-react';
import {
  defaultRigConfig,
  exportRigConfigJson,
  loadRigConfig,
  patternOdds,
  saveRigConfig,
  validateRigConfig,
  type FieldError,
  type RigConfig,
} from '../utils/validation';

/**
 * Rig Config — edit the miner's runtime config in the dashboard.
 * Every field validates live against the same schema as preflight.py --config,
 * the config persists to localStorage, and the JSON export drops straight into
 * `python3 preflight.py --config <file>` for a pre-flight check on the rig.
 */

function fieldMsg(errors: FieldError[], field: keyof RigConfig): string | null {
  const e = errors.find((x) => x.field === field);
  return e ? e.message : null;
}

function inputCls(invalid: boolean): string {
  return `w-full bg-slate-950 border rounded-lg px-3 py-2 text-sm font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 ${
    invalid
      ? 'border-red-500/60 focus:ring-red-500/40'
      : 'border-slate-700 focus:ring-cyan-500/40 focus:border-cyan-500/60'
  }`;
}

export const RigConfigPanel: React.FC = () => {
  const [draft, setDraft] = useState<RigConfig>(() => loadRigConfig());
  const [savedTick, setSavedTick] = useState(0);
  const [copied, setCopied] = useState(false);

  const { config: valid, errors } = useMemo(
    () => validateRigConfig(draft),
    [draft],
  );
  const ok = errors.length === 0;

  const set = <K extends keyof RigConfig>(k: K, v: RigConfig[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const onSave = () => {
    if (!ok) return;
    saveRigConfig(valid);
    setDraft(valid); // keep the normalized form (lowercased pattern etc.)
    setSavedTick((t) => t + 1);
  };

  const onReset = () => setDraft(defaultRigConfig());

  const onDownload = () => {
    const blob = new Blob([exportRigConfigJson(ok ? valid : draft)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'miner-config.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(exportRigConfigJson(ok ? valid : draft));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  const poolErr = fieldMsg(errors, 'pool');
  const walletErr = fieldMsg(errors, 'wallet');
  const patternErr = fieldMsg(errors, 'pattern');
  const threadsErr = fieldMsg(errors, 'threads');
  const engineErr = fieldMsg(errors, 'engine');

  return (
    <div className="space-y-4">
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-1">
          <SlidersHorizontal className="w-4 h-4 text-cyan-400" />
          <h2 className="text-sm font-semibold text-slate-100">Rig Config</h2>
          {savedTick > 0 && (
            <span className="text-[10px] font-mono text-emerald-400/80">saved ✓</span>
          )}
        </div>
        <p className="text-xs text-slate-500 mb-4">
          Validated live against the same schema as{' '}
          <span className="font-mono text-slate-400">preflight.py --config</span>.
          Nothing here starts mining — it only edits the config.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Pool <span className="text-slate-600 font-mono">host:port</span>
            </label>
            <input
              className={inputCls(!!poolErr)}
              value={draft.pool}
              onChange={(e) => set('pool', e.target.value)}
              placeholder="solo.ckpool.org:3333"
              spellCheck={false}
            />
            {poolErr && <p className="text-[11px] text-red-400 mt-1">{poolErr}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Wallet <span className="text-slate-600">(payout address)</span>
            </label>
            <input
              className={inputCls(!!walletErr)}
              value={draft.wallet}
              onChange={(e) => set('wallet', e.target.value)}
              placeholder="1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"
              spellCheck={false}
            />
            {walletErr && <p className="text-[11px] text-red-400 mt-1">{walletErr}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Target pattern <span className="text-slate-600 font-mono">1–8 hex chars</span>
            </label>
            <input
              className={inputCls(!!patternErr)}
              value={draft.pattern}
              onChange={(e) => set('pattern', e.target.value)}
              placeholder="1122"
              spellCheck={false}
            />
            {patternErr ? (
              <p className="text-[11px] text-red-400 mt-1">{patternErr}</p>
            ) : (
              <p className="text-[11px] text-slate-500 mt-1">{patternOdds(draft.pattern)}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Threads
            </label>
            <input
              type="number"
              min={1}
              className={inputCls(!!threadsErr)}
              value={draft.threads}
              onChange={(e) => set('threads', Number(e.target.value))}
            />
            {threadsErr && <p className="text-[11px] text-red-400 mt-1">{threadsErr}</p>}
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-slate-400 mb-1">Engine</label>
            <div className="flex gap-2">
              {(['auto', 'python', 'c'] as const).map((eng) => (
                <button
                  key={eng}
                  onClick={() => set('engine', eng)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-mono border transition cursor-pointer ${
                    draft.engine === eng
                      ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-300'
                      : 'bg-slate-950 border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {eng}
                </button>
              ))}
            </div>
            {engineErr && <p className="text-[11px] text-red-400 mt-1">{engineErr}</p>}
            <p className="text-[11px] text-slate-600 mt-1">
              auto = C miner when a compiler is available, else Python.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-5">
          <button
            onClick={onSave}
            disabled={!ok}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition ${
              ok
                ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30 cursor-pointer'
                : 'bg-slate-800 border border-slate-700 text-slate-500 cursor-not-allowed'
            }`}
          >
            <Save className="w-3.5 h-3.5" />
            Save config
          </button>
          <button
            onClick={onDownload}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Export JSON
          </button>
          <button
            onClick={onCopy}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5" />
            {copied ? 'Copied!' : 'Copy JSON'}
          </button>
          <button
            onClick={onReset}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium text-slate-500 hover:text-slate-300 transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>
        </div>

        <div
          className={`flex items-start gap-2 mt-4 text-xs rounded-lg px-3 py-2 border ${
            ok
              ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-300/90'
              : 'bg-red-500/5 border-red-500/20 text-red-300/90'
          }`}
        >
          {ok ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          ) : (
            <CircleAlert className="w-4 h-4 shrink-0 mt-0.5" />
          )}
          <span>
            {ok ? (
              <>
                Config is valid. Export it and run{' '}
                <span className="font-mono">python3 preflight.py --config miner-config.json</span>{' '}
                on the rig before mining.
              </>
            ) : (
              <>{errors.length} field{errors.length === 1 ? '' : 's'} need{errors.length === 1 ? 's' : ''} fixing before this config can be saved.</>
            )}
          </span>
        </div>
      </div>

      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
        <h3 className="text-xs font-semibold text-slate-300 mb-2">Config preview</h3>
        <pre className="text-[11px] font-mono text-slate-400 bg-slate-950 rounded-lg p-3 overflow-x-auto">
          {exportRigConfigJson(ok ? valid : draft)}
        </pre>
      </div>
    </div>
  );
};
