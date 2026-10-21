#!/usr/bin/env python3
"""
linux-mining pre-flight checks.

Validates that a machine is ready to run the miners BEFORE any mining starts:
  - Python version
  - Miner scripts present (and C sources compile-check clean)
  - C compiler available (gcc / clang)
  - CPU / memory / GPU detection (informational)
  - Wallet address sanity (warn-only, never rejects)
  - Config input validation (pool host:port, target pattern)

Pool reachability (DNS + TCP) is OPT-IN only (--include-pool) because it opens
a real connection to a live pool. By default it is skipped.

Exit code: 0 = ready (warnings allowed), 1 = hard failure(s).

Usage:
    python3 preflight.py [--wallet ADDR] [--pool host:port] [--include-pool] [--quiet]
                        [--config miner-config.json]

A JSON config file (--config) is validated against the miner config schema:
    {"pool": "host:port", "wallet": "ADDR", "pattern": "1122",
     "threads": 4, "engine": "python|c|auto"}
"""

import argparse
import json
import os
import re
import shutil
import socket
import subprocess
import sys
import tempfile

import argparse
import os
import re
import shutil
import socket
import subprocess
import sys

REPO_DIR = os.path.dirname(os.path.abspath(__file__))

REQUIRED_SCRIPTS = [
    "real_btc_miner.py",
    "fast_miner.py",
    "quick_miner.py",
    "compressed_miner.py",
    "stream_engine.py",
    "algebraic_solver.py",
]

C_SOURCES = ["fast_miner.c", "stream_engine.c", "algebraic_solver.c"]

BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"


class CheckResult:
    def __init__(self):
        self.failures = []
        self.warnings = []

    def ok(self, name, detail=""):
        if not QUIET:
            print(f"[✓] {name}" + (f" — {detail}" if detail else ""))

    def warn(self, name, detail=""):
        self.warnings.append(name)
        if not QUIET:
            print(f"[!] {name}" + (f" — {detail}" if detail else ""))

    def fail(self, name, detail=""):
        self.failures.append(name)
        print(f"[✗] {name}" + (f" — {detail}" if detail else ""))

    def passed(self):
        return not self.failures


QUIET = False


def check_python(res):
    v = sys.version_info
    if v >= (3, 8):
        res.ok("Python version", f"{v.major}.{v.minor}.{v.micro}")
    else:
        res.fail("Python version", f"found {v.major}.{v.minor} — need 3.8+")


def check_scripts(res):
    missing = [s for s in REQUIRED_SCRIPTS if not os.path.isfile(os.path.join(REPO_DIR, s))]
    if missing:
        res.fail("Miner scripts", f"missing: {', '.join(missing)}")
        return
    # syntax check every script
    bad = []
    for s in REQUIRED_SCRIPTS:
        r = subprocess.run(
            [sys.executable, "-m", "py_compile", os.path.join(REPO_DIR, s)],
            capture_output=True,
        )
        if r.returncode != 0:
            bad.append(s)
    if bad:
        res.fail("Script syntax", f"py_compile failed: {', '.join(bad)}")
    else:
        res.ok("Miner scripts", f"{len(REQUIRED_SCRIPTS)} present, py_compile clean")


def check_c_toolchain(res):
    gcc = shutil.which("gcc")
    clang = shutil.which("clang")
    if not gcc and not clang:
        res.warn("C compiler", "neither gcc nor clang found — start.sh will fall back to the slower Python engine")
        return
    compiler = gcc or clang
    res.ok("C compiler", compiler)
    # real compile-check of the C sources (syntax only, no binary produced)
    bad = []
    for src in C_SOURCES:
        path = os.path.join(REPO_DIR, src)
        if not os.path.isfile(path):
            bad.append(f"{src} (missing)")
            continue
        r = subprocess.run(
            [compiler, "-fsyntax-only", path],
            capture_output=True,
            text=True,
        )
        if r.returncode != 0:
            bad.append(f"{src}: {r.stderr.strip().splitlines()[-1] if r.stderr else 'error'}")
    if bad:
        res.fail("C sources compile-check", "; ".join(bad))
    else:
        res.ok("C sources", f"{len(C_SOURCES)} pass {os.path.basename(compiler)} -fsyntax-only")


