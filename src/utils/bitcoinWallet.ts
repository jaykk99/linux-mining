/**
 * Pure TypeScript Bitcoin Wallet Generator & Formatter
 * Implements SECP256k1 public key derivation, SHA-256, RIPEMD-160,
 * Base58Check (Legacy P2PKH '1...') and Bech32 (SegWit P2WPKH 'bc1q...')
 */

export interface GeneratedWallet {
  address: string;
  segwitAddress: string;
  privateKeyHex: string;
  wif: string;
  publicKeyHex: string;
  createdTimestamp: number;
}

// SECP256k1 constants (BigInt)
const P = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F');
const A = BigInt(0);
const B = BigInt(7);
const Gx = BigInt('0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798');
const Gy = BigInt('0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8');
const N = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BB5BF5670D9430E44');

// Modulo inverse using Extended Euclidean Algorithm
function modInverse(k: bigint, m: bigint): bigint {
  if (k === BigInt(0)) return BigInt(0);
  let lm = BigInt(1), hm = BigInt(0);
  let low = ((k % m) + m) % m, high = m;
  while (low > BigInt(1)) {
    const ratio = high / low;
    const nm = hm - ratio * lm;
    const newLow = high - ratio * low;
    hm = lm;
    lm = nm;
    high = low;
    low = newLow;
  }
  return ((lm % m) + m) % m;
}

// Elliptic curve point addition
function pointAdd(x1: bigint, y1: bigint, x2: bigint, y2: bigint): [bigint, bigint] {
  if (x1 === BigInt(0) && y1 === BigInt(0)) return [x2, y2];
  if (x2 === BigInt(0) && y2 === BigInt(0)) return [x1, y1];
  if (x1 === x2 && y1 !== y2) return [BigInt(0), BigInt(0)];

  let m: bigint;
  if (x1 === x2 && y1 === y2) {
    m = ((BigInt(3) * x1 * x1 + A) * modInverse(BigInt(2) * y1, P)) % P;
  } else {
    m = ((y2 - y1) * modInverse(x2 - x1, P)) % P;
  }
  m = ((m % P) + P) % P;

  const x3 = ((m * m - x1 - x2) % P + P) % P;
  const y3 = ((m * (x1 - x3) - y1) % P + P) % P;
  return [x3, y3];
}

// Scalar multiplication (double and add)
function scalarMult(k: bigint, x: bigint, y: bigint): [bigint, bigint] {
  let rx = BigInt(0), ry = BigInt(0);
  let qx = x, qy = y;
  let scalar = k;

  while (scalar > BigInt(0)) {
    if (scalar & BigInt(1)) {
      [rx, ry] = pointAdd(rx, ry, qx, qy);
    }
    [qx, qy] = pointAdd(qx, qy, qx, qy);
    scalar >>= BigInt(1);
  }
  return [rx, ry];
}

