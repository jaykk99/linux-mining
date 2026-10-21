/**
 * Shared validation for miner configuration, used by the dashboard UI.
 * Mirrors preflight.py's config schema so the UI and the CLI agree:
 *   { pool, wallet, pattern, threads, engine }
 */

export type Engine = "python" | "c" | "auto";

export interface RigConfig {
  pool: string;
  wallet: string;
  pattern: string;
  threads: number;
  engine: Engine;
}

export interface FieldError {
  field: keyof RigConfig;
  message: string;
}

const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export function defaultRigConfig(): RigConfig {
  const cores =
    typeof navigator !== "undefined" && navigator.hardwareConcurrency
      ? navigator.hardwareConcurrency
      : 4;
  return {
    pool: "solo.ckpool.org:3333",
    wallet: "",
    pattern: "1122",
    threads: Math.max(1, cores),
    engine: "auto",
  };
}

/** Parse "host:port" (or "[ipv6]:port", or bare host -> :3333). */
export function parsePool(pool: string): { host: string; port: number } {
  const s = (pool || "").trim();
  if (!s) throw new Error("pool is empty");
  let host: string;
  let portStr: string;
  if (s.startsWith("[")) {
    const m = /^\[(.+)\]:(\d+)$/.exec(s);
    if (!m) throw new Error(`bad IPv6 pool format: '${s}' (expected [::1]:3333)`);
    host = m[1];
    portStr = m[2];
  } else if ((s.match(/:/g) || []).length > 1) {
    throw new Error(`bare IPv6 pool needs [brackets]:port — got '${s}'`);
  } else if (s.includes(":")) {
    const i = s.lastIndexOf(":");
    host = s.slice(0, i);
    portStr = s.slice(i + 1);
  } else {
    host = s;
    portStr = "3333";
  }
  if (!host) throw new Error(`pool host is empty in '${s}'`);
  const port = Number(portStr);
  if (!Number.isInteger(port)) throw new Error(`pool port is not a number: '${portStr}'`);
  if (port < 1 || port > 65535) throw new Error(`pool port out of range (1-65535): ${port}`);
  return { host, port };
}

/** Strict wallet check: plausible BTC address or an error. */
export function validateWallet(wallet: string): string {
  const w = (wallet || "").trim();
  if (!w) throw new Error("wallet is empty");
  if (w.startsWith("bc1q") || w.startsWith("bc1p")) {
    if (w.length >= 14 && w.length <= 74 && /^[a-z0-9]+$/.test(w)) return w;
    throw new Error("bech32 wallet has odd length/characters");
  }
  if (w.startsWith("1") || w.startsWith("3")) {
    if (w.length >= 26 && w.length <= 35 && [...w].every((c) => BASE58.includes(c))) return w;
    throw new Error("base58 wallet failed length/character sanity");
  }
  throw new Error(`unrecognized wallet address format: '${w.slice(0, 12)}…'`);
}

/** Pattern must be 1-8 hex chars (normalized to lowercase). */
export function validatePattern(pattern: string): string {
  const p = (pattern || "").trim().toLowerCase();
  if (!/^[0-9a-f]{1,8}$/.test(p))
    throw new Error(`pattern must be 1-8 hex chars, got '${pattern}'`);
  return p;
}

/** Threads must be an int in 1..2*cores. */
export function validateThreads(raw: number | string, cores?: number): number {
  const n = typeof raw === "string" ? Number(raw) : raw;
  const cpuCores =
    cores ??
    (typeof navigator !== "undefined" && navigator.hardwareConcurrency
      ? navigator.hardwareConcurrency
      : 4);
  const cap = Math.max(1, cpuCores * 2);
  if (!Number.isInteger(n)) throw new Error(`threads must be an integer, got '${raw}'`);
  if (n < 1 || n > cap) throw new Error(`threads must be 1..${cap} on this host, got ${n}`);
  return n;
}

export function validateEngine(engine: string): Engine {
  const e = (engine || "").trim().toLowerCase();
  if (e === "python" || e === "c" || e === "auto") return e;
  throw new Error(`engine must be python, c, or auto (got '${engine}')`);
}

/** Validate a whole config object; returns the normalized config + problems. */
export function validateRigConfig(
  data: Partial<RigConfig>,
  cores?: number,
): { config: RigConfig; errors: FieldError[] } {
  const errors: FieldError[] = [];
  const out: RigConfig = defaultRigConfig();

  try {
    const { host, port } = parsePool(data.pool ?? "");
    out.pool = `${host}:${port}`;
  } catch (e) {
    errors.push({ field: "pool", message: (e as Error).message });
  }
  try {
    out.wallet = validateWallet(data.wallet ?? "");
  } catch (e) {
    errors.push({ field: "wallet", message: (e as Error).message });
  }
  try {
    out.pattern = validatePattern(data.pattern ?? "1122");
  } catch (e) {
    errors.push({ field: "pattern", message: (e as Error).message });
  }
  try {
    out.threads = validateThreads(data.threads ?? out.threads, cores);
  } catch (e) {
    errors.push({ field: "threads", message: (e as Error).message });
  }
  try {
    out.engine = validateEngine(data.engine ?? "auto");
  } catch (e) {
    errors.push({ field: "engine", message: (e as Error).message });
  }
  return { config: out, errors };
}

/** Odds summary for a pattern: "~1 in N hashes". */
export function patternOdds(pattern: string): string {
  try {
    const p = validatePattern(pattern);
    return `~1 in ${(16 ** p.length).toLocaleString("en-US")} hashes`;
  } catch {
    return "invalid pattern";
  }
}

const STORAGE_KEY = "linux-mining-rig-config-v1";

export function loadRigConfig(): RigConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultRigConfig();
    const { config, errors } = validateRigConfig(JSON.parse(raw));
    // Keep the user's values even if partially invalid; UI shows the errors.
    void errors;
    return config;
  } catch {
    return defaultRigConfig();
  }
}

export function saveRigConfig(cfg: RigConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg, null, 2));
}

export function exportRigConfigJson(cfg: RigConfig): string {
  // Shape matches preflight.py --config schema exactly.
  return (
    JSON.stringify(
      {
        pool: cfg.pool,
        wallet: cfg.wallet,
        pattern: cfg.pattern,
        threads: cfg.threads,
        engine: cfg.engine,
      },
      null,
      2,
    ) + "\n"
  );
}
