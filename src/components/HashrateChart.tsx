import React, { useRef, useEffect } from 'react';
import { LineChart, Activity } from 'lucide-react';

export interface HashSample {
  t: number; // epoch ms
  rate: number; // H/s
  nonceAt: number; // nonce when the sample was recorded (for staleness checks)
}

interface HashrateChartProps {
  samples: HashSample[];
  isMining: boolean;
}

function formatRate(rate: number): string {
  if (rate >= 1_000_000) return `${(rate / 1_000_000).toFixed(2)} MH/s`;
  if (rate >= 1_000) return `${(rate / 1_000).toFixed(2)} kH/s`;
  return `${Math.round(rate)} H/s`;
}

/**
 * Hashrate history sparkline. Draws ONLY recorded samples — before the miner
 * runs there is no data, and the empty state says so honestly.
 */
export const HashrateChart: React.FC<HashrateChartProps> = ({ samples, isMining }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w === 0 || h === 0) return;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    // Grid
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
    ctx.lineWidth = 1;
    const rows = 4;
    for (let i = 1; i < rows; i++) {
      const y = (h / rows) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    if (samples.length < 2) return;

    const maxRate = Math.max(...samples.map((s) => s.rate), 1);
    const pad = 6;
    const xStep = (w - pad * 2) / (samples.length - 1);
    const yOf = (rate: number) => h - pad - (rate / maxRate) * (h - pad * 2 - 14);

    // Area fill
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(251, 191, 36, 0.28)');
    grad.addColorStop(1, 'rgba(251, 191, 36, 0.0)');
    ctx.beginPath();
    samples.forEach((s, i) => {
      const x = pad + i * xStep;
      const y = yOf(s.rate);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.lineTo(pad + (samples.length - 1) * xStep, h);
    ctx.lineTo(pad, h);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Line
    ctx.beginPath();
    samples.forEach((s, i) => {
      const x = pad + i * xStep;
      const y = yOf(s.rate);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // Max label
    ctx.fillStyle = 'rgba(148, 163, 184, 0.7)';
    ctx.font = '10px ui-monospace, monospace';
    ctx.fillText(formatRate(maxRate), pad, 12);
  }, [samples]);

  const latest = samples.length > 0 ? samples[samples.length - 1].rate : 0;
  const hasData = samples.length >= 2;

  return (
    <div className="bg-slate-950/60 border border-slate-800/90 rounded-lg p-3.5">
      <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
        <span className="flex items-center gap-1.5">
          <LineChart className="w-3.5 h-3.5 text-amber-400" /> Hashrate History
        </span>
        <span className="font-mono text-[11px] text-slate-500">
          {hasData ? (
            <>
              latest <span className="text-amber-300 font-semibold">{formatRate(latest)}</span>
              {' · '}
              {samples.length} samples
            </>
          ) : (
            'no samples recorded'
          )}
        </span>
      </div>
      <div className="relative h-28">
        <canvas ref={canvasRef} className="w-full h-full" />
        {!hasData && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center gap-1.5 pointer-events-none">
            <Activity className="w-5 h-5 text-slate-600" />
            <p className="text-xs text-slate-500">
              {isMining ? 'Collecting samples…' : 'No data yet — start the miner to record hashrate samples.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
