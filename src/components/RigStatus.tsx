import React from 'react';
import { Server, MonitorSmartphone, Globe, CircleAlert, TerminalSquare } from 'lucide-react';

interface EnvFact {
  label: string;
  value: string;
}

/**
 * Rig status panel. Honest about what it knows:
 * - "This session" facts are real, browser-detectable values for the in-browser demo miner.
 * - The Linux rig card always reports "not connected" — this dashboard has no
 *   link to a real rig; it never fakes rig telemetry.
 */
export const RigStatus: React.FC = () => {
  const facts: EnvFact[] = [];
  if (typeof navigator !== 'undefined') {
    facts.push({
      label: 'CPU threads available',
      value: String(navigator.hardwareConcurrency ?? 'unknown'),
    });
    const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory;
    facts.push({
      label: 'Device memory',
      value: mem ? `~${mem} GB` : 'not exposed by browser',
    });
    facts.push({ label: 'Platform', value: navigator.platform || 'unknown' });
    facts.push({
      label: 'Web Workers',
      value: typeof Worker !== 'undefined' ? 'supported' : 'NOT supported',
    });
    facts.push({
      label: 'GPU (WebGL renderer)',
      value: (() => {
        try {
          const c = document.createElement('canvas');
          const gl = c.getContext('webgl');
          if (!gl) return 'no WebGL context';
          const dbg = gl.getExtension('WEBGL_debug_renderer_info');
          if (!dbg) return 'present, details hidden';
          return String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)).slice(0, 48);
        } catch {
          return 'unavailable';
        }
      })(),
    });
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
      {/* This browser session — real, detectable facts */}
      <div className="bg-slate-950/60 border border-slate-800/90 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <MonitorSmartphone className="w-4 h-4 text-cyan-400" />
            This Session
          </h3>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border bg-cyan-500/10 text-cyan-300 border-cyan-500/30">
            in-browser demo miner
          </span>
        </div>
        <dl className="space-y-1.5 text-xs">
          {facts.map((f) => (
            <div key={f.label} className="flex items-center justify-between gap-3">
              <dt className="text-slate-500">{f.label}</dt>
              <dd className="font-mono text-slate-300 text-right truncate">{f.value}</dd>
            </div>
          ))}
        </dl>
        <p className="text-[11px] text-slate-500 mt-3 flex items-start gap-1.5">
          <Globe className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          The Start button above runs the 8-to-4 folding demo in a Web Worker on this
          device — it does not mine real Bitcoin or touch a pool.
        </p>
      </div>

      {/* Linux rig — honestly not connected */}
      <div className="bg-slate-950/60 border border-slate-800/90 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Server className="w-4 h-4 text-amber-400" />
            Linux Mining Rig
          </h3>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border bg-slate-500/10 text-slate-400 border-slate-600/50 flex items-center gap-1">
            <CircleAlert className="w-3 h-3" /> not connected
          </span>
        </div>
        <p className="text-xs text-slate-400 mb-2">
          This dashboard has no link to a real rig, so there is no rig telemetry to show.
          To bring a rig online:
        </p>
        <ol className="text-[11px] font-mono text-slate-400 space-y-1.5 bg-slate-900/70 border border-slate-800 rounded p-2.5">
          <li><span className="text-slate-600">1.</span> git clone https://github.com/jaykk99/linux-mining.git</li>
          <li><span className="text-slate-600">2.</span> python3 preflight.py --wallet &lt;your-btc-address&gt;</li>
          <li><span className="text-slate-600">3.</span> ./start.sh &lt;wallet&gt; &lt;pool-host:port&gt;</li>
        </ol>
        <p className="text-[11px] text-slate-500 mt-2.5 flex items-start gap-1.5">
          <TerminalSquare className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          Rig status, pool connection and real hashrate only exist on the machine
          running the scripts — see the Linux Terminal tab for the exact commands.
        </p>
      </div>
    </div>
  );
};
