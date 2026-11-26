# API integration plan

Status: planning draft, 26 November 2026. Details and sources are in `research/VIDEO_PROVIDER_VERIFICATION.md` and `research/AUDIO_WORKFLOW_AGENT_VERIFICATION.md`. Prices change often and must be re-checked before Phase 1.

## 1. What changed after verification

Three findings changed the plan:

1. **The tools used to make Madhopur Episode 1 are not backend integrations.** The Higgsfield MCP and CLI sign in through a browser and spend website plan credits. ElevenLabs' MCP is OAuth sign-in only. Connectors signed in through claude.ai cannot be reused by a backend. The studio must use each provider's REST API with its own keys.
2. **Veo 3.1 is gone from the Gemini API.** It remains on Vertex AI and fal, and Vertex rejects content depicting children unless a project is allowlisted. Madhopur has several child characters, so Veo is not the primary model.
3. **Google Flow has no API.** It stays a manual tool.

## 2. Chosen providers

| Need | Primary | Fallback | Why |
|---|---|---|---|
| Video generation | **Higgsfield REST API, Seedance 2.0** | Kling 4.0 (official API); Seedance 2.0 via fal | Seedance made the accepted Episode 1 takes. Higgsfield's API price is the lowest found ($0.0804/s, resolution NV). Kling has strong references and Elements |
| Video extend / edit | Seedance 2.5 on Higgsfield | Kling 4.0 omni edit | Both listed with edit and extend |
| Keyframe and reference images | Seedream 5.0 Pro (Higgsfield API) | Nano Banana 2.1 (Gemini API) | Seedream made the Madhopur sheets; Nano Banana takes 14 references |
| Dialogue TTS | **ElevenLabs** (`eleven_v4`) | Cartesia `sonic-3.6` for Hinglish | Sia's voice is on ElevenLabs. Cartesia explicitly supports mixed Hindi–English text |
| Voice conversion | ElevenLabs speech-to-speech | — | Same vendor as the locked voices |
| Word timing and ASR | ElevenLabs forced alignment and Scribe | faster-whisper (local) | Word-level timestamps; TTS timestamps are character-level only |
| Lip-sync on a generated clip | **sync.so** lipsync-2-pro | Kling advanced lip-sync | Purpose-built; $0.067–0.083/s |
| Talking head from a still (Sia) | HeyGen API (Avatar IV) | sync.so sync-3, OmniHuman via fal | HeyGen made the accepted Sia clips |
| Upscale | Topaz via fal | — | $0.02/s to 1080p |
| Sound effects | Licensed library first; ElevenLabs sound effects | — | Library is free per use once licensed |
| Music | Licensed library or ElevenLabs Music | Stable Audio, Lyria | ElevenLabs Music licence excludes film and TV on self-serve plans; legal must confirm fit for streamed episodes |
| Reasoning, judges | Claude via Messages API | — | See AI_AGENT_ARCHITECTURE |
| Workflow engine | Inngest | Temporal | SYSTEM_ARCHITECTURE §5 |

## 3. Integration pattern per provider

All providers are asynchronous. The common pattern:

1. Reserve cost in the budget ledger.
2. Submit with an idempotency key; save the provider reference.
3. Wait for the signed webhook, with a timeout; poll status on timeout.
4. Copy outputs to our storage at once (Replicate deletes outputs after 1 hour, Higgsfield after 7 days, Kling after 30 days).
5. Settle the actual cost.

| Provider | Auth | Async | Limits to respect |
|---|---|---|---|
| Higgsfield API | `Authorization: Key KEY_ID:KEY_SECRET` | `status_url` polling or `hf_webhook` (signed, retried up to 2 h) | 20 concurrent per key; 429 when queue full; failed and nsfw jobs not charged |
| Kling | Bearer API key | `callback_url` (signed) or `GET /tasks` | Concurrency per resource pack (numbers NV); error 1303 |
| fal | `Authorization: Key` | Queue URLs, `fal_webhook` | Concurrency 2 rising to 40 with spend |
| ElevenLabs | `xi-api-key` (scoped, credit-capped) | Synchronous TTS; webhooks on Scribe | Concurrency 5–15 by plan; 3 dubbing jobs |
| Cartesia | API key | Bytes, SSE, WebSocket | Concurrency 2–15 by plan |
| sync.so | API key (header details NV) | Poll `GET /v2/generate/{id}`; webhooks mentioned | 3 to 50 concurrent by plan |
| HeyGen | `X-Api-Key` | `callback_url` or poll | 10 concurrent |
| Gemini (Nano Banana) | API key | Synchronous | Tier-based rate limits |
| Anthropic | API key | Synchronous / streaming; Batches for offline judging | Tier-based rate limits |

## 4. Capability matrix used by the planner

| Model | Length | References | Methods | Native audio |
|---|---|---|---|---|
| Seedance 2.0 | 4–15 s | Up to 9 images, 3 videos, 3 audio | Text, image, reference, first and last frame | Yes, lip-synced |
| Seedance 2.5 | 4–30 s | Up to 30 images, 10 videos, 10 audio (fal figures) | Plus edit and extend | Yes |
| Kling 4.0 omni | 3–30 s | Up to 10 images, 7 Elements, 5 videos | First, middle, last frame; edit; voice references | Yes |
| Veo 3.1 (Vertex) | 4, 6, 8 s | Reference images (8 s only) | First and last frame, extend | Yes |
| Gemini Omni Flash | 3–15 s | 6 subject images | First and last frame, extend, edit | Yes, no audio input |

Higgsfield's own limits for its Seedance endpoints are NV; the adapter starts from the fal figures and is corrected in the first integration test.

## 5. Content policy by provider

| Provider | Relevant rule | Effect on Madhopur |
|---|---|---|
| Higgsfield | Terms prohibit inappropriate or lewd depictions of minors; commercial use of outputs not restricted | Usable with the studio's protected-person rules |
| BytePlus Seedance | Real-face references need real-person verification | Fictional generated faces are fine; never upload a real child's photo |
| Vertex Veo | Children rejected unless `allow_all` and allowlisted | Not usable for scenes with children without allowlisting |
| Gemini Omni | Images with minors unsupported in EEA, Switzerland, UK | Region-dependent |
| Kling, HeyGen, sync.so, fal | Policy on minors NV | Must be checked before use on child scenes |

## 6. Keys, accounts and spend caps to set up

| Account | Needed for | Cap to set |
|---|---|---|
| Higgsfield API (separate from the website plan) | Video and images | Prepaid balance, start at $50 |
| ElevenLabs API key on the existing account | Voices, ASR, alignment | Credit cap on the key |
| sync.so | Lip-sync | Hobbyist plan for the PoC |
| HeyGen API | Sia clips | Pay as you go |
| fal | Upscale, fallbacks | Prepaid balance |
| Kling | Fallback video | Smallest pack, after PoC need is shown |
| Anthropic API | Agents and judges | Monthly spend limit |
| Inngest, Postgres, storage, hosting | Platform | Free or lowest tiers for the PoC |

All of these need the owner's decision and payment details; none can be created by the studio itself.

## 7. Integration tests before Phase 2

For each adapter: submit one minimal job, receive the webhook, fetch and store the output, check the probed duration and resolution against the request, record the actual cost against the estimate, and simulate a webhook loss to prove the polling path. Results are written back into the capability matrix and price table.
