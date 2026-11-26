"""Critical invariants from docs/TESTING_AND_ACCEPTANCE_CRITERIA.md section 2."""
import base64
import hashlib
import hmac
import os
import sqlite3
import tempfile
import time
import unittest
from pathlib import Path

from studio import db, ledger
from studio.providers.higgsfield import seedance_reference_body, verify_webhook


class LedgerTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        db.DB_PATH = Path(self.tmp.name) / "t.db"
        self.con = db.connect()
        ledger.set_cap(self.con, "poc", 1000)  # $10

    def tearDown(self):
        self.tmp.cleanup()

    def test_no_duplicate_paid_request(self):
        req = {"prompt": "x", "duration": 5}
        ledger.reserve(self.con, "poc", "higgsfield", "seedance", "video", req, 40)
        with self.assertRaises(ledger.DuplicateRequest):
            ledger.reserve(self.con, "poc", "higgsfield", "seedance", "video", dict(reversed(req.items())), 40)

    def test_cap_blocks_and_changes_nothing(self):
        with self.assertRaises(ledger.BudgetExceeded):
            ledger.reserve(self.con, "poc", "higgsfield", "seedance", "video", {"p": 1}, 1001)
        self.assertEqual(self.con.execute("SELECT COUNT(*) FROM provider_job").fetchone()[0], 0)
        self.assertEqual(ledger.headroom(self.con, "poc"), 1000)

    def test_no_budget_means_no_spend(self):
        with self.assertRaises(ledger.BudgetExceeded):
            ledger.reserve(self.con, "series:x", "higgsfield", "seedance", "video", {"p": 2}, 1)

    def test_settle_releases_reservation(self):
        job = ledger.reserve(self.con, "poc", "higgsfield", "seedance", "video", {"p": 3}, 400)
        self.assertEqual(ledger.headroom(self.con, "poc"), 600)
        ledger.settle(self.con, "poc", job, 0, status="failed")  # failed jobs are not charged
        self.assertEqual(ledger.headroom(self.con, "poc"), 1000)


class ProviderTests(unittest.TestCase):
    def test_seedance_limits(self):
        with self.assertRaises(ValueError):
            seedance_reference_body("p", ["u"], 16, "720p")
        with self.assertRaises(ValueError):
            seedance_reference_body("p", ["u"] * 10, 8, "720p")
        self.assertFalse(seedance_reference_body("p", ["u"], 8, "720p")["generate_audio"])

    def test_webhook_signature(self):
        key = os.urandom(24)
        secret = "whsec_" + base64.b64encode(key).decode()
        body, ts, mid = b'{"status":"completed"}', str(int(time.time())), "msg_1"
        sig = base64.b64encode(hmac.new(key, f"{mid}.{ts}.".encode() + body, hashlib.sha256).digest()).decode()
        h = {"webhook-id": mid, "webhook-timestamp": ts, "webhook-signature": f"v1,{sig}"}
        self.assertTrue(verify_webhook(secret, h, body))
        self.assertFalse(verify_webhook(secret, h, body + b" "))
        self.assertFalse(verify_webhook(secret, {**h, "webhook-timestamp": str(int(time.time()) - 600)}, body))


class ProtectionTests(unittest.TestCase):
    def test_children_without_stated_age_are_protected(self):
        from studio.importer import _protected
        self.assertTrue(_protected({"age": None, "age_source": None}))
        self.assertTrue(_protected({"age": 17, "age_source": "user"}))
        self.assertFalse(_protected({"age": 32, "age_source": "user"}))
        self.assertFalse(_protected({"age": None, "age_source": "user_adult"}))


if __name__ == "__main__":
    unittest.main()
