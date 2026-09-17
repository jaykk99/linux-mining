import React, { useState, useEffect, useRef } from 'react';
import {
  Server,
  Wallet,
  Sparkles,
  Copy,
  Check,
  Play,
  Pause,
  RotateCcw,
  ShieldCheck,
  Cpu,
  Terminal,
  Activity,
  Coins,
  Key,
  Eye,
  EyeOff,
  CheckCircle2,
  ExternalLink,
  Layers,
  ArrowRight,
  Radio
} from 'lucide-react';
import {
  generateBitcoinWallet,
  getSavedWallet,
  saveWallet,
  GeneratedWallet
} from '../utils/bitcoinWallet';
import {
  generatePrivatePoolPython,
  generateSoloWorkerPython
} from '../utils/poolScripts';

interface SimulatedWorker {
  id: string;
  name: string;
  ip: string;
  hashRateKHS: number;
  sharesSubmitted: number;
  lastSeenSec: number;
  status: 'active' | 'submitting' | 'idle';
}

interface StratumLog {
  id: string;
  timestamp: string;
  direction: 'IN' | 'OUT';
  method: string;
  payload: string;
}

export const PrivateSoloPoolView: React.FC = () => {
  // Wallet state
  const [activeWallet, setActiveWallet] = useState<string>(() => getSavedWallet());
  const [customInputWallet, setCustomInputWallet] = useState<string>('');
  const [latestGenerated, setLatestGenerated] = useState<GeneratedWallet | null>(null);
  const [showPrivateKey, setShowPrivateKey] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [poolPort, setPoolPort] = useState<number>(3333);
  const [activeCodeTab, setActiveCodeTab] = useState<'pool_py' | 'one_click_server' | 'worker_py' | 'worker_cmd' | 'protocol'>('pool_py');

  // Pool simulation state
  const [isPoolActive, setIsPoolActive] = useState<boolean>(true);
  const [totalShares, setTotalShares] = useState<number>(14);
  const [blocksFound, setBlocksFound] = useState<number>(0);
  const [simulatedWorkers, setSimulatedWorkers] = useState<SimulatedWorker[]>([
    { id: 'w1', name: 'master_node_01', ip: '127.0.0.1:49812', hashRateKHS: 2450.5, sharesSubmitted: 8, lastSeenSec: 1, status: 'active' },
    { id: 'w2', name: 'laptop_avx2_worker', ip: '192.168.1.104:51220', hashRateKHS: 1820.0, sharesSubmitted: 5, lastSeenSec: 2, status: 'active' },
    { id: 'w3', name: 'termux_phone_rig', ip: '192.168.1.189:44190', hashRateKHS: 420.2, sharesSubmitted: 1, lastSeenSec: 4, status: 'active' },
  ]);

  const [stratumLogs, setStratumLogs] = useState<StratumLog[]>([
    {
      id: 'log-1',
      timestamp: new Date(Date.now() - 12000).toLocaleTimeString(),
      direction: 'IN',
      method: 'mining.subscribe',
      payload: '{"id": 1, "method": "mining.subscribe", "params": ["bfgminer/5.5.0"]}'
    },
    {
      id: 'log-2',
      timestamp: new Date(Date.now() - 11800).toLocaleTimeString(),
      direction: 'OUT',
      method: 'mining.subscribe.result',
      payload: '{"id": 1, "result": [["mining.notify", "priv_session_01"], "08000002", 4], "error": null}'
    },
    {
      id: 'log-3',
      timestamp: new Date(Date.now() - 10500).toLocaleTimeString(),
      direction: 'IN',
      method: 'mining.authorize',
      payload: `{"id": 2, "method": "mining.authorize", "params": ["master_node_01", "x"]}`
    },
    {
      id: 'log-4',
      timestamp: new Date(Date.now() - 10400).toLocaleTimeString(),
      direction: 'OUT',
      method: 'mining.authorize.result',
      payload: `{"id": 2, "result": true, "error": null} -> LOCKED PAYOUT TO: ${activeWallet.slice(0, 10)}...`
    }
  ]);

  // Handle copying
  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  // Generate a brand new Bitcoin wallet
  const handleGenerateWallet = () => {
    const newWallet = generateBitcoinWallet();
    setLatestGenerated(newWallet);
    setActiveWallet(newWallet.address);
    saveWallet(newWallet.address);
    setShowPrivateKey(false);

    // Add log in stratum stream
    setStratumLogs((prev) => [
      {
        id: `${Date.now()}-wallet`,
        timestamp: new Date().toLocaleTimeString(),
        direction: 'OUT',
        method: 'CONFIG.WALLET_RELOAD',
        payload: `[AUTO-CONFIGURED] New P2PKH Wallet generated: ${newWallet.address} | Rewards synchronized!`
      },
      ...prev.slice(0, 15)
    ]);
  };

  // Save custom wallet
  const handleSaveCustomWallet = () => {
    const clean = customInputWallet.trim();
    if (!clean) return;
    setActiveWallet(clean);
    saveWallet(clean);
    setCustomInputWallet('');
    setStratumLogs((prev) => [
      {
        id: `${Date.now()}-custom-wallet`,
        timestamp: new Date().toLocaleTimeString(),
        direction: 'OUT',
        method: 'CONFIG.CUSTOM_WALLET',
        payload: `[AUTO-CONFIGURED] Switched payout address to: ${clean}`
      },
      ...prev.slice(0, 15)
    ]);
  };

  // Pool simulation loop
  useEffect(() => {
    if (!isPoolActive) return;

    const interval = setInterval(() => {
      // Pick random worker to submit share
      const workerIdx = Math.floor(Math.random() * simulatedWorkers.length);
      const worker = simulatedWorkers[workerIdx];
      const randomNonce = '0x' + Math.floor(Math.random() * 0xFFFFFFFF).toString(16).padStart(8, '0');

      setTotalShares((prev) => prev + 1);

      // 1 in 40 chance to simulate finding an actual block
      const isBlock = Math.random() < 0.025;
      if (isBlock) {
        setBlocksFound((b) => b + 1);
      }

      setSimulatedWorkers((prev) =>
        prev.map((w, idx) => {
          if (idx === workerIdx) {
            return {
              ...w,
              sharesSubmitted: w.sharesSubmitted + 1,
              lastSeenSec: 0,
              status: 'submitting',
            };
          }
          return {
            ...w,
            lastSeenSec: w.lastSeenSec + 1,
            status: 'active',
          };
        })
      );

      // Add Stratum log
      const timeStr = new Date().toLocaleTimeString();
      const inLog: StratumLog = {
        id: `${Date.now()}-in`,
        timestamp: timeStr,
        direction: 'IN',
        method: 'mining.submit',
        payload: `{"id": ${Date.now() % 1000}, "method": "mining.submit", "params": ["${worker.name}", "job_${Date.now() % 99}", "00000000", "${Math.floor(Date.now()/1000).toString(16)}", "${randomNonce}"]}`
      };

      const outLog: StratumLog = {
        id: `${Date.now()}-out`,
        timestamp: timeStr,
        direction: 'OUT',
        method: isBlock ? 'BLOCK_ACCEPTED_3.125_BTC' : 'mining.submit.result',
        payload: isBlock
          ? `[🚨 BLOCK FOUND! 🚨] Valid Bitcoin Block! 3.125 BTC + Fees dispatched to ${activeWallet}`
          : `{"id": ${Date.now() % 1000}, "result": true, "error": null} (Share #${totalShares + 1} Accepted)`
      };

      setStratumLogs((prev) => [outLog, inLog, ...prev.slice(0, 20)]);
    }, 3200);

    return () => clearInterval(interval);
  }, [isPoolActive, simulatedWorkers, activeWallet, totalShares]);

  const poolPythonScript = generatePrivatePoolPython(activeWallet);
  const soloWorkerScript = generateSoloWorkerPython('127.0.0.1', poolPort, 'worker_node_01');

  const oneClickServerCommand = `cat << 'EOF' > private_pool.py\n${poolPythonScript}\nEOF\npython3 private_pool.py`;
  const oneClickWorkerCommand = `cat << 'EOF' > solo_worker.py\n${soloWorkerScript}\nEOF\npython3 solo_worker.py`;

  return (
    <div className="space-y-6">
      {/* Top Banner: Master Coordinator & Auto-Configure Status */}
      <div className="bg-gradient-to-r from-amber-950/40 via-slate-900 to-cyan-950/40 border border-amber-500/30 p-5 rounded-2xl relative overflow-hidden">
        <div className="absolute -top-12 -right-12 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                <Radio className="w-3 h-3 animate-pulse text-emerald-400" />
                <span>Stratum v1 Solo Pool Server</span>
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                <span>Auto-Configured Payouts</span>
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
              <span>Private Solo Pool &amp; Cluster Coordinator</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-3xl">
              Acts as your private master server node on port <code className="text-amber-300 font-mono">3333</code>. Distributes custom block templates to your workers and locks 100% of discovered block rewards directly to your wallet.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPoolActive(!isPoolActive)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-2 shadow-lg ${
                isPoolActive
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
            >
              {isPoolActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              <span>{isPoolActive ? 'Simulated Pool: ACTIVE' : 'Resume Simulator'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 1: WALLET GENERATOR & AUTO-CONFIGURATOR */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              <Wallet className="w-4 h-4 text-amber-400" />
              <span>Bitcoin Wallet Generator &amp; Auto-Configurator</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Generate a brand new cryptographically valid Bitcoin wallet anytime with 1 click, or connect your existing address. All scripts auto-configure instantly.
            </p>
          </div>

          <button
            onClick={handleGenerateWallet}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 transition flex items-center gap-2 cursor-pointer shadow-lg shadow-amber-500/20"
          >
            <Sparkles className="w-4 h-4" />
            <span>Generate New Bitcoin Wallet</span>
          </button>
        </div>

        {/* Active Connected Wallet Display */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-8 bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Active Mining Destination Address (Auto-Configured)</span>
              </span>
              <button
                onClick={() => handleCopy(activeWallet, 'active_wallet')}
                className="px-2.5 py-1 rounded text-xs font-mono text-cyan-300 hover:bg-slate-800 transition flex items-center gap-1 cursor-pointer"
              >
                {copiedKey === 'active_wallet' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey === 'active_wallet' ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            <div className="bg-slate-900 p-3 rounded-lg border border-slate-800/80 flex items-center justify-between gap-3 overflow-x-auto">
              <span className="font-mono text-sm sm:text-base font-bold text-amber-300 break-all select-all">
                {activeWallet}
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 whitespace-nowrap">
                {activeWallet.startsWith('1') ? 'Legacy P2PKH' : activeWallet.startsWith('bc1') ? 'SegWit Native' : 'P2SH'}
              </span>
            </div>

            {/* If a wallet was just generated, show private key and SegWit address */}
            {latestGenerated && latestGenerated.address === activeWallet && (
              <div className="pt-2 border-t border-slate-800/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-slate-400 uppercase flex items-center gap-1">
                    <Key className="w-3 h-3 text-rose-400" />
                    <span>Private Key (WIF &amp; Hex)</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowPrivateKey(!showPrivateKey)}
                      className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                    >
                      {showPrivateKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      <span>{showPrivateKey ? 'Hide Secret' : 'Reveal Secret'}</span>
                    </button>
                    {showPrivateKey && (
                      <button
                        onClick={() => handleCopy(latestGenerated.wif, 'wif_key')}
                        className="text-[11px] text-cyan-300 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        {copiedKey === 'wif_key' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>Copy WIF</span>
                      </button>
                    )}
                  </div>
                </div>

                {showPrivateKey ? (
                  <div className="p-2.5 bg-rose-950/20 border border-rose-900/40 rounded-lg text-xs font-mono text-rose-300 space-y-1">
                    <div><strong className="text-slate-400">WIF Format:</strong> {latestGenerated.wif}</div>
                    <div className="text-[10px] text-slate-500 truncate"><strong className="text-slate-400">Hex:</strong> {latestGenerated.privateKeyHex}</div>
                    <div className="text-[10px] text-amber-300/80 pt-1">
                      ⚠️ Store this private key safely offline! You control the full cryptographic ownership of this address.
                    </div>
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-500 font-mono">
                    Private key hidden for security. Click &quot;Reveal Secret&quot; above to inspect or backup.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Custom Address Input */}
          <div className="lg:col-span-4 bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col justify-between space-y-3">
            <div>
              <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block mb-1">
                Connect Existing Wallet Address
              </span>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Paste any valid Bitcoin address to route block rewards to your cold storage or personal wallet.
              </p>
            </div>

            <div className="space-y-2">
              <input
                type="text"
                placeholder="1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa or bc1q..."
                value={customInputWallet}
                onChange={(e) => setCustomInputWallet(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-white focus:outline-none focus:border-amber-500 placeholder-slate-600"
              />
              <button
                onClick={handleSaveCustomWallet}
                disabled={!customInputWallet.trim()}
                className="w-full py-2 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Apply &amp; Auto-Configure</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: LIVE SIMULATED POOL SERVER CLUSTER */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Connected Workers & Cluster Metrics */}
        <div className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Cpu className="w-4 h-4 text-cyan-400" />
              <span>Connected Mining Workers ({simulatedWorkers.length})</span>
            </h3>
            <span className="text-xs font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/60">
              PORT 3333
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="text-[10px] font-mono text-slate-400 uppercase block">Total Cluster Shares</span>
              <span className="text-xl font-bold font-mono text-white">{totalShares}</span>
            </div>
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="text-[10px] font-mono text-slate-400 uppercase block">Blocks Mined</span>
              <span className="text-xl font-bold font-mono text-amber-300">{blocksFound}</span>
            </div>
          </div>

          {/* Worker Node Cards */}
          <div className="space-y-2.5 max-h-[300px] overflow-y-auto">
            {simulatedWorkers.map((w) => (
              <div
                key={w.id}
                className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold font-mono text-white">{w.name}</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-400">{w.ip}</div>
                </div>

                <div className="text-right space-y-0.5">
                  <div className="font-mono text-cyan-300 font-bold">
                    {w.hashRateKHS.toFixed(1)} kH/s
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    {w.sharesSubmitted} shares | {w.lastSeenSec}s ago
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="p-3 bg-cyan-950/20 border border-cyan-900/40 rounded-xl text-xs text-slate-300 space-y-1">
            <strong className="text-cyan-300">Cluster Work Allocation:</strong>
            <p className="text-[11px] text-slate-400">
              The solo pool server assigns distinct <code className="text-cyan-300">extranonce1</code> identifiers to each worker, preventing nonces from overlapping across devices.
            </p>
          </div>
        </div>

        {/* Right: Live Stratum Protocol Traffic Stream */}
        <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              <span>Live Stratum Socket Stream (JSON-RPC)</span>
            </h3>
            <span className="text-[10px] font-mono text-slate-400">
              Auto-scrolling events
            </span>
          </div>

          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 h-[360px] overflow-y-auto font-mono text-xs space-y-2">
            {stratumLogs.map((log) => (
              <div
                key={log.id}
                className={`p-2 rounded-lg border text-[11px] ${
                  log.method.includes('BLOCK')
                    ? 'bg-amber-950/40 border-amber-500 text-amber-200'
                    : log.direction === 'IN'
                    ? 'bg-slate-900/80 border-slate-800 text-cyan-300'
                    : 'bg-slate-900/40 border-slate-800/80 text-emerald-300'
                }`}
              >
                <div className="flex items-center justify-between text-[10px] opacity-70 mb-1">
                  <span className="font-bold">
                    {log.direction === 'IN' ? '⬇ CLIENT REQUEST' : '⬆ SERVER BROADCAST'}
                  </span>
                  <span>{log.timestamp}</span>
                </div>
                <div className="break-all whitespace-pre-wrap">{log.payload}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* SECTION 3: AUTO-CONFIGURED CODE & 1-CLICK TERMINAL COMMANDS */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              <Terminal className="w-4 h-4 text-cyan-400" />
              <span>Auto-Configured Pool &amp; Worker Scripts</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              These scripts are dynamically compiled with your active wallet (<code className="text-amber-300">{activeWallet}</code>).
            </p>
          </div>

          {/* Code Sub-Tabs */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs overflow-x-auto">
            <button
              onClick={() => setActiveCodeTab('pool_py')}
              className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer whitespace-nowrap ${
                activeCodeTab === 'pool_py' ? 'bg-slate-800 text-cyan-300 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              private_pool.py
            </button>
            <button
              onClick={() => setActiveCodeTab('one_click_server')}
              className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer whitespace-nowrap ${
                activeCodeTab === 'one_click_server' ? 'bg-slate-800 text-amber-300 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              1-Click Server Command
            </button>
            <button
              onClick={() => setActiveCodeTab('worker_py')}
              className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer whitespace-nowrap ${
                activeCodeTab === 'worker_py' ? 'bg-slate-800 text-cyan-300 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              solo_worker.py
            </button>
            <button
              onClick={() => setActiveCodeTab('worker_cmd')}
              className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer whitespace-nowrap ${
                activeCodeTab === 'worker_cmd' ? 'bg-slate-800 text-emerald-300 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              1-Click Worker Command
            </button>
            <button
              onClick={() => setActiveCodeTab('protocol')}
              className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer whitespace-nowrap ${
                activeCodeTab === 'protocol' ? 'bg-slate-800 text-purple-300 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Stratum Protocol Specs
            </button>
          </div>
        </div>

        {/* SUBTAB 1: private_pool.py */}
        {activeCodeTab === 'pool_py' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between bg-slate-950 p-3 rounded-xl border border-slate-800">
              <div>
                <span className="text-xs font-bold text-white block">private_pool.py</span>
                <span className="text-[10px] text-slate-400">
                  Self-contained Stratum solo pool server with built-in <code className="text-amber-300">--generate-wallet</code> flag
                </span>
              </div>
              <button
                onClick={() => handleCopy(poolPythonScript, 'copy_pool_py')}
                className="px-3 py-1 rounded-lg text-xs font-medium bg-amber-600/30 text-amber-300 border border-amber-500/40 hover:bg-amber-600/50 transition flex items-center gap-1.5 cursor-pointer"
              >
                {copiedKey === 'copy_pool_py' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>Copy Python Script</span>
              </button>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 max-h-[460px] overflow-y-auto">
              <pre className="font-mono text-xs text-amber-300 whitespace-pre">
                {poolPythonScript}
              </pre>
            </div>
          </div>
        )}

        {/* SUBTAB 2: 1-Click Server Command */}
        {activeCodeTab === 'one_click_server' && (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-amber-950/30 to-slate-950 p-4 rounded-xl border border-amber-500/40 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">
                  Paste &amp; Run directly on your Master Linux / Alpine / Termux Host
                </span>
                <button
                  onClick={() => handleCopy(oneClickServerCommand, 'one_click_server')}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-mono font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 transition flex items-center gap-1.5 cursor-pointer shadow-lg shadow-amber-500/20"
                >
                  {copiedKey === 'one_click_server' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>Copy 1-Click Server Command</span>
                </button>
              </div>

              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-xs text-slate-300 overflow-x-auto space-y-1">
                <div className="text-slate-500"># Writes private_pool.py with configured wallet and launches server on port 3333:</div>
                <div className="text-amber-300 font-bold">cat &lt;&lt; &apos;EOF&apos; &gt; private_pool.py</div>
                <div className="text-slate-400">[... Python Script with Payout Destination: {activeWallet} ...]</div>
                <div className="text-amber-300 font-bold">EOF</div>
                <div className="text-emerald-400 font-bold">python3 private_pool.py</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1">
                <strong className="text-amber-300 font-mono">python3 private_pool.py</strong>
                <p className="text-slate-400 text-[11px]">
                  Runs server with default auto-configured wallet (<code className="text-slate-300">{activeWallet}</code>).
                </p>
              </div>
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1">
                <strong className="text-amber-300 font-mono">python3 private_pool.py --generate-wallet</strong>
                <p className="text-slate-400 text-[11px]">
                  Generates a fresh Bitcoin wallet at launch, saves it to <code className="text-slate-300">wallet.json</code>, and begins solo mining immediately.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* SUBTAB 3: solo_worker.py */}
        {activeCodeTab === 'worker_py' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between bg-slate-950 p-3 rounded-xl border border-slate-800">
              <div>
                <span className="text-xs font-bold text-white block">solo_worker.py</span>
                <span className="text-[10px] text-slate-400">
                  Connects to your master machine at <code className="text-cyan-300">127.0.0.1:3333</code>
                </span>
              </div>
              <button
                onClick={() => handleCopy(soloWorkerScript, 'copy_worker_py')}
                className="px-3 py-1 rounded-lg text-xs font-medium bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-600/50 transition flex items-center gap-1.5 cursor-pointer"
              >
                {copiedKey === 'copy_worker_py' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>Copy Worker Script</span>
              </button>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 max-h-[460px] overflow-y-auto">
              <pre className="font-mono text-xs text-cyan-300 whitespace-pre">
                {soloWorkerScript}
              </pre>
            </div>
          </div>
        )}

        {/* SUBTAB 4: 1-Click Worker Command */}
        {activeCodeTab === 'worker_cmd' && (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-cyan-950/30 to-slate-950 p-4 rounded-xl border border-cyan-500/40 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">
                  Paste &amp; Run on any secondary device (Laptop, Android Termux, Raspberry Pi)
                </span>
                <button
                  onClick={() => handleCopy(oneClickWorkerCommand, 'one_click_worker')}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-mono font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition flex items-center gap-1.5 cursor-pointer shadow-lg shadow-cyan-500/20"
                >
                  {copiedKey === 'one_click_worker' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>Copy 1-Click Worker Command</span>
                </button>
              </div>

              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-xs text-slate-300 overflow-x-auto space-y-1">
                <div className="text-slate-500"># Point POOL_HOST to your master server machine&apos;s LAN IP if running on separate devices:</div>
                <div className="text-cyan-300 font-bold">cat &lt;&lt; &apos;EOF&apos; &gt; solo_worker.py</div>
                <div className="text-slate-400">[... Worker Python Script ...]</div>
                <div className="text-cyan-300 font-bold">EOF</div>
                <div className="text-emerald-400 font-bold">python3 solo_worker.py</div>
              </div>
            </div>
          </div>
        )}

        {/* SUBTAB 5: Stratum Protocol Visualizer */}
        {activeCodeTab === 'protocol' && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
              <span className="text-[10px] font-mono text-cyan-400 uppercase font-bold">Phase 1: Subscribe</span>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                Worker connects via raw TCP socket and calls <code className="text-cyan-300">mining.subscribe</code>. The server replies with session extranonce1 and extranonce2 size.
              </p>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
              <span className="text-[10px] font-mono text-cyan-400 uppercase font-bold">Phase 2: Authorize</span>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                Worker calls <code className="text-cyan-300">mining.authorize(worker_name, password)</code>. Server registers worker in cluster list and binds rewards to <code className="text-amber-300">{activeWallet.slice(0, 8)}...</code>.
              </p>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
              <span className="text-[10px] font-mono text-cyan-400 uppercase font-bold">Phase 3: Notify Job</span>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                Server broadcasts <code className="text-cyan-300">mining.notify</code> packet containing block header fields, previous block hash, difficulty nbits, and coinbase data.
              </p>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
              <span className="text-[10px] font-mono text-cyan-400 uppercase font-bold">Phase 4: Submit Share</span>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                When a worker hashes a nonce matching target criteria, it calls <code className="text-cyan-300">mining.submit</code>. Server validates and updates cluster stats.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
