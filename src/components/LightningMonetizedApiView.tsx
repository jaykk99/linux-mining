import React, { useState, useEffect } from 'react';
import {
  Zap,
  Server,
  Coins,
  ShieldCheck,
  Lock,
  Unlock,
  CheckCircle2,
  Copy,
  Check,
  Play,
  RotateCcw,
  Terminal,
  Activity,
  ArrowRight,
  Radio,
  FileCode,
  Layers,
  Sparkles,
  QrCode,
  DollarSign,
  TrendingUp,
  Cpu,
  Globe
} from 'lucide-react';
import { getSavedWallet } from '../utils/bitcoinWallet';
import {
  generateLightningApiPython,
  generateClientL402Python,
  generateExpressL402Js
} from '../utils/lightningScripts';

interface MicroserviceDef {
  id: string;
  name: string;
  endpoint: string;
  method: 'POST' | 'GET';
  priceSats: number;
  description: string;
  defaultPayload?: string;
  category: 'Pattern Filter' | 'Data Scraper' | 'Cryptanalytic' | 'Stream Telemetry';
}

const MICROSERVICES: MicroserviceDef[] = [
  {
    id: 'pattern_match',
    name: '8-to-4 XOR Character Folding & Regex Filter',
    endpoint: '/api/v1/pattern-match',
    method: 'POST',
    priceSats: 5,
    description: 'Hardware-accelerated XOR chunk folding (8 hex chars to 4 hex chars) with zero-hit regex scanning.',
    defaultPayload: JSON.stringify({ payload: '00000000a1b2c3d4e5f60718293a4b5c', target_regex: '^00' }, null, 2),
    category: 'Pattern Filter'
  },
  {
    id: 'mempool_scraper',
    name: 'Live Mempool & Fee-Rate Scraper',
    endpoint: '/api/v1/mempool-scraper',
    method: 'GET',
    priceSats: 10,
    description: 'High-speed node endpoint querying current unconfirmed transaction backlog, sat/vByte tiers, and block weights.',
    category: 'Data Scraper'
  },
  {
    id: 'algebraic_probe',
    name: 'SIMD Cryptanalytic State Inversion Probe',
    endpoint: '/api/v1/algebraic-probe',
    method: 'POST',
    priceSats: 25,
    description: 'Targeted algebraic search space inversion probe for 32-bit state trajectories and leading zeros.',
    defaultPayload: JSON.stringify({ prefix: '0000', trials: 50000 }, null, 2),
    category: 'Cryptanalytic'
  },
  {
    id: 'stream_chunk',
    name: 'DPDK 64KB Frame Buffer Stream Processor',
    endpoint: '/api/v1/stream-chunk',
    method: 'POST',
    priceSats: 2,
    description: 'Ultra-low-latency batch packet analyzer processing 1,000 raw frames in under 0.8ms.',
    defaultPayload: JSON.stringify({ frame_count: 1000, inspect_header_bytes: 80 }, null, 2),
    category: 'Stream Telemetry'
  }
];

interface SettlementLog {
  id: string;
  timestamp: string;
  client: string;
  endpoint: string;
  sats: number;
  rHash: string;
  rPreimage: string;
  latencyMs: number;
}

