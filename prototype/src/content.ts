// All story and lesson content lives here. To add a new story or episode,
// copy an episode object and change the media paths, lines and exercises.
// No screen code needs to change.

// Media files live in public/media. Paths go through the site's base path so the
// prototype works both locally and when published under a sub-folder.
const media = (file: string) => `${import.meta.env.BASE_URL}media/${file}`

export type Option = { text: string; correct?: boolean }

// Prototype 2's story practice. A moment is a stretch of a scene clip, in Hindi or English,
// with the subtitles shown over it (times are seconds within the clip).
export type Moment = { lang: 'hi' | 'en'; from: number; to: number; hold?: number; subs?: { text: string; from: number; to: number }[] } // hold: the frame shown after it stops
export type StoryBeat = {
  scene: string // key into Episode.scenes
  intro: Moment // plays first, then holds its last frame
  caption?: string // shown on the held frame; ___ becomes a slot
  role?: string // "be the character" for speaking lines
  sia: { text: string; audio: string } // Sia asks the question in her voice
  siaCorrect: string
  siaWrong: string
  reply: Moment // the character says the line in English
}
export type SceneClip = { hi: string; en: string; label: string; focus: string }

export type Exercise =
  | {
      id: string
      type: 'mcq' // standard multiple choice with a still from the film
      image: string
      prompt: string // Hinglish question
      promptAudio?: { text: string; lang: string } // what the speaker button reads
      options: Option[]
      answer: string // full correct English sentence, spoken after a right answer
      story?: StoryBeat
    }
  | {
      id: string
      type: 'blank' // fill in the blank
      image: string
      before: string
      after: string
      hindi: string
      options: Option[]
      answer: string
      story?: StoryBeat
    }
  | {
      id: string
      type: 'speak' // read along and speak
      title: string
      sentence: string
      hindi: string
      story?: StoryBeat
    }

export type SiaScene = { poster: string; video?: string; audio?: string; lines: { text: string; at: number }[] }

export type Episode = {
  id: string
  series: string
  seriesEnglish: string
  number: number
  totalEpisodes: number
  title: string
  titleEnglish: string
  hook: string
  duration: string
  video: string
  // Seconds where the picture ends: both episode files fade to black for their last second, so playback
  // stops here and cuts straight to the next screen.
  videoEnd: number
  poster: string
  // Question card shown right after the episode. `at` = seconds into the voice-over when each line appears.
  cliffhanger: { image: string; audio?: string; lines: { text: string; at: number }[]; holdMs: number }
  // Sia's bridge into practice (prototype 1). `video` is her lip-synced clip; if it is missing the still + `audio` are used.
  sia: SiaScene & { face: string; cta: string }
  // Prototype 2: Sia offers a choice between the episode with English dialogue and practice.
  siaChoice: SiaScene & { ctaEnglish: string; ctaPractice: string }
  // The same episode with the dialogue dubbed into English and English subtitles (prototype 2).
  englishVideo: string
  exercises: Exercise[]
  // Prototype 2: the scene clips practice plays (cut from the episode without subtitles).
  scenes: Record<string, SceneClip>
  // Recorded audio for the speaker buttons, keyed by the exact text that is spoken.
  voiceClips: Record<string, string>
  sentencesLearnt: number
  coinsPerCorrect: number
  rewardLine: string
  next: { number: number; title: string; titleEnglish: string; thumbnail: string; available: boolean; video?: string }
}

