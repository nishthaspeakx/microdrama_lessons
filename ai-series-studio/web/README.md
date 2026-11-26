# Microdrama Studio (release 1)

The guided workspace from `../docs/PRODUCT_SPEC_RELEASE_1.md`: upload idea → approve visuals → lock voices → Episode 1 → review and export.

## Status

Build phase 1, project and script intake, works end to end:

- **Upload:** Markdown, PDF and plain-text files, plus a typed brief, on the Home screen.
- **Sections:** every file is split into numbered sections, such as `d1:s12`, so every extracted fact links back to its exact source text.
- **Extraction:** Claude reads the sources and returns the series, episodes with their screenplay sections, characters with ages as stated, locations, props, production requirements, conflicts, and a type for each section (screenplay, production note, sample prompt and so on).
- **Editable summary:** everything autosaves. Conflicts that change production must be resolved before step 2, and the server enforces this.
- **Resume:** projects reopen at their current step.

Steps 2 to 5 show placeholders until their build phases land.

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
