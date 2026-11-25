// All story and lesson content lives here. To add a new story or episode,
// copy an episode object and change the media paths, lines and exercises.
// No screen code needs to change.

// Media files live in public/media. Paths go through the site's base path so the
// prototype works both locally and when published under a sub-folder.
const media = (file: string) => `${import.meta.env.BASE_URL}media/${file}`

export type Option = { text: string; correct?: boolean }

export type Exercise =
  | {
      id: string
      type: 'mcq' // standard multiple choice with a still from the film
      image: string
      prompt: string // Hinglish question
      promptAudio?: { text: string; lang: string } // what the speaker button reads
      options: Option[]
      answer: string // full correct English sentence, spoken after a right answer
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
    }
  | {
      id: string
      type: 'speak' // read along and speak
      title: string
      sentence: string
      hindi: string
    }

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
  poster: string
  // Question card shown right after the episode. `at` = seconds into the voice-over when each line appears.
  cliffhanger: { image: string; audio?: string; lines: { text: string; at: number }[]; holdMs: number }
  // Sia's bridge into practice. `video` is her lip-synced clip; if it is missing the still + `audio` are used.
  sia: { face: string; poster: string; video?: string; audio?: string; lines: { text: string; at: number }[]; cta: string }
  exercises: Exercise[]
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
    exercises: [
      {
        id: 'q1',
        type: 'mcq',
        image: media('stills/meera-searching.jpg'),
        prompt: '“मम्मी, कहाँ हो?” को English में क्या बोलेंगे?',
        promptAudio: { text: 'मम्मी, कहाँ हो? को English में क्या बोलेंगे?', lang: 'hi-IN' },
        options: [{ text: 'Mummy, where are you?', correct: true }, { text: 'Mummy, where were you?' }],
        answer: 'Mummy, where are you?',
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
      },
      {
        id: 'q3',
        type: 'speak',
        title: '“डरो मत” को English में बोलो',
        sentence: "Don't be afraid.",
        hindi: 'डरो मत।',
      },
      {
        id: 'q4',
        type: 'mcq',
        image: media('stills/boy-at-window.jpg'),
        prompt: 'किसी से पूछना है “दर्द हो रहा है?” कैसे पूछोगे?',
        promptAudio: { text: 'किसी से पूछना है, दर्द हो रहा है? कैसे पूछोगे?', lang: 'hi-IN' },
        options: [{ text: 'Are you hurt?', correct: true }, { text: 'Was you hurt?' }],
        answer: 'Are you hurt?',
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
      },
      {
        id: 'q6',
        type: 'speak',
        title: '“तुम्हें चोट लगी है?” को English में बोलो',
        sentence: 'Are you hurt?',
        hindi: 'तुम्हें चोट लगी है?',
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
