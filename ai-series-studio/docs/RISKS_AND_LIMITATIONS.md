# Risks and limitations

Status: planning draft, 26 November 2026.

## 1. Risk register

Likelihood and impact are rated low, medium or high.

| # | Risk | Likelihood | Impact | Mitigation | Owner of the decision |
|---|---|---|---|---|---|
| R1 | **Character identity drifts** across clips and episodes despite references | High | High | Locked reference sets, keyframe checks before video, face-similarity gate, repair prompts, cut-away coverage. PoC measures the real drift rate | Engineering |
| R2 | **Automated visual QC misses defects or rejects good takes** | High | High | Narrow judges, code checks first, calibration on labelled takes, second opinions on "unsure", owner review stays mandatory before approval | Engineering |
| R3 | **Child characters blocked or restricted by providers.** Vertex Veo rejects children without allowlisting; other providers' policies are not verified | Medium | High | Seedance via Higgsfield as primary (it made Episode 1); verify Kling, HeyGen, sync.so policies before use; never upload real children's photos | Owner and legal |
| R4 | **Higgsfield API price applies only to low resolution** (not stated on the price page) | Medium | High | First PoC task; fall back to 720p generation plus upscale, or Kling 4.0 | Owner (budget) |
| R5 | **Provider changes**: models retired (Veo left the Gemini API this year), prices change, limits change | High | Medium | Adapter layer, capability and price tables as data, fallback provider per need, quarterly review | Engineering |
| R6 | **Lip-sync quality** is uneven on generated faces, especially children | Medium | Medium | Keep native-audio path with voice conversion as an option; prefer off-screen or reaction shots for long lines; measure in PoC | Owner (taste) |
| R7 | **Hinglish TTS quality** (names, code-mixing) | Medium | Medium | Pronunciation dictionary, Devanagari text, ASR words check, Cartesia as fallback | Engineering |
| R8 | **Costs exceed estimates** because the generated-to-approved ratio is higher than 3 | Medium | Medium | Caps, reservation, estimates before spend, draft-first, auto-fix cap, cost per approved second tracked from the PoC | Owner |
| R9 | **Music licensing** for streamed episodes: ElevenLabs Music self-serve terms exclude film and TV | Medium | Medium | Licensed library first; legal review before publishing generated music | Owner and legal |
| R10 | **Provider concurrency** limits throughput (fal starts at 2; ElevenLabs 5–15) | Medium | Low | Per-provider concurrency keys; plan upgrades only when volume needs them | Engineering |
| R11 | **Story drift** in autonomous mode (characters act out of character, arcs stall) | Medium | Medium | Continuity packet, guardian checks, owner approval of canon changes, mode C only after Phase 7 tests | Owner |
| R12 | **Safety failure** (inappropriate depiction of a protected character) reaches a viewer | Low | High | Hard policy in prompts, safety judge on every take, never auto-waived, owner approval before export | Owner |
| R13 | **Voice cloning misuse** | Low | High | Cloning only with stored consent; designed voices by default | Owner |
| R14 | **Lock-in to one model's look**: a fallback model makes a visibly different picture | Medium | Medium | Grade matching and finish pass; avoid mixing models within a scene | Engineering |
| R15 | **Public repository leaks** keys, account IDs or private paths | Medium | Medium | Secrets only in the platform store; secret scanning in CI; the existing rule of no absolute paths or account IDs in commits | Engineering |
| R16 | **One-engineer bus factor** | Medium | Medium | Written design notes per phase, tests, this documentation set | Owner |

## 2. Limitations to accept

1. **Fully automatic is not the same as no human.** The owner still approves the Bible and each episode. The aim is that the owner's time per episode falls to under 90 minutes, not to zero.
2. **Fine physical actions remain hard** for current video models: hands with small objects, readable text in frame, fast multi-person action, exact choreography. The planner avoids or splits them, and edit coverage hides them.
3. **Long continuous takes are limited** by model length (Seedance 2.0 up to 15 s; Kling 4.0 and Seedance 2.5 up to 30 s). Longer moments are built from cuts.
4. **QC cannot judge taste.** It catches defects. Whether a moment is moving is the owner's call.
5. **Exact reproducibility of generations is not guaranteed** by providers, even with the same seed. The studio guarantees reproducible edits and renders, not reproducible generations.
6. **Prices and policies in these documents are a snapshot** from 26 November 2026.

## 3. Assumptions

| Assumption | If wrong |
|---|---|
| Seedance 2.0 through the Higgsfield API produces the same quality as through the Higgsfield website used for Episode 1 | Switch to fal or BytePlus for Seedance, at higher cost |
| ElevenLabs voice IDs, including Sia's, work through the REST API on the existing account | Re-create voices via voice design on the API account |
| 1080×1920 at 24 fps is the master format | Renderer and budgets change for 4K or other aspect ratios |
| Episodes are 60 to 120 seconds | Longer episodes scale cost roughly linearly and need more units |
| A single company account per provider is acceptable | Multi-tenant studio for outside clients needs per-client accounts and billing |
| The SpeakX learning layer stays in its own repository | Packaging changes if it must live inside the studio |
| One engineer starts in December 2026 | Roadmap dates move |

## 4. Challenges to the brief

1. **"Fully automated" needs a definition.** The plan defines it as: the owner supplies a script (or approves an outline) and reviews the finished cut; everything between is automatic, with the owner pulled in only at gates for budget, safety or canon.
2. **"Use existing skills" cannot be literal** for a backend. Their knowledge and scripts are ported; the signed-in connectors are replaced by REST APIs.
3. **Google Flow and Veo** were named in the brief. Flow has no API, and Veo is now only on Vertex AI and fal, with child-content restrictions. They are optional providers, not core.
4. **A multi-agent "AI team"** is useful for evaluation (separate judges) but harmful as the control structure. The workflow engine is the director of the process; agents are specialists inside steps.
5. **Building all nine phases before proving consistency** would risk months of work on an unproven core. Phase 0 exists to stop that.
