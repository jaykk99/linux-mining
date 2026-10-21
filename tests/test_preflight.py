#!/usr/bin/env python3
"""Unit tests for preflight.py — pure validation logic, no network, no mining.

Run: python3 -m unittest discover -s tests -v
"""
import json
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import preflight


class QuietMixin:
    def setUp(self):
        self._quiet = preflight.QUIET
        preflight.QUIET = True  # keep test output clean

    def tearDown(self):
        preflight.QUIET = self._quiet


class TestCheckResult(QuietMixin, unittest.TestCase):
    def test_passed_with_warnings(self):
        r = preflight.CheckResult()
        r.ok("a")
        r.warn("b", "careful")
        self.assertTrue(r.passed())
        self.assertEqual(r.warnings, ["b"])
        self.assertEqual(r.failures, [])

    def test_failed(self):
        r = preflight.CheckResult()
        r.fail("c", "broken")
        self.assertFalse(r.passed())
        self.assertEqual(r.failures, ["c"])


class TestParsePool(unittest.TestCase):
    def test_host_port(self):
        self.assertEqual(preflight.parse_pool("solo.ckpool.org:3333"),
                         ("solo.ckpool.org", 3333))

    def test_default_port(self):
        self.assertEqual(preflight.parse_pool("example.com"), ("example.com", 3333))

    def test_ipv6_brackets(self):
        self.assertEqual(preflight.parse_pool("[::1]:3333"), ("::1", 3333))

    def test_bad_port(self):
        with self.assertRaises(ValueError):
            preflight.parse_pool("example.com:abc")

    def test_port_range(self):
        with self.assertRaises(ValueError):
            preflight.parse_pool("example.com:0")
        with self.assertRaises(ValueError):
            preflight.parse_pool("example.com:99999")

    def test_empty(self):
        with self.assertRaises(ValueError):
            preflight.parse_pool("")

    def test_bare_ipv6_rejected(self):
        with self.assertRaises(ValueError):
            preflight.parse_pool("::1")


class TestValidateThreads(unittest.TestCase):
    def test_valid(self):
        self.assertEqual(preflight.validate_threads(4), 4)
        self.assertEqual(preflight.validate_threads("2"), 2)

    def test_zero_rejected(self):
        with self.assertRaises(ValueError):
            preflight.validate_threads(0)

    def test_huge_rejected(self):
        with self.assertRaises(ValueError):
            preflight.validate_threads(10 ** 9)

    def test_non_integer_rejected(self):
        with self.assertRaises(ValueError):
            preflight.validate_threads("lots")


class TestValidateWallet(unittest.TestCase):
    def test_legacy_ok(self):
        self.assertEqual(
            preflight.validate_wallet_strict("1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"),
            "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa")

    def test_bech32_ok(self):
        addr = "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4"
        self.assertEqual(preflight.validate_wallet_strict(addr), addr)

    def test_empty_rejected(self):
        with self.assertRaises(ValueError):
            preflight.validate_wallet_strict("")

    def test_garbage_rejected(self):
        with self.assertRaises(ValueError):
            preflight.validate_wallet_strict("not-a-wallet")

    def test_whitespace_trimmed(self):
        self.assertEqual(
            preflight.validate_wallet_strict("  1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa\n"),
            "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa")


class TestValidatePattern(unittest.TestCase):
    def test_valid(self):
        self.assertEqual(preflight.validate_pattern_strict("1122"), "1122")
        self.assertEqual(preflight.validate_pattern_strict("AABBCC"), "aabbcc")

    def test_bad_chars(self):
        with self.assertRaises(ValueError):
            preflight.validate_pattern_strict("zz11")

    def test_too_long(self):
        with self.assertRaises(ValueError):
            preflight.validate_pattern_strict("a" * 9)

    def test_empty(self):
        with self.assertRaises(ValueError):
            preflight.validate_pattern_strict("")


