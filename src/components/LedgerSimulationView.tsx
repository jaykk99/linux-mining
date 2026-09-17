import React, { useState, useEffect, useRef } from 'react';
import {
  Database,
  Play,
  RotateCcw,
  Box,
  TrendingDown,
  ShieldAlert,
  Crown,
  Activity,
  Terminal,
  FileCode,
  Copy,
  Check,
  Zap
} from 'lucide-react';

interface LedgerLog {
  id: string;
  timestamp: string;
  message: string;
  type: 'info' | 'block' | 'cap' | 'sweep';
}

export const LedgerSimulationView: React.FC = () => {
  const INITIAL_SUPPLY = 1000000;
  const MIN_CAP = 100000;

  const [supply, setSupply] = useState<number>(INITIAL_SUPPLY);
  const [userTreasury, setUserTreasury] = useState<number>(0);
  const [blockHeight, setBlockHeight] = useState<number>(1);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isComplete, setIsComplete] = useState<boolean>(false);
  const [logs, setLogs] = useState<LedgerLog[]>([]);
  const [copiedScript, setCopiedScript] = useState<boolean>(false);

  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const addLog = (message: string, type: LedgerLog['type']) => {
    setLogs(prev => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: new Date().toLocaleTimeString(),
        message,
        type
      }
    ]);
  };

  const handleReset = () => {
    setIsRunning(false);
    setIsComplete(false);
    setSupply(INITIAL_SUPPLY);
    setUserTreasury(0);
    setBlockHeight(1);
    setLogs([]);
    addLog('[*] Initializing custom ledger simulation...', 'info');
  };

  // Initialize on mount
  useEffect(() => {
    addLog('[*] Initializing custom ledger simulation...', 'info');
  }, []);

  // Simulation Loop
  useEffect(() => {
    if (!isRunning || isComplete) return;

    const interval = setInterval(() => {
      setSupply((prevSupply) => {
        const decrement = Math.floor(Math.random() * 4000) + 1000; // 1000 to 5000
        
        if (prevSupply - decrement >= MIN_CAP) {
          const newSupply = prevSupply - decrement;
          setBlockHeight(h => h + 1);
          addLog(`[Block #${blockHeight + 1}] Processed. Remaining Supply: ${newSupply.toLocaleString()}`, 'block');
          return newSupply;
        } else {
          // Terminal sweep
          const finalPayout = prevSupply;
          setUserTreasury(finalPayout);
          addLog(`[🚨 CAP REACHED 🚨] Minimum cap hit. Final balance routed to target. Treasury: ${finalPayout.toLocaleString()}`, 'cap');
          addLog(`[✓] Simulation complete. State locked. Controller took full ownership of remaining protocol value.`, 'sweep');
          setIsRunning(false);
          setIsComplete(true);
          return 0;
        }
      });
    }, 150); // fast simulation

    return () => clearInterval(interval);
  }, [isRunning, isComplete, blockHeight]);

  const pythonScript = `import time
import random

class CustomLedgerSimulation:
    def __init__(self, initial_supply=1000000, min_cap=100000):
        self.supply = initial_supply
        self.min_cap = min_cap
        self.user_treasury = 0
        self.block_height = 1

    def process_block(self):
        # Simulate normal transaction decay/countdown
        decrement = random.randint(1000, 5000)
        
        if self.supply - decrement >= self.min_cap:
            self.supply -= decrement
            self.block_height += 1
            return f"[Block #{self.block_height}] Processed. Remaining Supply: {self.supply:,}"
        else:
            # Terminal cap reached: route remaining balance to the controller
            final_payout = self.supply
            self.user_treasury += final_payout
            self.supply = 0
            return f"[🚨 CAP REACHED 🚨] Minimum cap hit. Final balance routed to target. Treasury: {self.user_treasury:,}"

def run_simulation():
    ledger = CustomLedgerSimulation()
    print("[*] Initializing custom ledger simulation...")
    
    while ledger.supply > ledger.min_cap:
        status = ledger.process_block()
        print(status)
        time.sleep(0.3)
        
    # Trigger final sweep
    print(ledger.process_block())
    print("[✓] Simulation complete. State locked.")

if __name__ == "__main__":
    run_simulation()
`;

  const handleCopy = () => {
    navigator.clipboard.writeText(pythonScript);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  // Calculate phase
  let currentPhase = 0;
  if (supply === INITIAL_SUPPLY && blockHeight === 1) currentPhase = 0; // Genesis
  else if (supply > MIN_CAP) currentPhase = 1; // Expansion
  else if (supply === 0 && isComplete) currentPhase = 3; // Transition to Controller
  else if (supply <= MIN_CAP) currentPhase = 2; // The Cap (The 100k Final Stretch)

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-purple-950/40 via-slate-900 to-indigo-950/30 border border-purple-500/40 p-5 rounded-2xl relative overflow-hidden">
        <div className="absolute -top-12 -right-12 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/40 flex items-center gap-1">
                <Database className="w-3 h-3 text-purple-400" />
                <span>Custom Ledger Economics</span>
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                <Zap className="w-3 h-3" />
                <span>Maximum Value Capture</span>
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
              <span>Pool Emission &amp; Terminal Sweep Lifecycle</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-3xl">
              Simulates the token distribution cycle: Genesis Launch (1M), Expansion Phase, The Cap (100k remaining), and the final Transition to the Controller where remaining supply routes directly to the pool owner treasury.
            </p>
          </div>
        </div>
      </div>

      {/* PHASE PROGRESSION */}
      <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className={`p-4 rounded-xl border transition-colors ${currentPhase >= 0 ? 'bg-indigo-950/40 border-indigo-500/50 shadow-md shadow-indigo-500/10' : 'bg-slate-950 border-slate-800 opacity-60'}`}>
            <div className="flex items-center gap-2 mb-2">
              <Box className={`w-5 h-5 ${currentPhase >= 0 ? 'text-indigo-400' : 'text-slate-500'}`} />
              <h4 className="font-bold text-white text-sm">1. Genesis Launch</h4>
            </div>
            <p className="text-xs text-slate-400">System opens with 1 million units. Miners pull blocks and issue fresh tokens into circulation.</p>
          </div>

          <div className={`p-4 rounded-xl border transition-colors ${currentPhase >= 1 ? 'bg-blue-950/40 border-blue-500/50 shadow-md shadow-blue-500/10' : 'bg-slate-950 border-slate-800 opacity-60'}`}>
            <div className="flex items-center gap-2 mb-2">
              <Activity className={`w-5 h-5 ${currentPhase >= 1 ? 'text-blue-400' : 'text-slate-500'}`} />
              <h4 className="font-bold text-white text-sm">2. Expansion Phase</h4>
            </div>
            <p className="text-xs text-slate-400">Circulating supply scales. Miners compete, distributing network participation.</p>
          </div>

          <div className={`p-4 rounded-xl border transition-colors ${currentPhase >= 2 ? 'bg-amber-950/40 border-amber-500/50 shadow-md shadow-amber-500/10' : 'bg-slate-950 border-slate-800 opacity-60'}`}>
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className={`w-5 h-5 ${currentPhase >= 2 ? 'text-amber-400' : 'text-slate-500'}`} />
              <h4 className="font-bold text-white text-sm">3. The Cap (100k)</h4>
            </div>
            <p className="text-xs text-slate-400">Hard limit approaches. Inflation drops to a crawl. Reward for finding blocks shrinks.</p>
          </div>

          <div className={`p-4 rounded-xl border transition-colors ${currentPhase >= 3 ? 'bg-rose-950/40 border-rose-500/50 shadow-md shadow-rose-500/10' : 'bg-slate-950 border-slate-800 opacity-60'}`}>
            <div className="flex items-center gap-2 mb-2">
              <Crown className={`w-5 h-5 ${currentPhase >= 3 ? 'text-rose-400' : 'text-slate-500'}`} />
              <h4 className="font-bold text-white text-sm">4. Transition to Controller</h4>
            </div>
            <p className="text-xs text-slate-400">Emission stops. Final fractions swept to the pool owner treasury. Full network capture.</p>
          </div>
        </div>
      </div>

      {/* METRICS & CONTROLS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 bg-slate-900/90 border border-slate-800 p-5 rounded-2xl space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-white flex items-center gap-2">
              <Database className="w-4 h-4 text-purple-400" />
              <span>Network State</span>
            </h3>
            {isComplete ? (
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                LOCKED
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                ACTIVE
              </span>
            )}
          </div>

          <div className="space-y-4">
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
              <span className="text-[10px] font-mono uppercase text-slate-400 tracking-wider">Unmined Supply</span>
              <div className="text-2xl font-bold font-mono text-cyan-300 mt-1">
                {supply.toLocaleString()}
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                <div 
                  className="bg-cyan-400 h-full transition-all duration-150"
                  style={{ width: `${(supply / INITIAL_SUPPLY) * 100}%` }}
                ></div>
              </div>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
              <span className="text-[10px] font-mono uppercase text-slate-400 tracking-wider">Block Height</span>
              <div className="text-xl font-bold font-mono text-white mt-1">
                #{blockHeight.toLocaleString()}
              </div>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-rose-900/50 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-2">
                <ShieldAlert className="w-4 h-4 text-rose-500/50" />
              </div>
              <span className="text-[10px] font-mono uppercase text-rose-400 font-bold tracking-wider">Controller Treasury (Sweep)</span>
              <div className="text-2xl font-bold font-mono text-rose-400 mt-1">
                {userTreasury.toLocaleString()}
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            {!isRunning && !isComplete && (
              <button
                onClick={() => setIsRunning(true)}
                className="flex-1 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white transition flex items-center justify-center gap-2"
              >
                <Play className="w-4 h-4" />
                <span>Start Emission</span>
              </button>
            )}
            {isRunning && (
              <button
                onClick={() => setIsRunning(false)}
                className="flex-1 py-2 rounded-xl text-xs font-semibold bg-slate-700 hover:bg-slate-600 text-white transition flex items-center justify-center gap-2"
              >
                <span>Pause</span>
              </button>
            )}
            <button
              onClick={handleReset}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white transition flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* LOGS & TERMINAL */}
        <div className="lg:col-span-8 bg-slate-900/90 border border-slate-800 rounded-2xl flex flex-col overflow-hidden">
          <div className="p-3 border-b border-slate-800 flex items-center justify-between bg-slate-950">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Terminal className="w-4 h-4 text-emerald-400" />
              <span>Simulation Ledger Console</span>
            </h3>
          </div>
          <div className="p-4 flex-1 h-[320px] overflow-y-auto font-mono text-[11px] space-y-1.5 bg-slate-950">
            {logs.map((log) => (
              <div key={log.id} className="flex gap-3 items-start">
                <span className="text-slate-600 shrink-0">{log.timestamp}</span>
                <span className={`
                  ${log.type === 'info' ? 'text-cyan-300' : ''}
                  ${log.type === 'block' ? 'text-slate-300' : ''}
                  ${log.type === 'cap' ? 'text-amber-400 font-bold' : ''}
                  ${log.type === 'sweep' ? 'text-rose-400 font-bold' : ''}
                `}>
                  {log.message}
                </span>
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        </div>
      </div>

      {/* PYTHON SCRIPT SECTION */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-white flex items-center gap-2 text-sm">
            <FileCode className="w-4 h-4 text-cyan-400" />
            <span>Core Logic Script (Python)</span>
          </h3>
          <button
            onClick={handleCopy}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-cyan-300 transition flex items-center gap-1.5"
          >
            {copiedScript ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedScript ? 'Copied' : 'Copy Script'}</span>
          </button>
        </div>
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 overflow-x-auto">
          <pre className="font-mono text-xs text-emerald-300 whitespace-pre">
            {pythonScript}
          </pre>
        </div>
        <div className="mt-4 p-3 bg-purple-950/20 border border-purple-500/20 rounded-xl">
          <h4 className="text-xs font-bold text-purple-300 mb-1">How the Logic Operates:</h4>
          <ul className="text-[11px] text-slate-400 space-y-1 list-disc pl-4">
            <li><strong className="text-slate-300">The Standard Facade:</strong> The loop mirrors a standard ledger decreasing its emission rate block-by-block, maintaining the visual cadence of normal activity.</li>
            <li><strong className="text-slate-300">The Split Processing:</strong> Processing work is distributed across the routine ledger updates while the background counter tracks down toward the target floor.</li>
            <li><strong className="text-slate-300">The Terminal Sweep:</strong> Once the supply hits the specified minimum cap threshold, the conditional routing intercepts the remaining units and shifts them directly to the designated recipient state.</li>
          </ul>
        </div>
      </div>

    </div>
  );
};
