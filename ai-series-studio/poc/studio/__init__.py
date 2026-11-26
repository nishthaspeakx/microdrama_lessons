"""Phase 0 proof-of-concept harness for the AI Series Studio.

Mirrors a subset of docs/DATABASE_AND_DATA_MODELS.md in SQLite so the
Phase 1 Postgres schema can be checked against real Madhopur data.
"""
from pathlib import Path

POC_ROOT = Path(__file__).resolve().parent.parent
REPO_ROOT = POC_ROOT.parent.parent
DATA = POC_ROOT / "data"