// Pure RIPEMD-160 implementation
function ripemd160(message: Uint8Array): Uint8Array {
  const zl = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 7, 4, 13, 1, 10, 6, 15, 3, 12, 0, 9, 5, 2, 14, 11, 8, 3, 10, 14, 4, 9, 15, 8, 1, 2, 7, 0, 6, 13, 11, 5, 12, 1, 9, 11, 10, 0, 8, 12, 4, 13, 3, 7, 15, 14, 5, 6, 2, 4, 0, 5, 9, 7, 12, 2, 10, 14, 1, 3, 8, 11, 6, 15, 13];
  const zr = [5, 14, 7, 0, 9, 2, 11, 4, 13, 6, 15, 8, 1, 10, 3, 12, 6, 11, 3, 7, 0, 13, 5, 10, 14, 15, 8, 12, 4, 9, 1, 2, 15, 5, 1, 3, 7, 14, 6, 9, 11, 8, 12, 2, 10, 0, 4, 13, 8, 6, 4, 1, 3, 11, 15, 0, 5, 12, 2, 13, 9, 7, 10, 14, 12, 15, 10, 4, 1, 5, 8, 7, 6, 2, 13, 14, 0, 3, 9, 11];
  const sl = [11, 14, 15, 12, 5, 8, 7, 9, 11, 13, 14, 15, 6, 7, 9, 8, 7, 6, 8, 13, 11, 9, 7, 15, 7, 12, 15, 9, 11, 7, 13, 12, 11, 13, 6, 7, 14, 9, 13, 15, 14, 8, 13, 6, 5, 12, 7, 5, 11, 12, 14, 15, 14, 15, 9, 8, 9, 14, 5, 6, 8, 6, 5, 12, 9, 15, 5, 11, 6, 8, 13, 12, 5, 12, 13, 14, 11, 8, 5, 6];
  const sr = [8, 9, 9, 11, 13, 15, 15, 5, 7, 7, 8, 11, 14, 14, 12, 6, 9, 13, 15, 7, 12, 8, 9, 11, 7, 7, 12, 7, 6, 15, 13, 11, 9, 7, 15, 11, 8, 6, 6, 14, 12, 13, 5, 14, 13, 13, 7, 5, 15, 5, 8, 11, 14, 14, 6, 14, 6, 9, 12, 9, 12, 5, 15, 8, 8, 5, 12, 9, 12, 5, 14, 6, 8, 13, 6, 5, 15, 13, 11, 11];
  const hl = [0x00000000, 0x5a827999, 0x6ed9eba1, 0x8f1bbcdc, 0xa953fd4e];
  const hr = [0x50a28be6, 0x5c4dd124, 0x6d703ef3, 0x7a6d76e9, 0x00000000];

  const padLen = (message.length + 8 + 64) & ~63;
  const padded = new Uint8Array(padLen);
  padded.set(message);
  padded[message.length] = 0x80;
  const bitLen = message.length * 8;
  padded[padLen - 8] = bitLen & 0xff;
  padded[padLen - 7] = (bitLen >>> 8) & 0xff;
  padded[padLen - 6] = (bitLen >>> 16) & 0xff;
  padded[padLen - 5] = (bitLen >>> 24) & 0xff;

  let h0 = 0x67452301, h1 = 0xefcdab89, h2 = 0x98badcfe, h3 = 0x10325476, h4 = 0xc3d2e1f0;

  for (let o = 0; o < padLen; o += 64) {
    const w = new Uint32Array(16);
    for (let i = 0; i < 16; i++) {
      w[i] = padded[o + i * 4] | (padded[o + i * 4 + 1] << 8) | (padded[o + i * 4 + 2] << 16) | (padded[o + i * 4 + 3] << 24);
    }

    let al = h0, bl = h1, cl = h2, dl = h3, el = h4;
    let ar = h0, br = h1, cr = h2, dr = h3, er = h4;

    for (let i = 0; i < 80; i++) {
      const g = Math.floor(i / 16);
      let fl = 0, fr = 0;
      if (g === 0) {
        fl = (bl ^ cl ^ dl) >>> 0;
        fr = (br ^ (cr | ~dr)) >>> 0;
      } else if (g === 1) {
        fl = ((bl & cl) | (~bl & dl)) >>> 0;
        fr = ((br & dr) | (cr & ~dr)) >>> 0;
      } else if (g === 2) {
        fl = ((bl | ~cl) ^ dl) >>> 0;
        fr = ((br | ~cr) ^ dr) >>> 0;
      } else if (g === 3) {
        fl = ((bl & dl) | (cl & ~dl)) >>> 0;
        fr = ((br & cr) | (~br & dr)) >>> 0;
      } else {
        fl = (bl ^ (cl | ~dl)) >>> 0;
        fr = (br ^ cr ^ dr) >>> 0;
      }

      let tl = (al + fl + w[zl[i]] + hl[g]) >>> 0;
      tl = ((tl << sl[i]) | (tl >>> (32 - sl[i]))) >>> 0;
      tl = (tl + el) >>> 0;
      al = el; el = dl; dl = ((cl << 10) | (cl >>> 22)) >>> 0; cl = bl; bl = tl;

      let tr = (ar + fr + w[zr[i]] + hr[g]) >>> 0;
      tr = ((tr << sr[i]) | (tr >>> (32 - sr[i]))) >>> 0;
      tr = (tr + er) >>> 0;
      ar = er; er = dr; dr = ((cr << 10) | (cr >>> 22)) >>> 0; cr = br; br = tr;
    }

    const t = (h1 + cl + dr) >>> 0;
    h1 = (h2 + dl + er) >>> 0;
    h2 = (h3 + el + ar) >>> 0;
    h3 = (h4 + al + br) >>> 0;
    h4 = (h0 + bl + cr) >>> 0;
    h0 = t;
  }

  const out = new Uint8Array(20);
  const words = [h0, h1, h2, h3, h4];
  for (let i = 0; i < 5; i++) {
    out[i * 4] = words[i] & 0xff;
    out[i * 4 + 1] = (words[i] >>> 8) & 0xff;
    out[i * 4 + 2] = (words[i] >>> 16) & 0xff;
    out[i * 4 + 3] = (words[i] >>> 24) & 0xff;
  }
  return out;
}