def check_hardware(res):
    cores = os.cpu_count() or 1
    res.ok("CPU", f"{cores} logical core(s)")
    # memory
    mem_mb = None
    try:
        with open("/proc/meminfo") as f:
            for line in f:
                if line.startswith("MemTotal:"):
                    mem_mb = int(line.split()[1]) // 1024
                    break
    except OSError:
        pass
    if mem_mb:
        res.ok("Memory", f"{mem_mb:,} MB total")
    else:
        res.warn("Memory", "could not read /proc/meminfo (non-Linux host?)")
    # GPU detection (informational only — CPU mining works without a GPU)
    gpu = None
    nvidia = shutil.which("nvidia-smi")
    if nvidia:
        try:
            out = subprocess.run(
                [nvidia, "--query-gpu=name", "--format=csv,noheader"],
                capture_output=True, text=True, timeout=10,
            )
            names = [l.strip() for l in out.stdout.splitlines() if l.strip()]
            if names:
                gpu = "NVIDIA: " + ", ".join(names)
        except (subprocess.SubprocessError, OSError):
            pass
    if not gpu and shutil.which("rocm-smi"):
        try:
            out = subprocess.run(
                ["rocm-smi", "--showproductname"],
                capture_output=True, text=True, timeout=10,
            )
            if "Card series" in out.stdout or "GPU" in out.stdout:
                gpu = "AMD ROCm device detected"
        except (subprocess.SubprocessError, OSError):
            pass
    if gpu:
        res.ok("GPU", gpu)
    else:
        res.warn("GPU", "no NVIDIA/ROCm GPU detected — CPU mining only")


def check_wallet(res, wallet):
    """Sanity check only — warns, never rejects."""
    if not wallet:
        res.warn("Wallet", "no wallet supplied — scripts will use the built-in default")
        return
    w = wallet.strip()
    if w.startswith("bc1q") or w.startswith("bc1p"):
        if 14 <= len(w) <= 74 and re.fullmatch(r"[a-z0-9]+", w):
            res.ok("Wallet", f"looks like a bech32 address ({w[:8]}…{w[-6:]})")
        else:
            res.warn("Wallet", "bech32-looking but odd length/characters — double-check it")
    elif w.startswith("1") or w.startswith("3"):
        if 26 <= len(w) <= 35 and all(c in BASE58_ALPHABET for c in w):
            res.ok("Wallet", f"looks like a legacy/base58 address ({w[:8]}…{w[-6:]})")
        else:
            res.warn("Wallet", "base58-looking but failed checksum-length sanity — double-check it")
    else:
        res.warn("Wallet", f"unrecognized address format ({w[:12]}…) — payouts may not arrive; verify it")


def parse_pool(pool_str):
    """Returns (host, port) or raises ValueError with a clear message."""
    if not pool_str or not pool_str.strip():
        raise ValueError("pool is empty")
    s = pool_str.strip()
    if s.startswith("["):  # [ipv6]:port
        m = re.fullmatch(r"\[(.+)\]:(\d+)", s)
        if not m:
            raise ValueError(f"bad IPv6 pool format: {pool_str!r} (expected [::1]:3333)")
        host, port_s = m.group(1), m.group(2)
    elif s.count(":") > 1:  # bare IPv6 without port
        raise ValueError(f"bare IPv6 pool needs [brackets]:port — got {pool_str!r}")
    elif ":" in s:
        host, port_s = s.rsplit(":", 1)
    else:
        host, port_s = s, "3333"
    if not host:
        raise ValueError(f"pool host is empty in {pool_str!r}")
    try:
        port = int(port_s)
    except ValueError:
        raise ValueError(f"pool port is not a number: {port_s!r}")
    if not 1 <= port <= 65535:
        raise ValueError(f"pool port out of range (1-65535): {port}")
    return host, port


def check_pool_config(res, pool_str):
    try:
        host, port = parse_pool(pool_str)
        res.ok("Pool config", f"{host}:{port}")
        return host, port
    except ValueError as e:
        res.fail("Pool config", str(e))
        return None, None


def check_pattern(res, pattern):
    if pattern is None:
        return
    p = pattern.strip().lower()
    if not p:
        res.fail("Target pattern", "empty — the miner would match nothing (or everything)")
    elif not re.fullmatch(r"[0-9a-f]{1,8}", p):
        res.fail("Target pattern", f"{pattern!r} is not 1-8 hex characters")
    else:
        odds = 16 ** len(p)
        res.ok("Target pattern", f'"{p}" — ~1 in {odds:,} hashes')


def check_disk_space(res, min_free_mb=256):
    """Fail when the repo dir or /tmp has less than min_free_mb free."""
    for label, path in (("repo dir", REPO_DIR), ("/tmp", tempfile.gettempdir())):
        try:
            free_mb = shutil.disk_usage(path).free // (1024 * 1024)
        except OSError as e:
            res.warn("Disk space", f"could not stat {label} ({path}): {e}")
            continue
        if free_mb < min_free_mb:
            res.fail("Disk space", f"only {free_mb:,} MB free on {label} — need {min_free_mb:,} MB")
        else:
            res.ok("Disk space", f"{free_mb:,} MB free on {label}")


