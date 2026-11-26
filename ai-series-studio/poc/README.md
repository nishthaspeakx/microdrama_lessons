# Phase 0 proof of concept: Madhopur Episode 2

The goal and pass criteria are in `../docs/MASTER_IMPLEMENTATION_PLAN.md` section 6. This folder holds the scripts and the Episode 2 work. It is a test harness, not the studio app.

## Status, 26 November 2026

| Step | State |
|---|---|
| Store mirroring the planned database (SQLite) | Done: `studio/schema.sql` |
| Approved Episode 1 imported as Bible version 1 | Done: 8 characters, 24 reference images, 3 locations, 3 props, 19 continuity facts, 9 key frames |
| Continuity packet for Episode 2 | Done: `episodes/ep2/continuity-packet.json` |
| Episode 2 script parsed, 30 lines with stable IDs | Done: `episodes/ep2/parsed.json` |
| Continuity check | Done: 11 findings, 5 major: `episodes/ep2/continuity-findings.json` |
| Production plan and estimate | Done: 14 units, 134 s per pass, about $54 to $80: `episodes/ep2/plan.json` |
| Budget ledger with idempotency and caps, with tests | Done: 7 tests pass |
| Higgsfield, ElevenLabs and Claude adapters | Written; not yet run, because no keys are set |
| Tier 1 technical checks | Done; verified on the Episode 1 master |
| Face identity check, calibrated on Episode 1 | Done: `calibration/README.md` |
| Owner decisions on the Episode 2 findings | **Waiting** |
| Provider keys | **Waiting** |
| Reference locks, generation, assembly, review | Not started; needs keys and decisions |

The parse, continuity findings and plan were produced in a Claude Code session acting as the agent roles. Once the Anthropic key is set, the API roles run on the same inputs. Their output is compared with these files, which become the roles' first test cases.

## Setup

```bash
python3 -m pip install -r requirements.txt
python3 -m studio import-e1
python3 -m studio packet 2
python3 -m studio estimate episodes/ep2/plan.json
python3 -m unittest tests.test_invariants
```

The face check needs two OpenCV model files in `data/models/`:

- `face_detection_yunet_2023mar.onnx`
- `face_recognition_sface_2021dec.onnx`

Both come from github.com/opencv/opencv_zoo. Then run:

```bash
python3 -m studio faces-calibrate
```

## Keys, from environment variables only

| Variable | For |
|---|---|
| `HF_API_KEY_ID`, `HF_API_KEY_SECRET` | Higgsfield API: video and the estimate endpoint |
| `ANTHROPIC_API_KEY` | Agent roles |
| `ELEVENLABS_API_KEY` | Character voices and alignment |
| `GEMINI_API_KEY` | Reference images (Nano Banana 2.1) |
| `SYNC_API_KEY` | Lip-sync, for the dialogue-path test |

`data/` is git-ignored. It holds the database, the content-addressed assets and the models. Nothing in this folder may contain keys, account IDs or local paths.
