# Cost optimisation framework

Status: planning draft, 26 November 2026. All provider prices are from the verification notes and must be re-checked before budgets are set. Dollar figures are planning estimates, not measurements, until the proof of concept replaces them.

## 1. What drives cost

For a 95-second episode, video generation is most of the bill. Everything else is small by comparison.

| Item | Driver | Typical share |
|---|---|---|
| Video generation | Generated seconds × price per second × retake factor | 60–85% |
| Lip-sync | Spoken on-camera seconds | 3–10% |
| Agent layer (Claude) | Tokens, mostly judge frames | 5–15% |
| Images (keyframes, references) | Count | 1–3% |
| Voice, music, effects | Characters and minutes | 1–3% |
| Upscale and render | Seconds | 1–3% |
| Platform (hosting, database, storage, workflow engine) | Fixed per month | Spread across episodes |

The key number is **generated seconds per approved second**. Episode 1 needed coverage well above its 95 seconds of screen time. A ratio of 2.5 to 4 is realistic at first; the target after tuning is under 2.5.

## 2. Estimated cost per 95-second episode

Assumptions: 12 to 15 generation units of about 10 s each; generated-to-approved ratio of 3; 25 s of on-camera dialogue needing lip-sync on the TTS-first path; Seedance 2.0 on the Higgsfield API.

| Item | Low | Typical | High |
|---|---|---|---|
| Video, Higgsfield Seedance 2.0 at $0.0804/s (resolution NV) | 240 s → $19 | 285 s → $23 | 400 s → $32 |
| Keyframes and repairs (Seedream, ~$0.05) | $1 | $2 | $3 |
| Dialogue TTS (ElevenLabs, ~1.5K characters with retakes) | $0.15 | $0.25 | $0.50 |
| Lip-sync (sync.so lipsync-2-pro) | $0 (native audio path) | $2 | $4 |
| Music and effects | $0 (library) | $0.50 | $1.50 |
| Upscale to 1080p (Topaz via fal, $0.02/s) | $0 | $2 | $4 |
| Agent layer (AI_AGENT_ARCHITECTURE §7) | $5 | $8 | $14 |
| **Per episode** | **about $25** | **about $38** | **about $59** |

If Higgsfield's API rate turns out to be for low resolution only and 1080p generation is needed through fal at $0.682/s, the video line rises to about $160 to $270 and the episode to about $175 to $300. Settling the Higgsfield resolution question is therefore the first PoC task.

For comparison, the whole Madhopur Episode 1 and prototype effort cost about 527 Higgsfield website credits (about ₹2,320) plus ElevenLabs usage, with a person doing all review and assembly.

## 3. Fixed platform cost per month (estimate)

| Item | PoC | Production (1–5 series) |
|---|---|---|
| Hosting (web, API, workers) | $0–20 | $50–150 |
| Media workers (containers, scale to zero) | $10–30 | $50–200 |
| Postgres | $0–25 | $25–70 |
| Object storage (R2/S3) | $5 | $20–80 |
| Inngest | $0 (free tier) | $99 |
| ElevenLabs plan | Existing | $99 (Pro) |
| sync.so | $5 | $249 if volume needs 50 concurrent |
| Remotion licence | $0 (not used) | $100 minimum only if adopted |
| Error tracking | $0 | $26 |
| **Total** | **about $20–110** | **about $420–1,070** |

## 4. Levers, in order of impact

1. **Catch problems on images, not video.** Keyframe checks in pre-visualisation stop bad faces and sets before $1 to $5 clips are made.
2. **Plan units to the model.** Correct length and reference count avoids failures that cost a full take.
3. **Draft first.** Generate risky units at 480p, check, then make the final. Saves most when the retake rate is high. The PoC measures this per model.
4. **Cheapest fix first.** Trim, cut away, reframe, regrade and remix are free. Retakes are the last resort (QUALITY_CONTROL_FRAMEWORK §6).
5. **Selective revision.** Only stale nodes are redone (VIDEO_EDITING_AND_REVISION_ENGINE §5).
6. **Reuse.** Approved references, location plates, ambience beds and music cues are reused across episodes. Content-addressed storage means nothing is stored twice.
7. **Native audio when it passes.** If the voice-conversion path holds quality, lip-sync spend disappears.
8. **Prompt caching and model right-sizing** for the agent layer; Batches for offline evaluation.
9. **Provider routing.** The adapter layer lets each unit go to the cheapest model whose capabilities fit.

## 5. Controls

| Control | Behaviour |
|---|---|
| Estimate before spend | Every plan and revision shows its estimate before approval |
| Reservation | Each paid call reserves its estimate in the ledger; a call that would exceed a cap is not sent |
| Caps | Per episode, per series, per month; and an auto-fix cap (30% of the episode estimate by default) |
| Idempotency | Identical requests are never paid twice |
| Failed-job accounting | Failed and moderated jobs recorded with whether the provider charged |
| Reconciliation | Daily comparison of our ledger with each provider's usage or balance; differences above 5% raise an alert |
| Reporting | Cost per approved second, by series and episode, and by reason (first take, auto-fix, revision) |

## 6. Measuring cost honestly

- Estimated and actual costs are separate columns; dashboards say which they show.
- Provider credits are converted with the rate actually paid, recorded per purchase.
- Costs of experiments and failed runs are kept, labelled `test` or `failed`, not hidden.
- Rupee figures use the exchange rate on the day of payment.
