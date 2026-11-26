# Microdrama Studio: release 1 product spec

Status: **governing spec for release 1**, received from the owner on 26 November 2026. Where it differs from the other planning documents, this spec wins for release 1. Those documents still describe the later phases.

## The product in one line

One guided workspace takes a series brief all the way to a playable, editable episode. The world and voices are approved once and reused across episodes. When the user asks for a change, the app shows what it understood and regenerates only the affected work.

```
1. Upload idea → 2. Approve visuals → 3. Lock voices → 4. Create Episode 1 → 5. Review, edit and export
```

Madhopur is the first test project. It has two source briefs, reference images, a continuity bible, a screenplay, clip prompts and a finished cut in `madhopur/`.

## 1. Home: upload your idea
- The screen has **Upload files**, a **Tell us about your series** text box, and **Create Microdrama**.
- It accepts several Markdown, PDF and plain-text files at once. For Madhopur that means the master series document, the Episode 1 brief and a typed brief.
- **What gets extracted:** series title, episode count, episode summaries, setting and era, characters, relationships, language, tone and production requirements. Available episode scripts are shown with where they came from.
- **Editable summary:** a short summary appears before any visuals are made.
- **Conflicts are flagged** when they change production, for example two ages for one character or two endings for Episode 1.
- **Each kind of text keeps its job:** screenplay text, production notes and sample prompts stay distinct.
- **Autosave:** the project saves itself, and the user resumes at the current step.

## 2. Visual approvals
- **Layout:** an image-first review screen. A sidebar lists Characters, Wardrobe & accessories, Locations and Props. One item at a time opens in a large panel with its reference images, the extracted description, the image prompt, and **Approve** and **Change** buttons.
- **Characters:** face close-up, full-body front and side views, hair, distinctive features, and the expressions the story needs.
- **Wardrobe and accessories:** each outfit on the approved character, plus close-ups of important jewellery, footwear and bags.
- **Locations:** establishing views, interior angles, entrances, layout, and story-relevant lighting or time of day.
- **Props and vehicles:** clear views at useful angles, material and colour, and a scale reference where size matters.
- **Change in plain words:** for example "make Suman's shawl maroon and keep the same face". The app turns this into a precise image prompt and shows it before generating. It regenerates from the approved references and keeps earlier candidates for compare and restore. It flags only the dependent assets for review.
- **The series bible:** once everything is approved, the bible records the exact images, prompts and continuity details. Episodes use those versions.

## 3. Voice casting
- **Auditions:** each speaking character is shown with their approved portrait and one short Hindi or Hinglish line from the script. Every candidate voice reads the same line.
- **Approve voice** locks the ElevenLabs Voice ID, model, settings and audition sample to that character.
- **Change voice** offers another suggestion, or accepts a pasted ElevenLabs Voice ID. The app checks the account can use it and generates a preview.
- **Pronunciation notes** cover names, places and recurring words.
- **Moving on:** episode production opens once every speaking voice is locked.

## 4. Episode 1
- **Left pane, screenplay:** Episode 1 comes from the sources, or is drafted and labelled as a draft. It shows Devanagari and English with matching scene and line numbers, and Roman Hinglish is optional. Each spoken line and its translation stay linked.
- **Right pane, production prompt:** for the selected scene it shows shots, duration, action, framing, locked references, exact dialogue, locked voices, sound cues and transitions. It also shows runtime, aspect ratio, draft quality and estimated cost. Everything is editable before generation.
- **Create Episode 1:** each scene and shot gets a card that moves from queued to generating to ready, with a playable clip as soon as it exists. Shots can be retried, replaced or regenerated individually.
- **Assemble:** clips, dialogue, ambience, effects, music and subtitles combine into a playable cut with scene markers and links to the source prompts.
- **Checks from the first Madhopur run:** Hindi lines need room in the shot, action beats can come back too short, and sound and motion need playback review.

## 5. Episode review
- **Layout:** the video and timeline sit beside an edit-note panel.
- **Time formats:** notes accept seconds, mm:ss, ranges, **Use current time** and **Final shot**.
- **Edit video:** turns notes into timestamped production instructions and shows the plan and the affected scenes. It uses the user's edited plan if there is one, and applies the smallest edit that meets each note.
  - A dialogue change needs new speech and lip-sync.
  - A sound cue needs only an audio edit.
  - A replacement scene needs new footage and a check of the joins on both sides.
- **Timestamps** always refer to the version being watched.
- **Versions:** previous cuts are kept, with original-versus-revised playback and markers at each change.
- **Exports:** Download MP4 and Download subtitles.

## Build order and done criteria

| Build phase | Working result |
|---|---|
| 1. Project and script intake | Upload the two Madhopur briefs and typed instructions. The app extracts a five-episode outline and the Episode 1 screenplay, linked back to the source text |
| 2. Visual and voice approvals | Review, regenerate, approve and reopen visual assets and ElevenLabs auditions. The exact versions used are saved |
| 3. One complete episode | A representative dialogue scene first, to check voice sync and continuity. Then all Episode 1 scenes, the assembled cut and a playable export |
| 4. Timestamp revisions | The six existing Madhopur edit notes, from the wave at 0:06 to the final-shot change, are run and checked in playback |
| 5. Reuse across episodes | Episode 2 opens with the same cast, voices, locations and props. New material goes through the same approval flow |

**Release 1 is done when** a user can upload both briefs and a short description, approve the visual world and voices, generate a playable Episode 1, and make a timestamped revision without leaving the app.

## How this changes the master plan

| Topic | Master plan | Release 1 |
|---|---|---|
| Product shape | Dashboard, wizard, Bible review, production monitor, review | The five guided steps above |
| First proof | Episode 2 made semi-automatically from scripts | Episode 1 remade inside the app, then the six edit notes, then Episode 2 |
| Screenplay | Devanagari dialogue | Devanagari and English, linked line by line, with optional Roman Hinglish |
| Approvals | Bible review with lock pass | Item-by-item visual review with change requests in plain words, candidate history and dependency flags |
| Voices | Locked voice per character | Auditions on the same line, pasted voice IDs validated, pronunciation notes |
| Automated QC and self-correction | Phase 4 | Built in as scene-review and final-review checks; full automation stays later |
| Autonomous modes, cost analytics, SpeakX layer | Phases 7 to 9 | After release 1 |

Phase 0 work carries over:
- the Episode 1 import becomes the Madhopur fixture,
- the continuity check and the Episode 2 plan feed build phase 5,
- the ledger, adapters and face check move into the app.

## Technical choices for release 1

| Need | Choice | Note |
|---|---|---|
| App | Next.js (React, TypeScript) | `ai-series-studio/web` |
| Database | Postgres (local Postgres 16 for development) | Plain SQL migrations |
| Background jobs | A Postgres job table with a worker process | Inngest is deferred until the app is hosted; the job interface stays thin so it can swap |
| Files | Local content-addressed storage | S3 or R2 when hosted |
| Reasoning | Claude through the Messages API with JSON schemas (`ANTHROPIC_API_KEY`) | Without a key, only recorded results for identical inputs replay, labelled as recorded |
| Voices | ElevenLabs by Voice ID | |
| Images and video | Replaceable adapters; Higgsfield first | |
| Assembly | FFmpeg | |
