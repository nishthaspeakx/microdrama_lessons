# Microdrama lessons

Working files and lessons from making AI-generated vertical microdramas with Claude Code and the Higgsfield short-drama workflow.

## Madhopur

A five-episode Hinglish microdrama set in a fictional farming town in central India. A meteor shower in 2014 brings a small boy to Suman and Devendra Sharma. Only Episode 1 has been produced so far.

### Episode 1 · आसमान से क्या गिरा?

| What | Where |
|---|---|
| Edited film, 1 min 27 s, name cards and Hindi subtitles | `madhopur/episode-1/final/ep1-edited-subtitled-1080x1920.mp4` |
| Plain film, 1 min 35 s, every clip whole | `madhopur/episode-1/final/ep1-plain-480p.mp4` |
| Subtitle file | `madhopur/episode-1/final/ep1-subtitles.srt` |
| The seven clips and one-frame-a-second contact sheets | `madhopur/episode-1/clips/` |
| Character, location and prop reference pictures | `madhopur/episode-1/references/` |
| Plan shown for approval, the continuity plan, the script and every generation request | `madhopur/episode-1/plan/` |
| Cut list, card design, subtitles, join report and quality-check pages | `madhopur/episode-1/edit/` |
| Source briefs for the series | `madhopur/briefs/` |

Notes on the files:

- All video was generated as 480p drafts. The edited film sits in a 1080 x 1920 file because the editor scales it up; the picture detail is still 480p.
- `ep1-continuity-bible.json` is the full production plan: cast profiles, wardrobe, prompts, staging, shot lists and the Higgsfield job ids of every reference, so later episodes can reuse the same faces, costumes, places and spacecraft.
- The Higgsfield account id has been removed from stored links.
- Cost of Episode 1: about 322 Higgsfield credits (pictures 37, draft clips 285 including one remade clip).

### Episode 1, revised cut

A second cut made from a written edit prompt, kept beside the first in `madhopur/episode-1/revised/`. Five clips were remade and two (the crash, Suman and the boy) were reused.

| Change | Clip |
|---|---|
| The mother simply waves, nobody speaks | `revised/clips/01-bazaar-fireball.mp4` |
| The girl calls "मम्मी? … कहाँ हो?" with a listening pause | `revised/clips/02-bazaar-meera-line.mp4` |
| Villagers watch a blazing object cross the sky and feel it land far away (replaces the maize-field scene) | `revised/clips/03-villagers-and-landing.mp4` |
| A slow tilt up a massive craft towering over the family | `revised/clips/06-craft-reveal.mp4` |
| The episode ends on the child: blue eyes with a glow and one pulse of light through his kurta | `revised/clips/07-final-child.mp4` |

The revised film is `revised/final/ep1-revised-edited-subtitled-1080x1920.mp4` (1 min 30 s). It cost about 200 credits on top of the first cut.

### Series name, thumbnail and prototype

The series is titled **मधोपुर का राज़ (The Secret of Madhopur)**. "Madhopur" was the working title, so older files and folder names still use it.

| What | Where |
|---|---|
| Episode 1 thumbnail, 1080 x 1920, with its HTML source | `madhopur/episode-1/thumbnail/` |
| "Learn English Through Stories" mobile-web prototype (React, TypeScript, Vite) | `prototype/` |
| Episode 1 with English dialogue (same voices, dubbed) and English subtitles | `madhopur/episode-1/english/` |

The prototype plays the revised Episode 1, asks who the boy is, hands over to Sia (SpeakX's English coach) in a lip-synced clip, and runs six practice questions before a reward screen. Play it at **https://nishthaspeakx.github.io/microdrama_lessons/** (prototype 1) or **https://nishthaspeakx.github.io/microdrama_lessons/?p=2** (prototype 2, with the English-dialogue episode). See [prototype/README.md](prototype/README.md) for how to run it and what is simulated.

See [LESSONS.md](LESSONS.md) for what was learned along the way.