export const episodes: Episode[] = [
  {
    id: 'madhopur-ep1',
    series: 'मधोपुर का राज़',
    seriesEnglish: 'The Secret of Madhopur',
    number: 1,
    totalEpisodes: 5,
    title: 'आसमान से क्या गिरा?',
    titleEnglish: 'What fell from the sky?',
    hook: 'आसमान से कुछ गिरा… और मधोपुर हमेशा के लिए बदल गया।',
    duration: '1 min 30 s',
    video: media('ep1.mp4'),
    videoEnd: 88.95,
    poster: media('art/poster.jpg'),
    cliffhanger: {
      image: media('art/cliffhanger-boy.jpg'),
      audio: media('audio/cliffhanger-vo.mp3'), // Sia's ElevenLabs voice
      lines: [
        { text: 'आखिर कौन है ये बच्चा?', at: 0 },
        { text: 'क्या वो इस जहाज़ से आया है?', at: 2.15 },
      ],
      holdMs: 6600,
    },
    sia: {
      face: media('sia/sia-face.jpg'),
      poster: media('sia/sia-intro-poster.jpg'),
      video: media('sia/sia-intro.mp4'), // lip-synced clip (HeyGen Avatar 6 via ElevenLabs)
      audio: media('audio/sia-intro.mp3'), // Sia's ElevenLabs voice
      lines: [
        { text: 'लेकिन ये जानने से पहले...', at: 0 },
        { text: 'चलो सीखते हैं आज के episode के कुछ sentences, जिन्हें हम English में कैसे बोल सकते हैं!', at: 2.0 },
      ],
      cta: 'Let’s Practise',
    },
    siaChoice: {
      poster: media('sia/sia-choice-poster.jpg'),
      video: media('sia/sia-choice.mp4'), // lip-synced clip (HeyGen Avatar 6 via ElevenLabs)
      audio: media('audio/sia-choice.mp3'), // Sia's ElevenLabs voice
      lines: [
        { text: 'अगर आप इसी episode को English में देखना चाहते हैं, तो click करिए “Video in English” पर,', at: 0 },
        { text: 'और अगर आप practice करना चाहते हैं, तो click करिए “Practice” पर!', at: 5.9 },
      ],
      ctaEnglish: 'Video in English',
      ctaPractice: 'Practice',
    },
    englishVideo: media('ep1-english.mp4'),
    scenes: {
      meera: { hi: media('scenes/meera-hi.mp4'), en: media('scenes/meera-en.mp4'), label: 'Scene 1 · The bazaar', focus: '50% 30%' },
      suman: { hi: media('scenes/suman-hi.mp4'), en: media('scenes/suman-en.mp4'), label: 'Scene 2 · By the pickup', focus: '50% 42%' },
    },
    exercises: [
      {
        id: 'q1',
        type: 'mcq',
        image: media('stills/meera-searching.jpg'),
        prompt: '“मम्मी, कहाँ हो?” को English में क्या बोलेंगे?',
        promptAudio: { text: 'मम्मी, कहाँ हो? को English में क्या बोलेंगे?', lang: 'hi-IN' },
        options: [{ text: 'Mummy, where are you?', correct: true }, { text: 'Mummy, where were you?' }],
        answer: 'Mummy, where are you?',
        story: {
            scene: 'meera',
            intro: { lang: 'hi', from: 0, to: 7.3, subs: [{ text: 'मम्मी?', from: 1.5, to: 3.3 }, { text: 'कहाँ हो?', from: 5.4, to: 6.9 }] },
            caption: '“मम्मी? … कहाँ हो?”',
            sia: { text: 'Meera अपनी मम्मी को ढूंढ रही है… “मम्मी, कहाँ हो?” को English में कैसे बोलेगी?', audio: media('audio/q/sia-q1.mp3') },
            siaCorrect: media('audio/q/sia-correct.mp3'), siaWrong: media('audio/q/sia-wrong.mp3'),
            reply: { lang: 'en', from: 0.8, to: 7.3, subs: [{ text: 'Mummy? … Where are you?', from: 1.3, to: 7.3 }] },
          },
      },
      {
        id: 'q2',
        type: 'blank',
        image: media('stills/meera-street.jpg'),
        before: 'Mummy, where',
        after: 'you?',
        hindi: 'मम्मी, कहाँ हो?',
        options: [{ text: 'are', correct: true }, { text: 'is' }],
        answer: 'Mummy, where are you?',
        story: {
            scene: 'meera',
            intro: { lang: 'hi', from: 4.3, to: 7.3, subs: [{ text: 'कहाँ हो?', from: 5.4, to: 6.9 }] },
            caption: 'Mummy, where ___ you?',
            sia: { text: 'अब Meera की बात पूरी कीजिए… Mummy, where … you? सही word चुनिए।', audio: media('audio/q/sia-q2.mp3') },
            siaCorrect: media('audio/q/sia-correct.mp3'), siaWrong: media('audio/q/sia-wrong.mp3'),
            reply: { lang: 'en', from: 4.3, to: 7.3, subs: [{ text: 'Mummy, where are you?', from: 4.6, to: 7.3 }] },
          },
      },
      {
        id: 'q3',
        type: 'speak',
        title: '“डरो मत” को English में बोलो',
        sentence: "Don't be afraid.",
        hindi: 'डरो मत।',
        story: {
            scene: 'suman',
            intro: { lang: 'hi', from: 0, to: 5.15 },
            role: 'Suman',
            sia: { text: 'अब आप Suman हैं। बच्चा बहुत डरा हुआ है… उससे English में कहिए, “डरो मत।”', audio: media('audio/q/sia-q3.mp3') },
            siaCorrect: media('audio/q/sia-correct.mp3'), siaWrong: media('audio/q/sia-wrong.mp3'),
            reply: { lang: 'en', from: 4.9, to: 6.2, subs: [{ text: "Don't be afraid.", from: 5.0, to: 6.2 }] },
          },
      },
      {
        id: 'q4',
        type: 'mcq',
        image: media('stills/boy-at-window.jpg'),
        prompt: 'किसी से पूछना है “दर्द हो रहा है?” कैसे पूछोगे?',
        promptAudio: { text: 'किसी से पूछना है, दर्द हो रहा है? कैसे पूछोगे?', lang: 'hi-IN' },
        options: [{ text: 'Are you hurt?', correct: true }, { text: 'Was you hurt?' }],
        answer: 'Are you hurt?',
        story: {
            scene: 'suman',
            intro: { lang: 'hi', from: 2.0, to: 7.64, hold: 7.5, subs: [{ text: 'डरो मत। तुम्हें चोट लगी है?', from: 5.2, to: 7.64 }] },
            caption: '“दर्द हो रहा है?”',
            sia: { text: 'Suman जानना चाहती है कि बच्चे को चोट तो नहीं लगी… “दर्द हो रहा है?” English में वो कैसे पूछेगी?', audio: media('audio/q/sia-q4.mp3') },
            siaCorrect: media('audio/q/sia-correct.mp3'), siaWrong: media('audio/q/sia-wrong.mp3'),
            reply: { lang: 'en', from: 4.6, to: 7.6, hold: 7.5, subs: [{ text: "Don't be afraid. Are you hurt?", from: 5.1, to: 7.6 }] },
          },
      },
      // Questions 5 and 6 are suggestions added to reach six. Edit or remove freely.
      {
        id: 'q5',
        type: 'blank',
        image: media('stills/boy-in-field.jpg'),
        before: 'Are you',
        after: '?',
        hindi: 'तुम्हें चोट लगी है?',
        options: [{ text: 'hurt', correct: true }, { text: 'hurts' }],
        answer: 'Are you hurt?',
        story: {
            scene: 'suman',
            intro: { lang: 'hi', from: 4.4, to: 7.64, hold: 7.5, subs: [{ text: 'डरो मत। तुम्हें चोट लगी है?', from: 5.2, to: 7.64 }] },
            caption: 'Are you ___ ?',
            sia: { text: 'अब Suman का सवाल पूरा कीजिए… Are you … ? सही word चुनिए।', audio: media('audio/q/sia-q5.mp3') },
            siaCorrect: media('audio/q/sia-correct.mp3'), siaWrong: media('audio/q/sia-wrong.mp3'),
            reply: { lang: 'en', from: 6.2, to: 7.6, hold: 7.5, subs: [{ text: 'Are you hurt?', from: 6.5, to: 7.6 }] },
          },
      },
      {
        id: 'q6',
        type: 'speak',
        title: '“तुम्हें चोट लगी है?” को English में बोलो',
        sentence: 'Are you hurt?',
        hindi: 'तुम्हें चोट लगी है?',
        story: {
            scene: 'suman',
            intro: { lang: 'en', from: 4.6, to: 6.4, subs: [{ text: "Don't be afraid.", from: 5.0, to: 6.4 }] },
            role: 'Suman',
            sia: { text: 'अब Suman बनकर बच्चे से English में पूछिए… “तुम्हें चोट लगी है?”', audio: media('audio/q/sia-q6.mp3') },
            siaCorrect: media('audio/q/sia-correct.mp3'), siaWrong: media('audio/q/sia-wrong.mp3'),
            reply: { lang: 'en', from: 6.4, to: 7.6, hold: 7.5, subs: [{ text: 'Are you hurt?', from: 6.5, to: 7.6 }] },
          },
      },
    ],
    // Sia's ElevenLabs voice. A line without an entry here is read by the browser's voice.
    voiceClips: {
      'मम्मी, कहाँ हो? को English में क्या बोलेंगे?': media('audio/q-prompt-mummy-kahan-ho.mp3'),
      'किसी से पूछना है, दर्द हो रहा है? कैसे पूछोगे?': media('audio/q-prompt-dard-ho-raha-hai.mp3'),
      'Mummy, where are you?': media('audio/en-mummy-where-are-you.mp3'),
      "Don't be afraid.": media('audio/en-dont-be-afraid.mp3'),
      'Are you hurt?': media('audio/en-are-you-hurt.mp3'),
    },
    sentencesLearnt: 3,
    coinsPerCorrect: 4,
    rewardLine: 'Great job! अब जानते हैं आगे क्या हुआ।',
    next: {
      number: 2,
      title: 'आज से ये हमारा बेटा है',
      titleEnglish: 'From today, he is our son',
      thumbnail: media('art/ep2-thumbnail.jpg'),
      available: false,
    },
  },
]
