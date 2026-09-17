/**
 * Cryptographic routines for Bitcoin Double-SHA256 and
 * the 8-to-4 character XOR folding compression algorithm.
 */

// Initial SHA-256 state values
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
  0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
  0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
  0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
  0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
  0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
]);

function rotr(n: number, x: number): number {
  return (x >>> n) | (x << (32 - n));
}

function sha256Block(w: Uint32Array, h: Uint32Array) {
  let a = h[0], b = h[1], c = h[2], d = h[3];
  let e = h[4], f = h[5], g = h[6], h_val = h[7];

  for (let i = 0; i < 64; i++) {
    if (i >= 16) {
      const s0 = rotr(7, w[i - 15]) ^ rotr(18, w[i - 15]) ^ (w[i - 15] >>> 3);
      const s1 = rotr(17, w[i - 2]) ^ rotr(19, w[i - 2]) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    const ch = (e & f) ^ (~e & g);
    const maj = (a & b) ^ (a & c) ^ (b & c);
    const temp1 = (h_val + (rotr(6, e) ^ rotr(11, e) ^ rotr(25, e)) + ch + K[i] + w[i]) >>> 0;
    const temp2 = ((rotr(2, a) ^ rotr(13, a) ^ rotr(22, a)) + maj) >>> 0;

    h_val = g;
    g = f;
    f = e;
    e = (d + temp1) >>> 0;
    d = c;
    c = b;
    b = a;
    a = (temp1 + temp2) >>> 0;
  }

  h[0] = (h[0] + a) >>> 0;
  h[1] = (h[1] + b) >>> 0;
  h[2] = (h[2] + c) >>> 0;
  h[3] = (h[3] + d) >>> 0;
  h[4] = (h[4] + e) >>> 0;
  h[5] = (h[5] + f) >>> 0;
  h[6] = (h[6] + g) >>> 0;
  h[7] = (h[7] + h_val) >>> 0;
}

const textEncoder = new TextEncoder();
const wBuffer = new Uint32Array(64);

/**
 * Computes single SHA-256 on byte array, returning Uint8Array of 32 bytes
 */
export function sha256Bytes(data: Uint8Array): Uint8Array {
  const h = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ]);

  const bitLength = data.length * 8;
  // Pad data
  const totalLength = ((data.length + 9 + 63) >>> 6) << 6;
  const padded = new Uint8Array(totalLength);
  padded.set(data);
  padded[data.length] = 0x80;

  const view = new DataView(padded.buffer);
  // write 64-bit length in big-endian
  view.setUint32(totalLength - 4, bitLength >>> 0);
  view.setUint32(totalLength - 8, Math.floor(bitLength / 0x100000000));

  for (let offset = 0; offset < totalLength; offset += 64) {
    for (let i = 0; i < 16; i++) {
      wBuffer[i] = view.getUint32(offset + i * 4);
    }
    sha256Block(wBuffer, h);
  }

  const result = new Uint8Array(32);
  const resView = new DataView(result.buffer);
  for (let i = 0; i < 8; i++) {
    resView.setUint32(i * 4, h[i]);
  }
  return result;
}

/**
 * Standard Bitcoin Double-SHA256 (SHA256(SHA256(str)))
 * Returns 64-character lowercase hex string
 */
export function doubleSha256(input: string): string {
  const bytes = textEncoder.encode(input);
  const first = sha256Bytes(bytes);
  const second = sha256Bytes(first);
  
  let hex = '';
  for (let i = 0; i < second.length; i++) {
    hex += second[i].toString(16).padStart(2, '0');
  }
  return hex;
}

/**
 * Shrinks an 8-character hex chunk down to 4 characters using XOR folding.
 * Exactly mirrors Python:
 *   part1 = int(chunk_8[:4], 16)
 *   part2 = int(chunk_8[4:], 16)
 *   folded = part1 ^ part2
 *   return format(folded, '04x')
 */
export function shrinkChunk8to4(chunk8: string): string {
  if (chunk8.length < 8) {
    chunk8 = chunk8.padEnd(8, '0');
  }
  const part1 = parseInt(chunk8.slice(0, 4), 16) || 0;
  const part2 = parseInt(chunk8.slice(4, 8), 16) || 0;
  const folded = (part1 ^ part2) & 0xffff;
  return folded.toString(16).padStart(4, '0');
}

/**
 * Compresses 64-character hex into 32-character hex by stepping in 8-char chunks
 */
export function compressFullHash(fullHash: string): string {
  let compressed = '';
  for (let i = 0; i < fullHash.length; i += 8) {
    const chunk8 = fullHash.slice(i, i + 8);
    compressed += shrinkChunk8to4(chunk8);
  }
  return compressed;
}

/**
 * Generates an in-depth bitwise inspection of all 8 chunks for visual analysis
 */
export function inspectAllChunks(fullHash: string) {
  const padded = fullHash.padEnd(64, '0').slice(0, 64);
  const chunks = [];

  for (let i = 0; i < 8; i++) {
    const start = i * 8;
    const chunk8 = padded.slice(start, start + 8);
    const p1Hex = chunk8.slice(0, 4);
    const p2Hex = chunk8.slice(4, 8);
    const p1Int = parseInt(p1Hex, 16) || 0;
    const p2Int = parseInt(p2Hex, 16) || 0;
    const foldedInt = (p1Int ^ p2Int) & 0xffff;
    const foldedHex = foldedInt.toString(16).padStart(4, '0');

    chunks.push({
      index: i,
      chunk8,
      part1Hex: p1Hex,
      part1Int: p1Int,
      part1Bin: p1Int.toString(2).padStart(16, '0'),
      part2Hex: p2Hex,
      part2Int: p2Int,
      part2Bin: p2Int.toString(2).padStart(16, '0'),
      foldedHex,
      foldedInt,
      foldedBin: foldedInt.toString(2).padStart(16, '0'),
    });
  }

  return chunks;
}
