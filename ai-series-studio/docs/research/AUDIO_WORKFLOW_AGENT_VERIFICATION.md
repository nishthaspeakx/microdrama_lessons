# Voice, music, workflow engines, assembly and headless Claude: verification notes

Checked 26 November 2026 from official pages. NV means not verified. Re-check prices before committing a budget.

## Voice and audio

### ElevenLabs
- Public API, `xi-api-key` header; keys can be scoped, credit-capped and IP-allowlisted.
- Models: `eleven_v4` (90+ languages), `eleven_v4_turbo`, `eleven_v3`, `eleven_multilingual_v2`, `eleven_flash_v2_5`. Hindi listed for all. Hindi–English code-mixed quality is not stated (NV).
- `text-to-speech/{voice_id}/with-timestamps` returns character-level alignment, not word-level. `forced-alignment` returns word and character times. `speech-to-text` (Scribe) returns word timestamps and diarisation, with webhooks.
- Also: voice design (three previews), instant and professional cloning, speech-to-speech, dubbing, sound effects, music, audio isolation.
- Prices (elevenlabs.io/pricing/api): TTS $0.08 per 1K characters (v4, v3, Multilingual v2), $0.04 (Flash, v4 Turbo). Scribe $0.20/hour. Music $0.15/min. Sound effects, voice changer, isolator $0.12/min. Dubbing v1 $0.50/min, v2 $2.20/min. Plans $6 to $990 per month.
- Concurrency: Multilingual v2 from 2 (Free) to 15 (Scale/Business); Flash double; Music 2 to 5; Dubbing 3.
- Professional clones need Creator plan and voice-captcha verification of the speaker. Instant cloning requires confirming rights.
- Video API `POST /v1/flows/video` (async, webhook) exposes Seedance 2.0 family, Veo 3.1 and Creatify Aurora lip-sync. ByteDance models need explicit approval on the API. The MCP server is OAuth sign-in only.
- Music licence: self-serve plans allow commercial use excluding film, TV, radio and studio games; streaming release from Creator up; company-size limits per plan. Check fit for a streaming microdrama before relying on it.

### Cartesia
- `sonic-3.6`, 44 languages including Hindi. Hinglish explicitly supported with `language: "hi"` and Devanagari, Latin or mixed text.
- Word timestamps on SSE and WebSocket only. 1 credit per character; plans $5 to $299. Instant clone from 10 s of audio.

### Sarvam Bulbul
- `bulbul:v4-flash` and `bulbul:v3`, 11 Indian languages, 2,500 characters per request. Code-mixed supported; write Hindi in Devanagari. ₹2 to ₹3 per 1K characters. Dubbing ₹40/min.

### Music
- ElevenLabs Music $0.15/min (licence limits above). Stable Audio 3.0 $0.08 per generation. Google Lyria 3 $0.04 per 30 s clip. Commercial terms for Stable Audio and Lyria NV.

## Durable workflow engines

| | Temporal | Inngest | Trigger.dev v4 | Restate | n8n |
|---|---|---|---|---|---|
| Wait for a person or webhook | Signals, timers up to 100 years | `waitForEvent`; max run 90 days on Pro | Waitpoint tokens; no max run | Awakeables | Wait node |
| Per-provider limits | Task-queue rate limit, worker caps | Concurrency keys, throttle, rate limit | Named concurrency, no first-party rate limiter | Scope concurrency | Plan-level only |
| TypeScript | Yes | Yes | Yes | Yes | Not code-first |
| Self-host | Yes | Yes (SSPL, delayed Apache 2.0) | Yes (Apache-2.0, fewer features) | Yes | Sustainable Use |
| Small-scale price | $50 per million actions | Free 50K runs+steps/month; Pro $99 | $10 to $50 plus compute | Free 100K actions | €20 to €50/month |

Trigger.dev v3 is end-of-life.

## Programmatic assembly
- Remotion is free only for companies of up to 3 people. Larger companies: Automators $0.01 per render with a $100/month minimum, or $25 per seat, or Enterprise from $500/month.
- FFmpeg is free and fast; the existing scripts already use it.
- OpenTimelineIO is an interchange format, not a renderer. Editly is barely maintained.
- Review UI parts: wavesurfer.js (BSD-3) for waveforms and regions; xzdarcy/react-timeline-editor (MIT); Remotion Player (Remotion licence).

## Running Claude headlessly
1. **Agent SDK:** skills load from the filesystem only (`.claude/skills/`); remote MCP works with headers you supply; no interactive OAuth; about 1 GiB RAM per session.
2. **Managed Agents:** beta; MCP credentials from vaults; skills uploaded via `/v1/skills` or from a mounted repo; tokens plus $0.08 per running session-hour; not eligible for zero data retention.
3. **Messages API MCP connector:** beta; the caller handles OAuth and passes the token.
4. **claude.ai connectors cannot be reused from an API-key backend.** The studio needs its own API key or OAuth token for every external service.

## Not verified
ElevenLabs Hinglish quality and v3/v4 concurrency; forced-alignment price; Cartesia Hindi word timestamps; Sarvam rate limits; Stable Audio and Lyria licences; Restate paid prices; Remotion self-hosted render billing; whether ElevenLabs Flows API runs arbitrary user flows.
