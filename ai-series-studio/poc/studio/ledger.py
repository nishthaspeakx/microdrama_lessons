"""Budget ledger and idempotency guard.

Invariants (docs/TESTING_AND_ACCEPTANCE_CRITERIA.md section 2):
1. No paid request is sent twice for the same idempotency key.
2. No paid request is sent when it would exceed a cap.
"""
from __future__ import annotations

import hashlib
import json
import sqlite3

from .db import j, log, new_id, now


class BudgetExceeded(RuntimeError):
    pass


class DuplicateRequest(RuntimeError):
    def __init__(self, job_id: str):
        super().__init__(f"request already submitted as provider_job {job_id}")
        self.job_id = job_id


def idempotency_key(provider: str, model: str, request: dict) -> str:
    """Hash of provider, model and the normalised request body."""
    body = json.dumps(request, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(f"{provider}\n{model}\n{body}".encode()).hexdigest()


def set_cap(con: sqlite3.Connection, scope: str, cap_cents: int) -> None:
    """Set a cap in its own committed transaction, so a later refused
    reservation can never roll the cap back."""
    with con:
        _set_cap(con, scope, cap_cents)


def _set_cap(con: sqlite3.Connection, scope: str, cap_cents: int) -> None:
    con.execute(
        "INSERT INTO budget (scope, cap_cents) VALUES (?,?) "
        "ON CONFLICT(scope) DO UPDATE SET cap_cents=excluded.cap_cents",
        (scope, cap_cents),
    )
    log(con, "budget.cap", {"scope": scope, "cap_cents": cap_cents})


def headroom(con: sqlite3.Connection, scope: str) -> float:
    row = con.execute("SELECT cap_cents, reserved_cents, spent_cents FROM budget WHERE scope=?", (scope,)).fetchone()
    if not row:
        raise BudgetExceeded(f"no budget set for {scope}; refusing paid work")
    return row["cap_cents"] - row["reserved_cents"] - row["spent_cents"]


def reserve(con: sqlite3.Connection, scope: str, provider: str, model: str, operation: str,
            request: dict, estimated_cents: float) -> str:
    """Reserve the estimate and create the provider_job row in one transaction.

    Returns the provider_job id. Raises DuplicateRequest or BudgetExceeded
    without changing anything.
    """
    key = idempotency_key(provider, model, request)
    with con:  # one transaction
        existing = con.execute("SELECT id FROM provider_job WHERE idempotency_key=?", (key,)).fetchone()
        if existing:
            raise DuplicateRequest(existing["id"])
        if headroom(con, scope) < estimated_cents:
            raise BudgetExceeded(f"{scope}: estimate {estimated_cents:.1f}c exceeds headroom {headroom(con, scope):.1f}c")
        job_id = new_id()
        con.execute(
            "INSERT INTO provider_job (id, provider, model, operation, idempotency_key, request, status, submitted_at) "
            "VALUES (?,?,?,?,?,?,?,?)",
            (job_id, provider, model, operation, key, j(request), "reserved", now()),
        )
        con.execute("UPDATE budget SET reserved_cents = reserved_cents + ? WHERE scope=?", (estimated_cents, scope))
        con.execute(
            "INSERT INTO cost_entry (id, provider_job_id, category, reason, estimated_cents, created_at) "
            "VALUES (?,?,?,?,?,?)",
            (new_id(), job_id, operation, "reserved", estimated_cents, now()),
        )
    return job_id


def settle(con: sqlite3.Connection, scope: str, job_id: str, actual_cents: float, verified: bool = False,
           status: str = "succeeded") -> None:
    """Release the reservation and record the actual cost (0 for unbilled failures)."""
    with con:
        row = con.execute("SELECT estimated_cents FROM cost_entry WHERE provider_job_id=?", (job_id,)).fetchone()
        est = row["estimated_cents"] if row else 0
        con.execute(
            "UPDATE budget SET reserved_cents = MAX(0, reserved_cents - ?), spent_cents = spent_cents + ? WHERE scope=?",
            (est, actual_cents, scope),
        )
        con.execute(
            "UPDATE cost_entry SET actual_cents=?, verified=?, reason=? WHERE provider_job_id=?",
            (actual_cents, int(verified), status, job_id),
        )
        con.execute("UPDATE provider_job SET status=?, finished_at=? WHERE id=?", (status, now(), job_id))