// Synchronous SHA-256 implementation
function sha256Sync(data: Uint8Array): Uint8Array {
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0x0bef9a3f, 0xc67178f2
  ];

  const rotr = (x: number, n: number) => ((x >>> n) | (x << (32 - n))) >>> 0;
  const ch = (x: number, y: number, z: number) => ((x & y) ^ (~x & z)) >>> 0;
  const maj = (x: number, y: number, z: number) => ((x & y) ^ (x & z) ^ (y & z)) >>> 0;
  const sigma0 = (x: number) => (rotr(x, 2) ^ rotr(x, 13) ^ rotr(x, 22)) >>> 0;
  const sigma1 = (x: number) => (rotr(x, 6) ^ rotr(x, 11) ^ rotr(x, 25)) >>> 0;
  const gamma0 = (x: number) => (rotr(x, 7) ^ rotr(x, 18) ^ (x >>> 3)) >>> 0;
  const gamma1 = (x: number) => (rotr(x, 17) ^ rotr(x, 19) ^ (x >>> 10)) >>> 0;

  const padLen = (data.length + 9 + 63) & ~63;
  const padded = new Uint8Array(padLen);
  padded.set(data);
  padded[data.length] = 0x80;
  const bitLen = BigInt(data.length) * BigInt(8);
  for (let i = 0; i < 8; i++) {
    padded[padLen - 1 - i] = Number((bitLen >> BigInt(i * 8)) & BigInt(0xff));
  }

  let [h0, h1, h2, h3, h4, h5, h6, h7] = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ];

  const W = new Uint32Array(64);
  for (let o = 0; o < padLen; o += 64) {
    for (let i = 0; i < 16; i++) {
      W[i] = (padded[o + i * 4] << 24) | (padded[o + i * 4 + 1] << 16) | (padded[o + i * 4 + 2] << 8) | padded[o + i * 4 + 3];
    }
    for (let i = 16; i < 64; i++) {
      W[i] = (W[i - 16] + gamma0(W[i - 15]) + W[i - 7] + gamma1(W[i - 2])) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = [h0, h1, h2, h3, h4, h5, h6, h7];
    for (let i = 0; i < 64; i++) {
      const T1 = (h + sigma1(e) + ch(e, f, g) + K[i] + W[i]) >>> 0;
      const T2 = (sigma0(a) + maj(a, b, c)) >>> 0;
      h = g; g = f; f = e; e = (d + T1) >>> 0;
      d = c; c = b; b = a; a = (T1 + T2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  const res = new Uint8Array(32);
  const state = [h0, h1, h2, h3, h4, h5, h6, h7];
  for (let i = 0; i < 8; i++) {
    res[i * 4] = (state[i] >>> 24) & 0xff;
    res[i * 4 + 1] = (state[i] >>> 16) & 0xff;
    res[i * 4 + 2] = (state[i] >>> 8) & 0xff;
    res[i * 4 + 3] = state[i] & 0xff;
  }
  return res;
}

// Base58 Alphabet
const B58_CHARS = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function base58Encode(bytes: Uint8Array): string {
  let x = BigInt(0);
  for (const b of bytes) {
    x = (x << BigInt(8)) + BigInt(b);
  }

  let res = '';
  while (x > BigInt(0)) {
    const rem = Number(x % BigInt(58));
    x /= BigInt(58);
    res = B58_CHARS[rem] + res;
  }

  // Leading zeros
  for (let i = 0; i < bytes.length && bytes[i] === 0; i++) {
    res = '1' + res;
  }
  return res;
}

function base58Check(payload: Uint8Array): string {
  const hash1 = sha256Sync(payload);
  const hash2 = sha256Sync(hash1);
  const checksum = hash2.slice(0, 4);
  const combined = new Uint8Array(payload.length + 4);
  combined.set(payload);
  combined.set(checksum, payload.length);
  return base58Encode(combined);
}

// Bech32 encoding for SegWit native (P2WPKH)
const BECH32_CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

function bech32Polymod(values: number[]): number {
  const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  let chk = 1;
  for (const v of values) {
    const b = chk >> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ v;
    for (let i = 0; i < 5; i++) {
      if ((b >> i) & 1) chk ^= GEN[i];
    }
  }
  return chk;
}

function bech32HrpExpand(hrp: string): number[] {
  const ret: number[] = [];
  for (let i = 0; i < hrp.length; i++) ret.push(hrp.charCodeAt(i) >> 5);
  ret.push(0);
  for (let i = 0; i < hrp.length; i++) ret.push(hrp.charCodeAt(i) & 31);
  return ret;
}

function convertBits(data: Uint8Array, frombits: number, tobits: number, pad: boolean): number[] {
  let acc = 0;
  let bits = 0;
  const ret: number[] = [];
  const maxv = (1 << tobits) - 1;
  for (let p = 0; p < data.length; ++p) {
    const value = data[p];
    acc = (acc << frombits) | value;
    bits += frombits;
    while (bits >= tobits) {
      bits -= tobits;
      ret.push((acc >> bits) & maxv);
    }
  }
  if (pad) {
    if (bits > 0) {
      ret.push((acc << (tobits - bits)) & maxv);
    }
  }
  return ret;
}

function encodeSegwitAddress(hrp: string, version: number, program: Uint8Array): string {
  const data = [version].concat(convertBits(program, 8, 5, true));
  const combined = bech32HrpExpand(hrp).concat(data).concat([0, 0, 0, 0, 0, 0]);
  const mod = bech32Polymod(combined) ^ 1;
  const ret: number[] = [];
  for (let p = 0; p < 6; ++p) {
    ret.push((mod >> (5 * (5 - p))) & 31);
  }
  return hrp + '1' + data.concat(ret).map((x) => BECH32_CHARSET[x]).join('');
}

/**
 * Generates a brand new, cryptographically secure Bitcoin wallet (Legacy + SegWit)
 */
export function generateBitcoinWallet(): GeneratedWallet {
  // 1. Generate 32 bytes of secure random entropy
  const privKeyBytes = new Uint8Array(32);
  crypto.getRandomValues(privKeyBytes);

  let privBigInt = BigInt('0x' + Array.from(privKeyBytes).map((b) => b.toString(16).padStart(2, '0')).join(''));
  // Ensure scalar < N
  privBigInt = (privBigInt % (N - BigInt(1))) + BigInt(1);

  const privHex = privBigInt.toString(16).padStart(64, '0');

  // 2. Derive Public Key via secp256k1
  const [pubX, pubY] = scalarMult(privBigInt, Gx, Gy);

  // Compressed public key: 0x02 if Y is even, 0x03 if odd
  const prefix = pubY % BigInt(2) === BigInt(0) ? '02' : '03';
  const pubXHex = pubX.toString(16).padStart(64, '0');
  const compressedPubHex = prefix + pubXHex;
  const compressedPubBytes = new Uint8Array(
    compressedPubHex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
  );

  // 3. Hash160 = RIPEMD160(SHA256(PubKey))
  const sha = sha256Sync(compressedPubBytes);
  const hash160 = ripemd160(sha);

  // 4. Legacy P2PKH address: 0x00 + hash160 + checksum -> Base58
  const legacyPayload = new Uint8Array(21);
  legacyPayload[0] = 0x00; // Mainnet network byte
  legacyPayload.set(hash160, 1);
  const address = base58Check(legacyPayload);

  // 5. SegWit Native address (P2WPKH: bc1q...)
  const segwitAddress = encodeSegwitAddress('bc', 0, hash160);

  // 6. WIF (Wallet Import Format for private key, compressed: 0x80 + privKey + 0x01 + checksum)
  const wifPayload = new Uint8Array(34);
  wifPayload[0] = 0x80; // Mainnet private key prefix
  wifPayload.set(new Uint8Array(privHex.match(/.{1,2}/g)!.map((b) => parseInt(b, 16))), 1);
  wifPayload[33] = 0x01; // Compressed flag
  const wif = base58Check(wifPayload);

  return {
    address,
    segwitAddress,
    privateKeyHex: privHex,
    wif,
    publicKeyHex: compressedPubHex,
    createdTimestamp: Date.now(),
  };
}

const WALLET_STORAGE_KEY = 'btc_solo_pool_configured_wallet';

export function getSavedWallet(): string {
  try {
    const saved = localStorage.getItem(WALLET_STORAGE_KEY);
    if (saved && (saved.startsWith('1') || saved.startsWith('3') || saved.startsWith('bc1'))) {
      return saved.trim();
    }
  } catch {
    // ignore
  }
  // Default legacy Genesis block address if none set
  return '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa';
}

export function saveWallet(address: string): void {
  try {
    localStorage.setItem(WALLET_STORAGE_KEY, address.trim());
  } catch {
    // ignore
  }
}
