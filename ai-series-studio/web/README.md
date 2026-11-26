# Microdrama Studio (release 1)

The guided workspace from `../docs/PRODUCT_SPEC_RELEASE_1.md`: upload idea → approve visuals → lock voices → Episode 1 → review and export.

## Status

Build phase 1, project and script intake, works end to end:

- **Upload:** Markdown, PDF and plain-text files, plus a typed brief, on the Home screen.
- **Sections:** every file is split into numbered sections, such as `d1:s12`, so every extracted fact links back to its exact source text.
- **Extraction:** Claude reads the sources and returns the series, episodes with their screenplay sections, characters with ages as stated, locations, props, production requirements, conflicts, and a type for each section (screenplay, production note, sample prompt and so on).
- **Editable summary:** everything autosaves. Conflicts that change production must be resolved before step 2, and the server enforces this.
- **Resume:** projects reopen at their current step.

Step 2, visual approvals, works:

- **Planning the list.** On entering step 2, Claude turns the step 1 summary into the items to approve, with descriptions and image prompts. Each person gets one item per age or era, linked to the earlier look it must resemble. Outfits are linked to their wearer, and locations and props come next. Children are flagged as protected. Items that appear only in an episode already made are marked optional, with the timecode of an existing frame.
- **Review.** A sidebar groups Characters, Wardrobe & accessories, Locations, and Props & vehicles. One item opens at a time in a large panel, and every version is kept.
  - **Generate** makes the views for the item: a face close-up, a front-and-side turnaround and expressions for a character. Its approved parent look is used as a reference.
  - **Use my image** adds an existing picture, such as an Episode 1 still. It can be approved as it is, and it is used as a reference for every later version.
  - **Change** turns plain words into a full rewritten prompt and says what it understood. It shows the cost before anything is generated, and regenerates only the affected views.
  - **Approve** a new version and only the items that depend on it are flagged for a second look.
- **Create all visuals.** One click makes everything still to do, parents first. A later age or outfit waits for its parent's new images and is made from them, so nothing has to be approved first. All views of an item are made at the same time (`IMAGE_CONCURRENCY`, default 8), with retries when the provider asks to slow down. A character takes about 35 s.
- **Request change, for the whole family.** A change to one look is carried to everything built from it: later ages, outfits and their own children. Items already generated get new versions made from the changed look. Items never generated just get the updated prompt, at no cost. "Approve all updated items" approves the set, and the approved prompt and description become the item's own.
- **Order and budget.** "Generate to-do items" runs everything whose parent is approved, with a cost estimate. Spending stops at `PROJECT_IMAGE_BUDGET_USD`.
- **Save to series bible and continue.** This works only when every required item is approved. It freezes the exact approved images and prompts as a bible version and opens step 3.

Where images come from:

| Setting | Model |
|---|---|
| `OPENAI_API_KEY` set | OpenAI `gpt-image-2.6-sunburst` (change it with `OPENAI_IMAGE_MODEL`). New images use the generations endpoint; images with references use the edits endpoint, which takes up to 16 references. Sizes are 1152×2048 for 9:16 and 2048×1152 for 16:9. OpenAI bills by tokens, so the cost shown before generating is an estimate (`OPENAI_EST_CENTS_PER_IMAGE`), and the real cost of each image is recorded from the response. |
| `GEMINI_API_KEY` set and no OpenAI key | Gemini Nano Banana 2.1 |
| `IMAGE_PROVIDER=mock` | Labelled placeholder images for testing the flow at no cost |

The API key is billed separately from a ChatGPT subscription. OpenAI may ask an organisation to complete API Organization Verification before GPT Image models work. 

Step 3, voice casting, works, and can run alongside step 2:

- **Speaking parts.** Claude reads the screenplay for every speaking part: one voice per character across ages, unless the story needs a different one, such as Veer at seventeen. Each part gets a voice brief, audition text of at least 100 characters built from the character's own lines, and where an earlier episode has their voice.
- **Auditions.** "Suggest 3 voices" uses ElevenLabs Voice Design, and every candidate reads the same audition text. An optional reference recording, such as an Episode 1 clip, steers the design. "Paste an ElevenLabs Voice ID" checks the account can use the voice, then reads the same text.
- **Lock.** Saves a designed voice as a permanent ElevenLabs voice and records its Voice ID, models and sample.
- **Pronunciation notes.** These apply project-wide by substitution before every line is spoken. Claude's suggestions start switched off, so nothing rewrites dialogue until you tick it.
- **Save voices and continue.** This adds the voices and notes to the series bible. Episode 1 opens once visuals are saved too.

`VOICE_PROVIDER=mock` gives labelled test tones instead of real voices.

## Run it

You need Node 22 and a local Postgres.

```bash
createdb microdrama_studio
npm install
cp .env.example .env.local   # add ANTHROPIC_API_KEY to read new sources
npm run migrate
npm run dev                   # web on http://localhost:3100 plus the job worker
```

## How extraction runs

| `ANTHROPIC_API_KEY` | What happens |
|---|---|
| Set in `.env.local` | Claude Opus 5.5 reads the sources through the Messages API. It makes three calls over one cached input, for the story, the world and the notes, because the full schema is too large for the API to enforce in one call. |
| Not set | A recorded result replays only if one exists for exactly the same files, brief and prompt version. Otherwise the project shows a clear error with a Try again button. |

Set `RECORD_FIXTURES=1` to save live results into `fixtures/llm/` for tests. The first hand-checked recording was removed when the prompt moved to v2.

Test inputs: `../inputs/madhopur-ep1-ep2/`. On 26 November 2026 a live run of those files gave 2 episodes, 9 characters, 8 locations and 14 props, with no broken citations, in about 60 seconds.

## Layout

| Path | What |
|---|---|
| `db/migrations/` | Plain SQL migrations |
| `src/lib/` | Database, storage, job queue, source parsing, extraction schema and prompt, Claude call |
| `src/worker.ts` | Background worker; claims jobs with `FOR UPDATE SKIP LOCKED` |
| `src/app/` | Home, project page, API routes |
| `src/components/` | Upload form, step bar, intake review, source viewer |
| `scripts/record-intake.ts` | Saves a hand-checked intake result for one project's exact input |

## Known limits

- PDF text extraction can put Devanagari letters out of order. The app warns when a PDF contains Hindi; upload Markdown or text versions of scripts.
- Files are stored on local disk under `.data/` for now.
