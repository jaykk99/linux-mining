/**
 * Types for Linux BTC 8-to-4 Compressed Miner
 */

export interface MinerConfig {
  headerTemplate: string;
  targetPattern: string;
  batchSize: number; // hashes per loop
  threads: number;
}

export interface MinedBlock {
  id: string;
  nonce: number;
  fullHash: string;
  compressedHash: string;
  targetMatched: string;
  timestamp: number;
  timeTakenSec: number;
  avgHashRateKHS: number;
  blockData: string;
}

export interface ChunkInspection {
  index: number;
  chunk8: string;
  part1Hex: string;
  part1Int: number;
  part1Bin: string;
  part2Hex: string;
  part2Int: number;
  part2Bin: string;
  foldedHex: string;
  foldedInt: number;
  foldedBin: string;
}

export interface MiningStats {
  nonce: number;
  hashRate: number; // in H/s
  elapsedSec: number;
  currentFullHash: string;
  currentCompressedHash: string;
  totalMatches: number;
  isMining: boolean;
}

export interface TerminalLine {
  id: string;
  text: string;
  type: 'info' | 'success' | 'warn' | 'dim' | 'prompt';
  timestamp: string;
}