def check_tmp_writable(res):
    """The miners stage work files in /tmp — prove it is writable."""
    tmpdir = tempfile.gettempdir()
    try:
        fd, path = tempfile.mkstemp(prefix="preflight-", dir=tmpdir)
        with os.fdopen(fd, "w") as f:
            f.write("ok")
        os.unlink(path)
        res.ok("Temp dir writable", tmpdir)
    except OSError as e:
        res.fail("Temp dir writable", f"cannot write to {tmpdir}: {e}")


def check_fd_limit(res, minimum=4096):
    """Warn when the file-descriptor limit is low (threaded miners)."""
    try:
        import resource
        soft, _hard = resource.getrlimit(resource.RLIMIT_NOFILE)
    except (ImportError, OSError, ValueError):
        res.warn("FD limit", "could not read RLIMIT_NOFILE (non-POSIX host?)")
        return
    if soft < minimum:
        res.warn("FD limit", f"soft limit is {soft} — raise with `ulimit -n {minimum}` for threaded miners")
    else:
        res.ok("FD limit", f"soft limit {soft}")


def check_node_toolchain(res):
    """Dashboard UI builds with vite — warn-only, mining does not need it."""
    node = shutil.which("node")
    npm = shutil.which("npm")
    if not node:
        res.warn("Node.js", "node not found — `npm run build` for the dashboard will not work")
        return
    res.ok("Node.js", node)
    if not npm:
        res.warn("npm", "npm not found — cannot install dashboard dependencies")
    nm = os.path.join(REPO_DIR, "node_modules")
    if os.path.isdir(nm):
        res.ok("Dashboard deps", "node_modules present")
    else:
        res.warn("Dashboard deps", "node_modules missing — run `npm ci` before `npm run build`")


def check_service_file(res, name="btc-miner.service"):
    """Sanity-check the systemd unit: required sections + ExecStart."""
    path = os.path.join(REPO_DIR, name)
    if not os.path.isfile(path):
        res.warn("Service file", f"{name} not found — skip systemd install")
        return
    sections = {}
    current = None
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            for raw in f:
                line = raw.strip()
                if not line or line.startswith(("#", ";")):
                    continue
                m = re.fullmatch(r"\[(.+)\]", line)
                if m:
                    current = m.group(1)
                    sections.setdefault(current, {})
                elif current and "=" in line:
                    k, v = line.split("=", 1)
                    sections[current][k.strip()] = v.strip()
    except OSError as e:
        res.fail("Service file", f"cannot read {name}: {e}")
        return
    problems = []
    if "Unit" not in sections:
        problems.append("missing [Unit]")
    if "Service" not in sections:
        problems.append("missing [Service]")
    elif not sections["Service"].get("ExecStart"):
        problems.append("[Service] has no ExecStart=")
    if "Install" not in sections or not sections["Install"].get("WantedBy"):
        problems.append("[Install] has no WantedBy=")
    if problems:
        res.fail("Service file", f"{name}: " + "; ".join(problems))
    else:
        res.ok("Service file", f"{name} parses ({len(sections)} sections)")


# ---------------------------------------------------------------------------
# Miner config schema validation (--config)
# ---------------------------------------------------------------------------

CONFIG_ENGINES = ("python", "c", "auto")


def validate_threads(raw):
    """Threads must be an int in 1..(2 * cpu_count)."""
    try:
        n = int(raw)
    except (TypeError, ValueError):
        raise ValueError(f"threads must be an integer, got {raw!r}")
    cap = max(1, (os.cpu_count() or 1) * 2)
    if not 1 <= n <= cap:
        raise ValueError(f"threads must be 1..{cap} on this host, got {n}")
    return n


def validate_wallet_strict(wallet):
    """Wallet must be a plausible BTC address (unlike check_wallet, rejects)."""
    w = (wallet or "").strip()
    if not w:
        raise ValueError("wallet is empty")
    if w.startswith(("bc1q", "bc1p")):
        if 14 <= len(w) <= 74 and re.fullmatch(r"[a-z0-9]+", w):
            return w
        raise ValueError("bech32 wallet has odd length/characters")
    if w.startswith(("1", "3")):
        if 26 <= len(w) <= 35 and all(c in BASE58_ALPHABET for c in w):
            return w
        raise ValueError("base58 wallet failed length/character sanity")
    raise ValueError(f"unrecognized wallet address format: {w[:12]!r}…")


def validate_pattern_strict(pattern):
    p = (pattern or "").strip().lower()
    if not re.fullmatch(r"[0-9a-f]{1,8}", p):
        raise ValueError(f"pattern must be 1-8 hex chars, got {pattern!r}")
    return p


