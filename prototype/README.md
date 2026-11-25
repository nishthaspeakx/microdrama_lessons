# Learn English Through Stories · prototype

**Try it** (best on a phone, with sound on):

- **Prototype 1 · practice:** https://nishthaspeakx.github.io/microdrama_lessons/
- **Prototype 2 · English video or practice:** https://nishthaspeakx.github.io/microdrama_lessons/?p=2

A mobile-web prototype for SpeakX: watch a short episode of a microdrama, then practise the English from it with Sia, and unlock the next episode.

Built with React, TypeScript and Vite. Everything runs in the browser; there is no backend.

## The journey

1. **Start screen** with the series and episode title and a "Watch Episode 1" button.
2. **Episode 1** of मधोपुर का राज़ (The Secret of Madhopur) plays full screen.
3. **Question card**: the boy with glowing eyes and the chest mark, with a voice-over asking who he is.
4. **Sia** appears in a lip-synced clip and invites the learner to practise. The learner taps "Let's Practise".
5. **Six practice questions** in the SpeakX lesson style: multiple choice with a still from the film, fill in the blank, and read-along speaking.
6. **Reward screen**: "Well done!", coins earned, sentences learnt and the Episode 2 thumbnail marked unlocked. This is the last screen; Episode 2 is not produced yet, so "Watch next episode" shows a short "coming soon" note.

## Publishing

Every push to `main` that changes `prototype/` rebuilds the site and publishes it to the link above (see `.github/workflows/pages.yml`). It takes about a minute.

## Prototype 2

Same journey, but at Sia's screen she says, in Hindi, that the learner can watch this same episode in English or practise. Two buttons:

- **Video in English** plays Episode 1 with the dialogue dubbed into English (same voices) and English subtitles, then returns to Sia.
- **Practice** starts the same six questions, then the reward screen.

Each prototype keeps its own coins and progress on the device. The demo panel can switch between them.

## Run it locally

```bash
npm install
npm run dev
```

Open the address Vite prints, ideally at a phone-sized window.

## Where things live

| What | Where |
|---|---|
| All copy, media paths, timings and questions | `src/content.ts` |
| The journey state machine, coins and saved progress | `src/journey.ts` |
| One file per screen | `src/screens/` |
| Recorded voice playback, browser speech fallback and speech checking | `src/speech.ts` |
| Video, stills and audio used by the app | `public/media/` |
| Full-size originals of Sia's clip and voice lines | `source-media/` |

To add an episode, copy the episode object in `src/content.ts` and change its media, lines and questions. No screen code needs to change.

## Demo panel

Press `D`, add `?demo` to the address, or tap the top-left corner four times. It can jump to any screen, switch between mandatory and optional practice, mute Sia, reset progress and show the event log.

## What is real and what is simulated

- Sia's voice is an ElevenLabs voice. Her talking clip was made from a still photo and that voice with a lip-sync model.
- The speaker buttons play recorded clips. A line without a recording is read by the browser's voice.
- The speaking questions use the browser's speech recognition and check which words were said. They do not score pronunciation, and they need a browser that supports speech recognition (Chrome works).
- Coins and progress are stored in the browser only.
- Questions 5 and 6 are suggested additions and still need review.
