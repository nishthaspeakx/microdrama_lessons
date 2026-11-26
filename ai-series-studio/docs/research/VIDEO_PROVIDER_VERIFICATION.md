# Video, image, lip-sync and upscale providers: verification notes

Checked 26 November 2026 from official pages unless marked NV (not verified). Prices change often; re-check before any budget is committed.

## Headline findings

1. **Veo 3.1 is no longer in the Gemini API** (preview IDs shut down 22 Oct 2026). Its Gemini API replacement is `gemini-omni-1.2-flash`. Veo 3.1 remains GA on Vertex AI (`veo-3.1-generate-001`, retirement no earlier than 4 May 2027) and on fal.
2. **Higgsfield's MCP and CLI are not a backend path.** Both sign in through a browser and spend website plan credits. The Higgsfield REST API is a separate product: API keys, prepaid USD, webhooks.
3. **Google Flow has no official API.** Treat it as UI-only.
4. Every other provider needed (Seedance, Kling, lip-sync, upscale, multi-reference images) has a usable asynchronous API.

## Higgsfield REST API
- Docs: https://docs.higgsfield.ai/docs/api-reference/overview.md. Base `https://api.higgsfield.ai`; Python and TypeScript SDKs.
- Auth `Authorization: Key KEY_ID:KEY_SECRET`, server side only.
- Async by polling `status_url` or signed webhook (`hf_webhook`, retried up to 2 hours). Statuses: queued, in_progress, completed, failed, nsfw, canceled. Files kept 7 days.
- Models: Seedance 2.0, Seedance 2.5 (edit, extend), Kling 2.5 to 4.0, O3, Omni, Soul 2 and Soul ID, Seedream 5.0 Pro. No lip-sync or upscale endpoint.
- Price (https://higgsfield.ai/higgsfield-api), prepaid USD: Seedance 2.0 $0.0804/s, Seedance 2.5 $0.1177/s, Kling 4.0 $0.1257/s, Kling 3.0 $0.0714/s, Soul 2 $0.0032/image, Seedream 5.0 Pro $0.054/image. Resolution for these rates NV. Failed and nsfw requests not charged.
- 20 concurrent requests per key; a full queue returns 429.
- Terms 4.4: no restriction on commercial use of outputs. Terms 5.1 prohibit inappropriate depictions of minors.

## Seedance 2.0 and 2.5
- fal reference-to-video (2.0): up to 9 images, 3 videos, 3 audio clips; 4–15 s; 480p–4K; 9:16; native lip-synced audio. $0.3034/s at 720p, $0.682/s at 1080p.
- fal Seedance 2.5: 4–30 s, up to 30 images, 10 videos, 10 audio clips. About $0.22/s 480p, $0.47/s 720p, $1.16/s 1080p. Max resolution NV.
- BytePlus ModelArk (official, not offered in the US): Seedance 2.0 $7.0 per million tokens (480p/720p), $7.7 (1080p); tokens = duration × width × height × fps / 1024, about $0.15/s at 720p and $0.37/s at 1080p. Real-face references need real-person verification in the console.
- Replicate `bytedance/seedance-2.0` exists; price NV.

## Google
- `gemini-omni-1.2-flash`: 3–15 s, 9:16, 720p native (1080p and 4K upscaled), native audio, first and last frame, up to 6 subject reference images (3 per character, 2 characters), extension to 30 s, video editing, no audio input. About $0.07/s 720p, $0.104/s 1080p. Tier 1: 8 requests/min, 40/day; Tier 3: 40/min, 2,000/day.
- Veo 3.1 on Vertex AI: 4, 6 or 8 s; 9:16; up to 4K; native audio; first and last frame, extension, reference images. Children are rejected unless `personGeneration=allow_all` on an allowlisted project. Official price NV; fal lists $0.20/s without audio, $0.40/s with audio.
- Omni: images with minors unsupported in the EEA, Switzerland and UK.

## Kling (official API)
- Docs https://kling.ai/document-api/llms.txt; Bearer API key; callback URL or polling; results kept 30 days.
- Kling 4.0 omni: 3–30 s, up to 4K, 9:16, native audio, first/middle/last frame, up to 10 reference images, 7 Elements, 5 reference videos, video edit, up to 3 voice references.
- Advanced lip-sync: audio 2–60 s, one face, $0.07 per 5 s.
- Kling 4.0 $0.157/s 720p, $0.235/s 1080p; 4.0 Flash $0.094/s; 3.0 Omni with audio $0.112–0.14/s.
- Policy on minors, commercial terms and concurrency numbers NV.

## Lip-sync and talking head
| Provider | Price | Notes |
|---|---|---|
| sync.so | lipsync-2 $0.04–0.05/s; lipsync-2-pro $0.067–0.083/s; sync-3 $0.107–0.133/s | sync-3 takes a still plus audio; Scale plan 50 concurrent |
| HeyGen API v3 | Avatar IV photo avatar about $0.0433/s (NV) | 10 concurrent |
| OmniHuman v1.5 on fal | $0.16/s | Audio under 30 s at 1080p |
| Hedra Character-3 | $0.05/s 720p, $0.0625/s 1080p | 9:16 supported |

## Aggregators
- fal: queue API, webhooks, automatic retries, no billing on 5xx; concurrency starts at 2 and rises with spend to 40. No SLA stated.
- Replicate: 600 creates/min; outputs deleted after 1 hour by default, so copy out at once.

## Upscaling
- Topaz on fal: $0.01/s to 720p, $0.02/s to 1080p, $0.08/s above. Topaz direct API exists; prices NV.

## Multi-reference image models
| Model | Max reference images | Price per image |
|---|---|---|
| Nano Banana 2.1 | 14 | $0.034 (1K) to $0.113 (4K) |
| Nano Banana Pro | 14 | $0.134 (1K/2K) |
| Seedream 5.0 Pro (BytePlus) | 10 (from search snippet) | $0.045 + $0.003 per extra input |
| FLUX.2 pro | 8 | from $0.03 |
| gpt-image-2.x | multiple, max NV | token priced |

## Still to verify before Phase 1
Higgsfield rate resolution and per-model limits; Vertex Veo price, quota and the child-content allowlist; Kling and HeyGen policies on minors; sync.so and Hedra webhook details; Topaz direct pricing; policies on minors and commercial rights for fal, Replicate, sync.so, Hedra, OpenAI and BFL.
