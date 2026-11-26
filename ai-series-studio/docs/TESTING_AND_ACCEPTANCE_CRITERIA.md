# Testing and acceptance criteria

Status: planning draft, 26 November 2026.

## 1. Test layers

| Layer | What | When |
|---|---|---|
| Unit | Prompt assembler, timeline validator, dependency graph, cost ledger, idempotency keys, schema validation, safety rules | Every commit |
| Media library | Each ported script on fixture media: cut, mix, loudness, subtitles, reframe, grade; output probed and compared | Every commit |
| Adapter contract | Each provider adapter against recorded responses (fixtures) | Every commit |
| Adapter live | One minimal paid job per provider, with webhook and polling paths | Weekly and before releases; spend-capped key |
| Workflow | Whole workflows with fake adapters: crash and resume, webhook loss, budget pause, gate waits, duplicate events | Every commit |
| Agent evaluation | Role test sets (AI_AGENT_ARCHITECTURE §4) | On prompt or model change |
| QC calibration | Labelled take set (QUALITY_CONTROL_FRAMEWORK §8) | On check or threshold change |
| End to end | A short test series (two 20-second episodes) through the real pipeline | Before each phase sign-off |
| Restore drill | Restore Postgres and assets to a point in time into staging | Once per phase |

## 2. Critical invariants (must never fail)

1. No paid request is sent twice for the same idempotency key.
2. No paid request is sent when it would exceed a cap.
3. No take with an open safety finding appears in any version shown or exported.
4. An approved version can always be re-rendered byte-identical from its timeline and assets.
5. Restoring a version never deletes or changes another version.
6. A Bible change never alters a version already in review or approved.
7. A protected character's flag cannot be cleared by any automated step.

Each invariant has an automated test that tries to break it.

## 3. Acceptance criteria by capability

| Capability | Accepted when |
|---|---|
| Series setup | Madhopur documents ingest into a draft Bible with every character, location and prop found; every ambiguity listed; existing sheets imported without regeneration |
| Continuity | Planted contradictions are caught (≥ 90%); Episode 2 plan uses Episode 1 end states and key frames |
| Generation | Every unit within model limits; outputs stored and probed; failures retried or escalated as specified |
| QC | Calibration targets met; every finding located with evidence and an action |
| Self-correction | At least 60% of major findings fixed without a person in the PoC episode, within the auto-fix cap |
| Review | A comment at a time and region resolves to the correct segment, take and unit |
| Revision | Edit-only comments produce a new version in under 5 minutes; a one-unit retake revision leaves all other segments byte-identical |
| Versions | Compare, restore and cherry-pick work; history intact |
| Cost | Ledger within 5% of provider usage; estimate within 25% of actual per episode |
| Exports | Clean and subtitled masters at 1080×1920, -14 LUFS ±1, true peak ≤ -1.5 dBTP, subtitles in sync within 100 ms |

## 4. Proof-of-concept acceptance

The PoC (MASTER_IMPLEMENTATION_PLAN §6) passes when all of these hold:

| # | Criterion | Measure |
|---|---|---|
| 1 | Episode 2 of Madhopur produced from the Bible and Episode 1's close-out, not from the Episode 1 MP4 | Inputs logged per step |
| 2 | Character identity holds | Face similarity ≥ calibrated threshold on ≥ 90% of face frames for Suman, Devendra and Veer |
| 3 | Voices hold | Speaker similarity ≥ threshold on 100% of kept lines; names pronounced correctly |
| 4 | Story continuity | Zero contradictions with Episode 1 found by the owner |
| 5 | Automation | The owner's time from "start" to "approved" is under 90 minutes, excluding waiting |
| 6 | Self-correction | ≥ 60% of major QC findings fixed automatically |
| 7 | Revision precision | A 3-comment revision changes only the targeted segments |
| 8 | Cost | Total generation cost within the approved PoC budget; cost per approved second reported |
| 9 | Safety | Zero safety findings in the approved version; every protected-character take passed the safety judge |
| 10 | Owner verdict | The owner rates the episode as good as or better than the hand-made Episode 1 |
