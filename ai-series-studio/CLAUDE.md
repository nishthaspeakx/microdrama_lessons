# AI Series Studio: instructions for Claude Code

This folder holds the plan for a web studio that produces AI-generated episodic series with consistent characters, voices and story. The planning documents are in `docs/`. **Release 1 is being built in `web/` to `docs/PRODUCT_SPEC_RELEASE_1.md`, one build phase at a time.** The Phase 0 harness is in `poc/`.

## Read first
1. `docs/PRODUCT_SPEC_RELEASE_1.md` for what release 1 must do, then `docs/MASTER_IMPLEMENTATION_PLAN.md` for architecture and later phases.
2. `docs/IMPLEMENTATION_ROADMAP.md` for the current phase and its exit criteria.
3. The document for the area you are touching. Names of tables, roles and actions in code must match `docs/DATABASE_AND_DATA_MODELS.md`, `docs/AI_AGENT_ARCHITECTURE.md` and `docs/QUALITY_CONTROL_FRAMEWORK.md`.

## Architecture rules
- Claude is the reasoning layer inside workflow steps. Order, retries, budgets and approvals live in the workflow engine (Inngest), never in a model loop.
- Every fact is a Postgres row. Files are content-addressed and immutable. Approved records are never updated in place: create a new version.
- Each episode starts from the continuity packet (facts, end states, key frames, approved looks and voices), never from the previous MP4 alone.
- Fixes go through the revision engine: resolve to targets, pick the cheapest action, redo only stale nodes.
- Providers are called only through adapters in `packages/providers`. Capabilities and prices are data.
- The SpeakX learning layer is a separate consumer of the export package. Do not import learning-layer code into the studio.

## Money and safety rules
- Never send a paid provider request without a budget reservation and an idempotency key.
- Never retry a moderation or content block with changed wording.
- Characters with `protected = true` follow the content policy in `docs/CHARACTER_VOICE_CONTINUITY_SYSTEM.md` §7. No automated step may clear the flag or waive a safety finding.
- Voice cloning only with a stored consent record.
- Live provider tests run only with the spend-capped test keys, inside the phase's agreed cap. Ask the owner before any spend beyond it.

## Repository rules
- The repository is public. Never commit keys, account IDs, personal emails or absolute local paths. Secrets live in the platform secret store and `.env.local` (git-ignored).
- Commit with the owner's GitHub noreply address.
- Work on a feature branch. `main` deploys the live SpeakX prototype; merge to it only when the owner asks.

## Planned layout (Phase 1)
```
apps/web            Next.js studio UI and API routes
packages/db         schema, migrations, typed queries
packages/workflows  Inngest functions
packages/providers  provider adapters, capability and price tables
packages/agents     role prompts (versioned), schemas, context builders
packages/qc         checks, judges, thresholds
media/              Python media library (ported scripts), CLI, tests
docs/               planning documents
```

## Definition of done for any change
Tests for the change pass; the critical invariants in `docs/TESTING_AND_ACCEPTANCE_CRITERIA.md` §2 still pass; the relevant document is updated if behaviour changed.
