"""Run one Claude role with a versioned prompt and a JSON schema.

Context comes from files and the database, never from chat history.
Every call is logged with its usage in llm_call. Env: ANTHROPIC_API_KEY.
"""
from __future__ import annotations

import json
from pathlib import Path

import anthropic

from ..db import connect, new_id, now
from ..estimate import PRICES

HERE = Path(__file__).parent
DEFAULT_MODEL = {"script_parser": "claude-sonnet-5-5", "continuity_guardian": "claude-opus-5-5", "planner": "claude-opus-5-5"}


def run_role(role: str, context: dict, model: str | None = None, max_tokens: int = 32000) -> dict:
    prompt_file = HERE / "prompts" / f"{role}.md"
    schema = json.loads((HERE / "schemas" / f"{role}.json").read_text())
    system = prompt_file.read_text()
    version = system.splitlines()[0].strip("# ").strip()
    model = model or DEFAULT_MODEL[role]
    client = anthropic.Anthropic()
    with client.messages.stream(
        model=model,
        max_tokens=max_tokens,
        thinking={"type": "adaptive"},
        system=[{"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}],
        messages=[{"role": "user", "content": json.dumps(context, ensure_ascii=False)}],
        output_config={"format": {"type": "json_schema", "schema": schema}},
    ) as stream:
        msg = stream.get_final_message()
    if msg.stop_reason == "refusal":
        raise RuntimeError(f"{role}: model refused; escalate, do not reword and retry")
    text = next(b.text for b in msg.content if b.type == "text")
    u = msg.usage
    p = PRICES["llm"].get(model, {})
    cents = 100 * ((u.input_tokens * p.get("in_per_mtok", 0) + u.output_tokens * p.get("out_per_mtok", 0)
                    + (u.cache_read_input_tokens or 0) * p.get("cache_read_per_mtok", 0)) / 1e6)
    con = connect()
    with con:
        con.execute("INSERT INTO llm_call VALUES (?,?,?,?,?,?,?,?,?,?)",
                    (new_id(), role, model, version, u.input_tokens, u.output_tokens,
                     u.cache_read_input_tokens or 0, u.cache_creation_input_tokens or 0, round(cents, 3), now()))
    return json.loads(text)