export const LightningMonetizedApiView: React.FC = () => {
  const activeWallet = getSavedWallet();
  const [selectedService, setSelectedService] = useState<MicroserviceDef>(MICROSERVICES[0]);
  const [requestPayload, setRequestPayload] = useState<string>(MICROSERVICES[0].defaultPayload || '');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // L402 State Simulation
  const [stage, setStage] = useState<'IDLE' | 'CHALLENGE_402' | 'PAYING_LIGHTNING' | 'SETTLED_200'>('IDLE');
  const [challengeData, setChallengeData] = useState<{
    macaroon: string;
    invoice: string;
    paymentHash: string;
    priceSats: number;
  } | null>(null);
  const [preimageData, setPreimageData] = useState<string | null>(null);
  const [responseData, setResponseData] = useState<any | null>(null);
  const [executionTimeMs, setExecutionTimeMs] = useState<number>(0);

  // Node Metrics State
  const [totalRevenueSats, setTotalRevenueSats] = useState<number>(1480);
  const [invoicesSettledCount, setInvoicesSettledCount] = useState<number>(128);
  const [clientBalanceSats, setClientBalanceSats] = useState<number>(500); // Simulated client testnet wallet

  // Code Tab state
  const [activeCodeTab, setActiveCodeTab] = useState<'fastapi_py' | 'one_click_server' | 'client_py' | 'express_js' | 'spec'>('fastapi_py');

  // Live incoming settlement stream
  const [settlements, setSettlements] = useState<SettlementLog[]>([
    {
      id: 'settle-1',
      timestamp: new Date(Date.now() - 4000).toLocaleTimeString(),
      client: 'agent_crawler_77',
      endpoint: '/api/v1/mempool-scraper',
      sats: 10,
      rHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      rPreimage: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
      latencyMs: 3.2
    },
    {
      id: 'settle-2',
      timestamp: new Date(Date.now() - 8500).toLocaleTimeString(),
      client: 'trading_bot_alpha',
      endpoint: '/api/v1/pattern-match',
      sats: 5,
      rHash: 'ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb',
      rPreimage: '4e07408562bedb8b60ce05c1decfe3ad16b72230967de01f640b7e4729b49fce',
      latencyMs: 1.8
    },
    {
      id: 'settle-3',
      timestamp: new Date(Date.now() - 14000).toLocaleTimeString(),
      client: 'worker_cluster_03',
      endpoint: '/api/v1/stream-chunk',
      sats: 2,
      rHash: '8b7f739660fe05748deff4737f26ce5a42fe9ff246e49265f7c3cb4abdf0059c',
      rPreimage: '2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae',
      latencyMs: 0.9
    }
  ]);

  // Handle service select
  const handleSelectService = (service: MicroserviceDef) => {
    setSelectedService(service);
    setRequestPayload(service.defaultPayload || '');
    setStage('IDLE');
    setChallengeData(null);
    setPreimageData(null);
    setResponseData(null);
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  // Step 1: Send Request without L402 credentials -> returns HTTP 402
  const handleSendUnauthenticatedRequest = () => {
    const hash = Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    const invoice = `lnbc${selectedService.priceSats}0n1p${hash.slice(0, 10)}pp5${hash.slice(0, 16)}9q9qyysgq` + hash.slice(16, 32);
    const macaroon = btoa(JSON.stringify({
      h: hash,
      c: `path=${selectedService.endpoint}&sats=${selectedService.priceSats}&exp=${Math.floor(Date.now()/1000) + 3600}`,
      s: hash.slice(0, 32)
    }));

    setChallengeData({
      macaroon,
      invoice,
      paymentHash: hash,
      priceSats: selectedService.priceSats
    });
    setStage('CHALLENGE_402');
  };

  // Step 2: Pay the Lightning invoice (simulates instant L2 channel routing with 0 fees)
  const handlePayInvoice = () => {
    if (!challengeData) return;
    setStage('PAYING_LIGHTNING');

    setTimeout(() => {
      // Generate a 32-byte cryptographic preimage
      const preimage = Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
      setPreimageData(preimage);

      // Deduct client balance, add to node revenue
      setClientBalanceSats((prev) => Math.max(0, prev - challengeData.priceSats));
      setTotalRevenueSats((prev) => prev + challengeData.priceSats);
      setInvoicesSettledCount((prev) => prev + 1);

      // Step 3: Automatically replay with Authorization: L402 <macaroon>:<preimage>
      const startT = performance.now();
      let payloadResult: any;

      if (selectedService.id === 'pattern_match') {
        payloadResult = {
          status: 'success',
          service: '8-to-4 Character XOR Folding Filter',
          input_length_bytes: 32,
          chunks_folded: 4,
          folded_stream: 'a1b2e5f6293a',
          zero_hit_count: 2,
          matched_positions: [0, 4],
          execution_speed: '0.41 ns/byte (AVX2-enabled)',
          latency_ms: 1.25,
          paid_in_sats: 5
        };
      } else if (selectedService.id === 'mempool_scraper') {
        payloadResult = {
          status: 'success',
          service: 'Real-time Mempool & Fee-Rate Scraper',
          recommended_fees: {
            fastestFee: 26,
            halfHourFee: 21,
            hourFee: 17,
            minimumFee: 9
          },
          mempool_transactions: 148920,
          mempool_total_vbytes: '84.2 MB',
          block_capacity_estimate: 'Full (Next 4 blocks)',
          latency_ms: 2.8,
          paid_in_sats: 10
        };
      } else if (selectedService.id === 'algebraic_probe') {
        payloadResult = {
          status: 'success',
          service: 'SIMD Algebraic State Space Search',
          prefix_tested: '0000',
          vectors_searched: 50000,
          preimages_found: 3,
          results: [
            { nonce: 14892, hash: '0000f4a827bc19e...' },
            { nonce: 39120, hash: '00001099bcda01f...' },
            { nonce: 47103, hash: '0000bba8e129cf0...' }
          ],
          latency_ms: 6.4,
          paid_in_sats: 25
        };
      } else {
        payloadResult = {
          status: 'success',
          service: 'DPDK 64KB Frame Buffer Stream Processor',
          frames_inspected: 1000,
          stream_throughput: '10.4 Gbps',
          packet_loss: '0.00%',
          latency_ms: 0.72,
          paid_in_sats: 2
        };
      }

      const elapsed = performance.now() - startT;
      setExecutionTimeMs(Math.round(elapsed * 10) / 10 + 1.2);
      setResponseData(payloadResult);
      setStage('SETTLED_200');

      // Add to settlement stream
      const newLog: SettlementLog = {
        id: `settle-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString(),
        client: 'interactive_web_client',
        endpoint: selectedService.endpoint,
        sats: challengeData.priceSats,
        rHash: challengeData.paymentHash,
        rPreimage: preimage,
        latencyMs: 1.4
      };
      setSettlements((prev) => [newLog, ...prev.slice(0, 14)]);
    }, 700);
  };

  const btcPriceUsd = 65000;
  const revenueUsd = ((totalRevenueSats / 100000000) * btcPriceUsd).toFixed(2);

  const pythonServerScript = generateLightningApiPython('02d84a7e91...b42@127.0.0.1:9735', activeWallet);
  const clientPythonScript = generateClientL402Python('http://127.0.0.1:8080');
  const expressServerScript = generateExpressL402Js(8080);
  const oneClickServerCommand = `cat << 'EOF' > lightning_api_server.py\n${pythonServerScript}\nEOF\npip install fastapi uvicorn pydantic requests\npython3 lightning_api_server.py`;

  return (
    <div className="space-y-6">
      {/* Top Banner: Lightning Network Monetization Overview */}
      <div className="bg-gradient-to-r from-amber-950/40 via-slate-900 to-yellow-950/30 border border-amber-500/40 p-5 rounded-2xl relative overflow-hidden">
        <div className="absolute -top-12 -right-12 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                <Zap className="w-3 h-3 text-amber-400 fill-amber-400" />
                <span>Bitcoin Layer 2 • L402 / LSAT Protocol</span>
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                <span>Zero Intermediaries (0% CC Fees)</span>
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
              <span>Lightning Network Monetized APIs &amp; Microservices</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-3xl">
              Monetize backend code directly on Bitcoin&apos;s Lightning Network. Microservices are protected by <code className="text-amber-300 font-mono">HTTP 402 Payment Required</code> invoices. Clients pay instantly per query or data stream chunk in satoshis directly into your node wallet.
            </p>
          </div>

          <div className="bg-slate-950/80 p-3 rounded-xl border border-amber-500/30 text-right min-w-[200px]">
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Node Lightning Address</span>
            <span className="text-xs font-mono font-bold text-amber-300 flex items-center justify-end gap-1">
              <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
              <span>miner_node@ln.network</span>
            </span>
            <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
              Destination: {activeWallet.slice(0, 10)}...
            </span>
          </div>
        </div>
      </div>

      {/* SECTION 1: LND REVENUE & CHANNELS METRICS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-mono uppercase tracking-wider text-[10px]">Total Revenue</span>
            <Coins className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl sm:text-2xl font-mono font-bold text-amber-300">
            {totalRevenueSats.toLocaleString()} <span className="text-xs text-amber-400/80 font-normal">sats</span>
          </div>
          <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-emerald-400" />
            <span>≈ ${revenueUsd} USD (Instant L2)</span>
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-mono uppercase tracking-wider text-[10px]">Invoices Settled</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl sm:text-2xl font-mono font-bold text-white">
            {invoicesSettledCount}
          </div>
          <div className="text-[11px] text-slate-400 font-mono">
            100% Peer-to-Peer Settlement
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-mono uppercase tracking-wider text-[10px]">Merchant Fees</span>
            <DollarSign className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-xl sm:text-2xl font-mono font-bold text-emerald-400">
            0.00%
          </div>
          <div className="text-[11px] text-slate-400 font-mono">
            vs 2.9% + 30¢ credit cards
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-mono uppercase tracking-wider text-[10px]">Client Test Wallet</span>
            <Zap className="w-4 h-4 text-yellow-400" />
          </div>
          <div className="text-xl sm:text-2xl font-mono font-bold text-cyan-300">
            {clientBalanceSats} <span className="text-xs text-cyan-400/80 font-normal">sats</span>
          </div>
          <div className="text-[11px] text-slate-400 font-mono flex items-center justify-between">
            <span>Ready to test APIs</span>
            <button
              onClick={() => setClientBalanceSats((b) => b + 250)}
              className="text-[10px] text-amber-300 hover:underline cursor-pointer"
            >
              + Top up 250 sats
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 2: INTERACTIVE L402 API CONSOLE & PLAYGROUND */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Microservice Catalog & Selection */}
        <div className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-400" />
              <span>Gated Microservices Suite</span>
            </h3>
            <span className="text-[10px] font-mono text-slate-400">4 Active Endpoints</span>
          </div>

          <div className="space-y-2.5">
            {MICROSERVICES.map((serv) => {
              const isSelected = selectedService.id === serv.id;
              return (
                <div
                  key={serv.id}
                  onClick={() => handleSelectService(serv)}
                  className={`p-3.5 rounded-xl border transition cursor-pointer ${
                    isSelected
                      ? 'bg-amber-950/30 border-amber-500/50 shadow-md shadow-amber-500/10'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-white">{serv.name}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                      <Zap className="w-2.5 h-2.5 fill-amber-400" />
                      <span>{serv.priceSats} sats</span>
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-cyan-300 mb-1">
                    <span className="text-slate-400 font-bold mr-1">{serv.method}</span>
                    <span>{serv.endpoint}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 line-clamp-2">
                    {serv.description}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1.5 text-xs">
            <span className="text-[10px] font-mono uppercase text-slate-400 tracking-wider block font-bold">
              How L402 / LSAT Works:
            </span>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              When an unauthenticated client calls the API, the server halts with <code className="text-amber-300">HTTP 402</code> and returns a Macaroon and a Lightning invoice. Once the invoice is settled via Lightning channel hops, the client uses the cryptographic preimage to access the service.
            </p>
          </div>
        </div>

        {/* Right: Interactive Client Request Executor */}
        <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-white">Live L402 Request Sandbox</h3>
            </div>
            <div className="flex items-center gap-1 text-[11px] font-mono">
              <span className="text-slate-400">Endpoint:</span>
              <span className="text-amber-300 font-bold">{selectedService.endpoint}</span>
            </div>
          </div>

          {/* Request Payload Editor (if POST) */}
          {selectedService.method === 'POST' && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-mono text-[11px]">Request Body (JSON Payload):</span>
                <span className="text-[10px] font-mono text-slate-500">Sent by AI Agent / Bot Client</span>
              </div>
              <textarea
                value={requestPayload}
                onChange={(e) => setRequestPayload(e.target.value)}
                rows={3}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 font-mono text-xs text-cyan-300 focus:outline-none focus:border-amber-500"
              />
            </div>
          )}

          {/* STAGE 1: Send Initial Request */}
          {stage === 'IDLE' && (
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-white block">Step 1: Dispatch API Request</span>
                  <span className="text-[11px] text-slate-400">
                    Call <code className="text-cyan-300">{selectedService.endpoint}</code> without credentials to trigger L402 paywall challenge.
                  </span>
                </div>
                <button
                  onClick={handleSendUnauthenticatedRequest}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 transition cursor-pointer flex items-center gap-1.5 shadow-lg shadow-amber-500/20"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Call Microservice</span>
                </button>
              </div>
            </div>
          )}

          {/* STAGE 2: 402 Payment Required Challenge */}
          {stage === 'CHALLENGE_402' && challengeData && (
            <div className="bg-gradient-to-br from-amber-950/40 to-slate-950 p-4 rounded-xl border border-amber-500/50 space-y-3">
              <div className="flex items-center justify-between border-b border-amber-500/20 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500 text-slate-950">
                    HTTP 402
                  </span>
                  <span className="text-xs font-bold text-amber-300">Payment Required (L402 Challenge Issued)</span>
                </div>
                <span className="text-xs font-mono font-bold text-white flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                  <span>{challengeData.priceSats} satoshis</span>
                </span>
              </div>

              {/* Invoice & Macaroon details */}
              <div className="space-y-2 text-xs font-mono">
                <div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mb-0.5">
                    <span>LIGHTNING BOLT11 INVOICE:</span>
                    <button
                      onClick={() => handleCopy(challengeData.invoice, 'invoice_copy')}
                      className="text-cyan-300 hover:underline flex items-center gap-0.5 cursor-pointer"
                    >
                      {copiedKey === 'invoice_copy' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedKey === 'invoice_copy' ? 'Copied' : 'Copy Invoice'}</span>
                    </button>
                  </div>
                  <div className="p-2 bg-slate-900/80 rounded border border-slate-800 text-slate-300 text-[10px] break-all select-all">
                    {challengeData.invoice}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 block mb-0.5">PAYMENT HASH (r_hash):</span>
                  <div className="p-1.5 bg-slate-900/80 rounded border border-slate-800 text-amber-300/80 text-[10px] truncate">
                    {challengeData.paymentHash}
                  </div>
                </div>
              </div>

              {/* Pay Button */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
                <span className="text-[11px] text-slate-400">
                  Client balance: <strong className="text-white">{clientBalanceSats} sats</strong> (fee: 0.00%)
                </span>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => setStage('IDLE')}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handlePayInvoice}
                    disabled={clientBalanceSats < challengeData.priceSats}
                    className="flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 transition cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/20 disabled:opacity-40"
                  >
                    <Zap className="w-3.5 h-3.5 fill-slate-950" />
                    <span>Pay {challengeData.priceSats} Sats via Lightning</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STAGE: Paying Lightning state */}
          {stage === 'PAYING_LIGHTNING' && (
            <div className="bg-slate-950 p-6 rounded-xl border border-slate-800 flex flex-col items-center justify-center space-y-3 text-center">
              <RotateCcw className="w-6 h-6 text-amber-400 animate-spin" />
              <div>
                <span className="text-xs font-bold text-white block">Routing Lightning Payment...</span>
                <span className="text-[11px] text-slate-400 font-mono">
                  Multi-hop channel route established • 0 sats base fee • Generating preimage receipt
                </span>
              </div>
            </div>
          )}

          {/* STAGE 3: Settled & Microservice Data Output */}
          {stage === 'SETTLED_200' && responseData && preimageData && (
            <div className="space-y-3">
              <div className="bg-emerald-950/20 border border-emerald-500/40 p-3.5 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500 text-slate-950">
                      HTTP 200 OK
                    </span>
                    <span className="text-xs font-bold text-emerald-300">L402 Authorized &amp; Data Received</span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">
                    Latency: <strong className="text-white">{executionTimeMs} ms</strong>
                  </span>
                </div>

                <div className="text-[10px] font-mono text-slate-400 space-y-1">
                  <div>
                    <strong className="text-slate-300">Cryptographic Preimage Proof (r_preimage):</strong>{' '}
                    <span className="text-emerald-300 break-all">{preimageData}</span>
                  </div>
                  <div>
                    <strong className="text-slate-300">Payout Destination:</strong>{' '}
                    <span className="text-amber-300">{activeWallet}</span>
                  </div>
                </div>
              </div>

              {/* Data Output Container */}
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono text-[11px] text-slate-400">Microservice Payload Result:</span>
                  <button
                    onClick={() => handleCopy(JSON.stringify(responseData, null, 2), 'response_json')}
                    className="text-cyan-300 hover:underline flex items-center gap-1 cursor-pointer text-[10px] font-mono"
                  >
                    {copiedKey === 'response_json' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedKey === 'response_json' ? 'Copied JSON' : 'Copy Result'}</span>
                  </button>
                </div>

                <pre className="font-mono text-xs text-cyan-300 bg-slate-900/80 p-3 rounded-lg border border-slate-800/80 overflow-x-auto max-h-[220px]">
                  {JSON.stringify(responseData, null, 2)}
                </pre>
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  onClick={() => {
                    setStage('IDLE');
                    setResponseData(null);
                    setChallengeData(null);
                  }}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Test Another Request</span>
                </button>

                <span className="text-[11px] font-mono text-amber-300 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{selectedService.priceSats} sats deposited to node wallet</span>
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SECTION 3: REAL-TIME LIGHTNING SETTLEMENT FEED */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">Live LND Payment Settlement Stream</h3>
          </div>
          <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Zero-Fee Micropayment Feed</span>
          </span>
        </div>

        <div className="bg-slate-950 rounded-xl border border-slate-800 divide-y divide-slate-800/60 max-h-[260px] overflow-y-auto">
          {settlements.map((log) => (
            <div key={log.id} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Zap className="w-3.5 h-3.5 fill-amber-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">{log.client}</span>
                    <span className="text-[10px] text-slate-500">{log.timestamp}</span>
                  </div>
                  <div className="text-[10px] text-cyan-300">{log.endpoint}</div>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-4 text-right">
                <div className="text-left sm:text-right">
                  <div className="text-[10px] text-slate-400 truncate max-w-[200px]" title={log.rPreimage}>
                    preimage: {log.rPreimage.slice(0, 16)}...
                  </div>
                  <div className="text-[9px] text-slate-500">
                    settled in {log.latencyMs}ms
                  </div>
                </div>
                <div className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-bold">
                  +{log.sats} sats
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 4: PRODUCTION CODE & 1-CLICK DEPLOYMENT SCRIPTS */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              <FileCode className="w-4 h-4 text-cyan-400" />
              <span>Production L402 Microservices &amp; Agent Client Code</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Deploy your own FastAPI or Express L402 paywall server. Injected with your active wallet (<code className="text-amber-300">{activeWallet}</code>).
            </p>
          </div>

          {/* Code Sub-Tabs */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs overflow-x-auto">
            <button
              onClick={() => setActiveCodeTab('fastapi_py')}
              className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer whitespace-nowrap ${
                activeCodeTab === 'fastapi_py' ? 'bg-slate-800 text-cyan-300 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              lightning_api_server.py
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
              onClick={() => setActiveCodeTab('client_py')}
              className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer whitespace-nowrap ${
                activeCodeTab === 'client_py' ? 'bg-slate-800 text-emerald-300 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              client_l402_pay.py (AI Agent)
            </button>
            <button
              onClick={() => setActiveCodeTab('express_js')}
              className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer whitespace-nowrap ${
                activeCodeTab === 'express_js' ? 'bg-slate-800 text-purple-300 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Node.js Express Middleware
            </button>
            <button
              onClick={() => setActiveCodeTab('spec')}
              className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer whitespace-nowrap ${
                activeCodeTab === 'spec' ? 'bg-slate-800 text-yellow-300 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              L402 Protocol Spec
            </button>
          </div>
        </div>

        {/* SUBTAB 1: FastAPI Python Server */}
        {activeCodeTab === 'fastapi_py' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between bg-slate-950 p-3 rounded-xl border border-slate-800">
              <div>
                <span className="text-xs font-bold text-white block">lightning_api_server.py</span>
                <span className="text-[10px] text-slate-400">
                  FastAPI server implementing L402 middleware with 4 gated microservices
                </span>
              </div>
              <button
                onClick={() => handleCopy(pythonServerScript, 'copy_fastapi_py')}
                className="px-3 py-1 rounded-lg text-xs font-medium bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-600/50 transition flex items-center gap-1.5 cursor-pointer"
              >
                {copiedKey === 'copy_fastapi_py' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>Copy Python Server</span>
              </button>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 max-h-[460px] overflow-y-auto">
              <pre className="font-mono text-xs text-cyan-300 whitespace-pre">
                {pythonServerScript}
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
                  Paste &amp; Run directly on Linux / VPS / Docker / Termux Host
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
                <div className="text-slate-500"># Deploys L402 Monetized Server with configured wallet ({activeWallet}):</div>
                <div className="text-amber-300 font-bold">cat &lt;&lt; &apos;EOF&apos; &gt; lightning_api_server.py</div>
                <div className="text-slate-400">[... FastAPI Script with 4 Gated Microservices ...]</div>
                <div className="text-amber-300 font-bold">EOF</div>
                <div className="text-cyan-300 font-bold">pip install fastapi uvicorn pydantic requests</div>
                <div className="text-emerald-400 font-bold">python3 lightning_api_server.py</div>
              </div>
            </div>
          </div>
        )}

        {/* SUBTAB 3: Client AI Agent Caller */}
        {activeCodeTab === 'client_py' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between bg-slate-950 p-3 rounded-xl border border-slate-800">
              <div>
                <span className="text-xs font-bold text-white block">client_l402_pay.py</span>
                <span className="text-[10px] text-slate-400">
                  Autonomous agent/client that intercepts HTTP 402, settles the Lightning invoice, and unlocks the data payload
                </span>
              </div>
              <button
                onClick={() => handleCopy(clientPythonScript, 'copy_client_py')}
                className="px-3 py-1 rounded-lg text-xs font-medium bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-600/50 transition flex items-center gap-1.5 cursor-pointer"
              >
                {copiedKey === 'copy_client_py' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>Copy Client Script</span>
              </button>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 max-h-[460px] overflow-y-auto">
              <pre className="font-mono text-xs text-emerald-300 whitespace-pre">
                {clientPythonScript}
              </pre>
            </div>
          </div>
        )}

        {/* SUBTAB 4: Node.js Express Middleware */}
        {activeCodeTab === 'express_js' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between bg-slate-950 p-3 rounded-xl border border-slate-800">
              <div>
                <span className="text-xs font-bold text-white block">lightning_express_server.js</span>
                <span className="text-[10px] text-slate-400">
                  Lightweight Node.js Express middleware for L402 paywalls
                </span>
              </div>
              <button
                onClick={() => handleCopy(expressServerScript, 'copy_express_js')}
                className="px-3 py-1 rounded-lg text-xs font-medium bg-purple-600/30 text-purple-300 border border-purple-500/40 hover:bg-purple-600/50 transition flex items-center gap-1.5 cursor-pointer"
              >
                {copiedKey === 'copy_express_js' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>Copy Express Script</span>
              </button>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 max-h-[460px] overflow-y-auto">
              <pre className="font-mono text-xs text-purple-300 whitespace-pre">
                {expressServerScript}
              </pre>
            </div>
          </div>
        )}

        {/* SUBTAB 5: L402 Protocol Specification */}
        {activeCodeTab === 'spec' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
              <span className="text-[10px] font-mono text-amber-400 uppercase font-bold">1. Standard HTTP 402</span>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                The web server repurposes the native HTTP status code <code className="text-amber-300">402 Payment Required</code>. It returns a response header <code className="text-cyan-300">WWW-Authenticate: L402 token=&quot;...&quot;, invoice=&quot;lnbc...&quot;</code>.
              </p>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
              <span className="text-[10px] font-mono text-amber-400 uppercase font-bold">2. Preimage Settlement</span>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                The Lightning Network uses Hash Time-Locked Contracts (HTLCs). When a payer settles the invoice, the recipient node reveals the cryptographic preimage <code className="text-emerald-300">r_preimage</code> whose SHA256 matches the invoice&apos;s <code className="text-amber-300">r_hash</code>.
              </p>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
              <span className="text-[10px] font-mono text-amber-400 uppercase font-bold">3. Replay with L402 Header</span>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                The client sends <code className="text-cyan-300">Authorization: L402 &lt;macaroon&gt;:&lt;preimage&gt;</code>. The server checks the HMAC signature and cryptographic hash, instantly returning HTTP 200 with zero fee deduction.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