class TestMinerConfig(unittest.TestCase):
    def valid(self):
        return {
            "pool": "solo.ckpool.org:3333",
            "wallet": "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
            "pattern": "1122",
            "threads": 2,
            "engine": "auto",
        }

    def test_valid_config_normalized(self):
        cfg = preflight.validate_miner_config(self.valid())
        self.assertEqual(cfg["pool"], "solo.ckpool.org:3333")
        self.assertEqual(cfg["pattern"], "1122")
        self.assertEqual(cfg["threads"], 2)
        self.assertEqual(cfg["engine"], "auto")

    def test_defaults_applied(self):
        data = {"pool": "h:1", "wallet": "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"}
        cfg = preflight.validate_miner_config(data)
        self.assertEqual(cfg["pattern"], "1122")
        self.assertEqual(cfg["engine"], "auto")
        self.assertGreaterEqual(cfg["threads"], 1)

    def test_missing_pool_rejected(self):
        data = self.valid()
        del data["pool"]
        with self.assertRaises(ValueError) as ctx:
            preflight.validate_miner_config(data)
        self.assertIn("pool", str(ctx.exception))

    def test_bad_wallet_rejected(self):
        data = self.valid()
        data["wallet"] = "nope"
        with self.assertRaises(ValueError) as ctx:
            preflight.validate_miner_config(data)
        self.assertIn("wallet", str(ctx.exception))

    def test_bad_engine_rejected(self):
        data = self.valid()
        data["engine"] = "fpga"
        with self.assertRaises(ValueError):
            preflight.validate_miner_config(data)

    def test_unknown_keys_rejected(self):
        data = self.valid()
        data["overclock"] = True
        with self.assertRaises(ValueError) as ctx:
            preflight.validate_miner_config(data)
        self.assertIn("overclock", str(ctx.exception))

    def test_non_dict_rejected(self):
        with self.assertRaises(ValueError):
            preflight.validate_miner_config(["pool"])

    def test_multiple_problems_all_listed(self):
        with self.assertRaises(ValueError) as ctx:
            preflight.validate_miner_config({"pool": "", "wallet": ""})
        msg = str(ctx.exception)
        self.assertIn("pool", msg)
        self.assertIn("wallet", msg)


class TestLoadMinerConfig(unittest.TestCase):
    def test_load_valid_file(self):
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as f:
            json.dump({"pool": "h:3333",
                       "wallet": "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"}, f)
            path = f.name
        try:
            cfg = preflight.load_miner_config(path)
            self.assertEqual(cfg["pool"], "h:3333")
        finally:
            os.unlink(path)

    def test_missing_file(self):
        with self.assertRaises(ValueError) as ctx:
            preflight.load_miner_config("/no/such/file.json")
        self.assertIn("not found", str(ctx.exception))

    def test_invalid_json(self):
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as f:
            f.write("{not json")
            path = f.name
        try:
            with self.assertRaises(ValueError) as ctx:
                preflight.load_miner_config(path)
            self.assertIn("not valid JSON", str(ctx.exception))
        finally:
            os.unlink(path)


class TestSystemChecks(QuietMixin, unittest.TestCase):
    """Smoke tests: the checks run and classify without crashing."""

    def test_disk_space_runs(self):
        r = preflight.CheckResult()
        preflight.check_disk_space(r, min_free_mb=1)
        self.assertTrue(r.passed())

    def test_disk_space_fails_when_impossible(self):
        r = preflight.CheckResult()
        preflight.check_disk_space(r, min_free_mb=10 ** 12)
        self.assertFalse(r.passed())

    def test_tmp_writable(self):
        r = preflight.CheckResult()
        preflight.check_tmp_writable(r)
        self.assertTrue(r.passed())

    def test_fd_limit_runs(self):
        r = preflight.CheckResult()
        preflight.check_fd_limit(r)
        # warn-only check: never fails
        self.assertTrue(r.passed())

    def test_service_file_real(self):
        r = preflight.CheckResult()
        preflight.check_service_file(r)
        # repo ships btc-miner.service; it should parse, or warn if absent
        self.assertTrue(r.passed() or r.warnings)

    def test_service_file_missing_warns(self):
        r = preflight.CheckResult()
        preflight.check_service_file(r, name="does-not-exist.service")
        self.assertTrue(r.passed())
        self.assertTrue(r.warnings)

    def test_node_toolchain_runs(self):
        r = preflight.CheckResult()
        preflight.check_node_toolchain(r)
        self.assertTrue(r.passed())  # warn-only


class TestCheckConfig(QuietMixin, unittest.TestCase):
    def test_valid_config_passes(self):
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as f:
            json.dump({"pool": "h:3333",
                       "wallet": "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"}, f)
            path = f.name
        try:
            r = preflight.CheckResult()
            preflight.check_config(r, path)
            self.assertTrue(r.passed())
        finally:
            os.unlink(path)

    def test_invalid_config_fails(self):
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as f:
            json.dump({"pool": "h:3333", "wallet": "bad"}, f)
            path = f.name
        try:
            r = preflight.CheckResult()
            preflight.check_config(r, path)
            self.assertFalse(r.passed())
        finally:
            os.unlink(path)

    def test_no_config_skips(self):
        r = preflight.CheckResult()
        preflight.check_config(r, "")
        self.assertTrue(r.passed())
        self.assertEqual(r.warnings, [])


if __name__ == "__main__":
    unittest.main()