def validate_miner_config(data):
    """Validate a miner config dict; returns the normalized config.

    Raises ValueError listing every problem found.
    """
    if not isinstance(data, dict):
        raise ValueError("config must be a JSON object")
    problems = []
    cfg = {}

    # pool (required)
    try:
        host, port = parse_pool(data.get("pool", ""))
        cfg["pool"] = f"{host}:{port}"
    except ValueError as e:
        problems.append(f"pool: {e}")

    # wallet (required)
    try:
        cfg["wallet"] = validate_wallet_strict(data.get("wallet", ""))
    except ValueError as e:
        problems.append(f"wallet: {e}")

    # pattern (optional, default 1122)
    try:
        cfg["pattern"] = validate_pattern_strict(data.get("pattern", "1122"))
    except ValueError as e:
        problems.append(f"pattern: {e}")

    # threads (optional, default = cpu count)
    try:
        cfg["threads"] = validate_threads(data.get("threads", os.cpu_count() or 1))
    except ValueError as e:
        problems.append(f"threads: {e}")

    # engine (optional, default auto)
    engine = str(data.get("engine", "auto")).strip().lower()
    if engine not in CONFIG_ENGINES:
        problems.append(f"engine must be one of {', '.join(CONFIG_ENGINES)}, got {engine!r}")
    else:
        cfg["engine"] = engine

    unknown = sorted(set(data) - {"pool", "wallet", "pattern", "threads", "engine"})
    if unknown:
        problems.append(f"unknown config keys: {', '.join(unknown)}")

    if problems:
        raise ValueError("invalid miner config:\n  - " + "\n  - ".join(problems))
    return cfg


def load_miner_config(path):
    """Read + validate a JSON miner config file. Raises ValueError."""
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except FileNotFoundError:
        raise ValueError(f"config file not found: {path}")
    except json.JSONDecodeError as e:
        raise ValueError(f"config file is not valid JSON: {e}")
    except OSError as e:
        raise ValueError(f"cannot read config file {path}: {e}")
    return validate_miner_config(data)


def check_config(res, path):
    if not path:
        return
    try:
        cfg = load_miner_config(path)
    except ValueError as e:
        res.fail("Miner config", str(e))
        return
    res.ok("Miner config", f"valid — pool {cfg['pool']}, pattern {cfg['pattern']}, "
                           f"{cfg['threads']} threads, engine {cfg['engine']}")


def check_pool_reachable(res, host, port):
    """OPT-IN: opens a real TCP connection to the pool. Skipped by default."""
    try:
        ip = socket.gethostbyname(host)
    except socket.gaierror as e:
        res.fail("Pool DNS", f"cannot resolve {host}: {e}")
        return
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(5)
    try:
        s.connect((ip, port))
        res.ok("Pool reachable", f"TCP connect to {host}:{port} ({ip}) succeeded")
    except OSError as e:
        res.fail("Pool reachable", f"TCP connect to {host}:{port} failed: {e}")
    finally:
        s.close()


def main():
    global QUIET
    ap = argparse.ArgumentParser(description="linux-mining pre-flight checks")
    ap.add_argument("--wallet", default=os.environ.get("BTC_WALLET", ""),
                    help="payout wallet to sanity-check (default: $BTC_WALLET)")
    ap.add_argument("--pool", default=os.environ.get("BTC_POOL", "solo.ckpool.org:3333"),
                    help="pool host:port to validate (default: $BTC_POOL or solo.ckpool.org:3333)")
    ap.add_argument("--pattern", default=os.environ.get("TARGET_PATTERN", "1122"),
                    help="8-to-4 target pattern to validate (default: $TARGET_PATTERN or 1122)")
    ap.add_argument("--include-pool", action="store_true",
                    help="also perform a live TCP reachability check against the pool")
    ap.add_argument("--config", default=os.environ.get("MINER_CONFIG", ""),
                    help="validate a JSON miner config file (default: $MINER_CONFIG)")
    ap.add_argument("--quiet", action="store_true", help="only print failures/warnings + summary")
    args = ap.parse_args()
    QUIET = args.quiet

    res = CheckResult()
    if not QUIET:
        print("=" * 60)
        print("   linux-mining pre-flight checks")
        print("=" * 60)

    check_python(res)
    check_scripts(res)
    check_c_toolchain(res)
    check_hardware(res)
    check_disk_space(res)
    check_tmp_writable(res)
    check_fd_limit(res)
    check_node_toolchain(res)
    check_service_file(res)
    check_wallet(res, args.wallet)
    host, port = check_pool_config(res, args.pool)
    check_pattern(res, args.pattern)
    check_config(res, args.config)

    if args.include_pool and host and port:
        check_pool_reachable(res, host, port)
    elif not QUIET:
        print("[*] Pool reachability check skipped (pass --include-pool to test TCP)")

    if not QUIET:
        print("-" * 60)
    if res.passed():
        print(f"[✓] PREFLIGHT PASSED ({len(res.warnings)} warning(s)) — ready to mine")
        return 0
    print(f"[✗] PREFLIGHT FAILED: {len(res.failures)} hard failure(s), {len(res.warnings)} warning(s)")
    return 1


if __name__ == "__main__":
    sys.exit(main())
