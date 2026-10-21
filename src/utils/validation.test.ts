// Tests for src/utils/validation.ts. Run: npx tsx --test src/utils/validation.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parsePool,
  validateWallet,
  validatePattern,
  validateThreads,
  validateEngine,
  validateRigConfig,
  patternOdds,
  exportRigConfigJson,
  defaultRigConfig,
} from "./validation.js";

describe("parsePool", () => {
  it("parses host:port", () => {
    assert.deepEqual(parsePool("solo.ckpool.org:3333"), { host: "solo.ckpool.org", port: 3333 });
  });
  it("defaults the port", () => {
    assert.deepEqual(parsePool("example.com"), { host: "example.com", port: 3333 });
  });
  it("parses [ipv6]:port", () => {
    assert.deepEqual(parsePool("[::1]:9000"), { host: "::1", port: 9000 });
  });
  it("rejects bad input", () => {
    for (const bad of ["", "h:abc", "h:0", "h:99999", ":3333", "::1", "[::1]"]) {
      assert.throws(() => parsePool(bad), Error, bad);
    }
  });
});

describe("validateWallet", () => {
  it("accepts legacy + bech32", () => {
    assert.equal(validateWallet("1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"), "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa");
    assert.equal(validateWallet("bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4"), "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4");
  });
  it("rejects empty/garbage", () => {
    assert.throws(() => validateWallet(""), /empty/);
    assert.throws(() => validateWallet("not-a-wallet"), /unrecognized/);
    assert.throws(() => validateWallet("1short"), /sanity/);
  });
});

describe("validatePattern", () => {
  it("normalizes to lowercase", () => {
    assert.equal(validatePattern("AABB"), "aabb");
  });
  it("rejects bad patterns", () => {
    for (const bad of ["", "zz11", "a".repeat(9), "12 34"]) {
      assert.throws(() => validatePattern(bad), Error, bad);
    }
  });
});

describe("validateThreads", () => {
  it("accepts in-range ints", () => {
    assert.equal(validateThreads(4, 8), 4);
    assert.equal(validateThreads("2", 8), 2);
  });
  it("rejects out-of-range", () => {
    assert.throws(() => validateThreads(0, 8), /1\.\.16/);
    assert.throws(() => validateThreads(17, 8), /1\.\.16/);
    assert.throws(() => validateThreads(1.5, 8), /integer/);
    assert.throws(() => validateThreads("lots", 8), /integer/);
  });
});

describe("validateEngine", () => {
  it("accepts python/c/auto, case-insensitive", () => {
    assert.equal(validateEngine("C"), "c");
    assert.equal(validateEngine("auto"), "auto");
  });
  it("rejects unknown", () => {
    assert.throws(() => validateEngine("fpga"), /python, c, or auto/);
  });
});

describe("validateRigConfig", () => {
  it("valid config has no errors", () => {
    const { config, errors } = validateRigConfig(
      {
        pool: "solo.ckpool.org:3333",
        wallet: "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
        pattern: "1122",
        threads: 2,
        engine: "c",
      },
      8,
    );
    assert.equal(errors.length, 0);
    assert.equal(config.pool, "solo.ckpool.org:3333");
    assert.equal(config.engine, "c");
  });
  it("collects every field problem", () => {
    const { errors } = validateRigConfig(
      { pool: "", wallet: "bad", pattern: "zz", threads: 0, engine: "fpga" as unknown as "auto" },
      8,
    );
    const fields = errors.map((e) => e.field).sort();
    assert.deepEqual(fields, ["engine", "pattern", "pool", "threads", "wallet"]);
  });
  it("applies defaults for missing fields", () => {
    const { config, errors } = validateRigConfig(
      { pool: "h:1", wallet: "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa" },
      8,
    );
    assert.equal(errors.length, 0);
    assert.equal(config.pattern, "1122");
    assert.equal(config.engine, "auto");
  });
});

describe("patternOdds", () => {
  it("computes odds", () => {
    assert.equal(patternOdds("1122"), "~1 in 65,536 hashes");
  });
  it("handles invalid", () => {
    assert.equal(patternOdds("zz"), "invalid pattern");
  });
});

describe("exportRigConfigJson", () => {
  it("matches the preflight --config schema", () => {
    const cfg = {
      ...defaultRigConfig(),
      pool: "h:3333",
      wallet: "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
      pattern: "ab12",
      threads: 3,
      engine: "python" as const,
    };
    const parsed = JSON.parse(exportRigConfigJson(cfg));
    assert.deepEqual(Object.keys(parsed).sort(), ["engine", "pattern", "pool", "threads", "wallet"]);
    assert.equal(parsed.pattern, "ab12");
  });
});
