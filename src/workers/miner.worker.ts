/**
 * Web Worker for high-throughput double-SHA256 and 8-to-4 folding
 */

// SHA-256 implementation inside Worker for maximum performance
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

function sha256Bytes(data: Uint8Array): Uint8Array {
  const h = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ]);

  const bitLength = data.length * 8;
  const totalLength = ((data.length + 9 + 63) >>> 6) << 6;
  const padded = new Uint8Array(totalLength);
  padded.set(data);
  padded[data.length] = 0x80;

  const view = new DataView(padded.buffer);
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

function doubleSha256Raw(inputBytes: Uint8Array): Uint8Array {
  const first = sha256Bytes(inputBytes);
  return sha256Bytes(first);
}

function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

// Fast word-level 8-to-4 XOR folding directly on 32-byte binary output (bypasses string slicing & parsing)
function fold32BytesTo16Words(bytes: Uint8Array): Uint16Array {
  const folded = new Uint16Array(8);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let i = 0; i < 8; i++) {
    const word32 = view.getUint32(i * 4, false);
    folded[i] = ((word32 >>> 16) ^ (word32 & 0xffff)) & 0xffff;
  }
  return folded;
}

function foldedWordsToHex(folded: Uint16Array): string {
  let hex = '';
  for (let i = 0; i < 8; i++) {
    hex += folded[i].toString(16).padStart(4, '0');
  }
  return hex;
}

let isMining = false;
let headerTemplate = 'BLOCK_DATA_JAY_OMER_LINUX_NODE_2026';
let targetPattern = '1122';
let currentNonce = 0;
let startTime = 0;
let lastReportTime = 0;
let lastReportNonce = 0;
let pauseOnMatch = false;

// Pre-compiled prefix byte buffer
let pfxBytes: Uint8Array = textEncoder.encode(`${headerTemplate}:`);
// Pre-allocated work buffer for blockData
const workBuf = new Uint8Array(256);

function updatePrefixBuffer() {
  const pfx = textEncoder.encode(`${headerTemplate}:`);
  pfxBytes = pfx;
  workBuf.set(pfxBytes, 0);
}

function mineLoop() {
  if (!isMining) return;

  const batchSize = 2500;
  const now = performance.now();
  const pfxLen = pfxBytes.length;
  const targetLen = targetPattern.length;

  for (let i = 0; i < batchSize; i++) {
    // Write nonce as ASCII numbers directly into work buffer without string concatenation
    let n = currentNonce;
    let digitCount = 0;
    let temp = n;
    if (temp === 0) digitCount = 1;
    else {
      while (temp > 0) {
        digitCount++;
        temp = (temp / 10) | 0;
      }
    }

    let pos = pfxLen + digitCount - 1;
    temp = n;
    if (temp === 0) {
      workBuf[pfxLen] = 48; // '0'
    } else {
      while (temp > 0) {
        workBuf[pos--] = 48 + (temp % 10);
        temp = (temp / 10) | 0;
      }
    }
    const totalInputLen = pfxLen + digitCount;
    const inputSlice = workBuf.subarray(0, totalInputLen);

    const hashBytes = doubleSha256Raw(inputSlice);
    const folded = fold32BytesTo16Words(hashBytes);

    // Fast check first 16 bits / 4 hex chars in 1 CPU operation
    // targetPattern: "1122" -> int: 0x1122
    let matched = false;
    if (targetLen <= 4) {
      const targetInt = parseInt(targetPattern.padEnd(4, '0'), 16);
      const mask = 0xffff >>> ((4 - targetLen) * 4);
      const shift = (4 - targetLen) * 4;
      matched = ((folded[0] >>> shift) === (targetInt >>> shift));
    } else {
      const compHex = foldedWordsToHex(folded);
      matched = compHex.startsWith(targetPattern.toLowerCase());
    }

    if (matched) {
      const compHex = foldedWordsToHex(folded);
      const fullHex = bytesToHex(hashBytes);
      const blockData = `${headerTemplate}:${currentNonce}`;
      const elapsedTotal = (performance.now() - startTime) / 1000;
      const khs = elapsedTotal > 0 ? (currentNonce / elapsedTotal) / 1000 : 0;

      self.postMessage({
        type: 'MATCH_FOUND',
        payload: {
          nonce: currentNonce,
          fullHash: fullHex,
          compressedHash: compHex,
          targetMatched: targetPattern,
          elapsedSec: elapsedTotal,
          avgHashRateKHS: khs,
          blockData,
          timestamp: Date.now(),
        }
      });

      if (pauseOnMatch) {
        isMining = false;
        self.postMessage({ type: 'STATUS_CHANGED', isMining: false });
        return;
      }
    }

    currentNonce++;
  }

  // Periodic throttle report (~ every 120ms)
  if (now - lastReportTime >= 120) {
    const timeDeltaSec = (now - lastReportTime) / 1000;
    const nonceDelta = currentNonce - lastReportNonce;
    const currentHashRate = timeDeltaSec > 0 ? nonceDelta / timeDeltaSec : 0;
    const totalElapsed = (now - startTime) / 1000;

    // Grab a sample candidate for UI visualization
    const sampleData = `${headerTemplate}:${currentNonce}`;
    const sampleBytes = textEncoder.encode(sampleData);
    const sampleHash = doubleSha256Raw(sampleBytes);
    const sampleFolded = fold32BytesTo16Words(sampleHash);
    const sampleFull = bytesToHex(sampleHash);
    const sampleComp = foldedWordsToHex(sampleFolded);

    self.postMessage({
      type: 'PROGRESS',
      payload: {
        nonce: currentNonce,
        hashRate: currentHashRate,
        elapsedSec: totalElapsed,
        currentFullHash: sampleFull,
        currentCompressedHash: sampleComp,
      }
    });

    lastReportTime = now;
    lastReportNonce = currentNonce;
  }

  if (isMining) {
    setTimeout(mineLoop, 0);
  }
}

self.onmessage = (event) => {
  const { type, payload } = event.data;

  switch (type) {
    case 'START':
      if (payload) {
        if (payload.headerTemplate) headerTemplate = payload.headerTemplate;
        if (payload.targetPattern) targetPattern = payload.targetPattern;
        if (typeof payload.nonce === 'number') currentNonce = payload.nonce;
        if (typeof payload.pauseOnMatch === 'boolean') pauseOnMatch = payload.pauseOnMatch;
      }
      updatePrefixBuffer();
      isMining = true;
      startTime = performance.now();
      lastReportTime = startTime;
      lastReportNonce = currentNonce;
      self.postMessage({ type: 'STATUS_CHANGED', isMining: true });
      mineLoop();
      break;

    case 'PAUSE':
      isMining = false;
      self.postMessage({ type: 'STATUS_CHANGED', isMining: false });
      break;

    case 'RESET':
      isMining = false;
      currentNonce = 0;
      startTime = 0;
      self.postMessage({ type: 'STATUS_CHANGED', isMining: false });
      self.postMessage({
        type: 'PROGRESS',
        payload: {
          nonce: 0,
          hashRate: 0,
          elapsedSec: 0,
          currentFullHash: '',
          currentCompressedHash: '',
        }
      });
      break;

    case 'UPDATE_CONFIG':
      if (payload.headerTemplate) headerTemplate = payload.headerTemplate;
      if (payload.targetPattern) targetPattern = payload.targetPattern;
      if (typeof payload.pauseOnMatch === 'boolean') pauseOnMatch = payload.pauseOnMatch;
      updatePrefixBuffer();
      break;

    default:
      break;
  }
};
