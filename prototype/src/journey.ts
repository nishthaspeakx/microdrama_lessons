// One central state machine for the whole journey:
// start -> episode -> cliffhanger -> sia -> practice -> reward
// Prototype 2 (?p=2): at Sia the learner chooses "Video in English" (episode-en, then back to Sia) or "Practice".
import { useEffect, useReducer } from 'react'

export type Screen = 'start' | 'episode' | 'cliffhanger' | 'sia' | 'episode-en' | 'episode-hi' | 'practice' | 'reward' | 'next'
export type Variant = 'mandatory' | 'optional'
export const PROTOTYPE: 1 | 2 = new URLSearchParams(location.search).get('p') === '2' ? 2 : 1
export const SCREENS: Screen[] = PROTOTYPE === 2
  ? ['start', 'episode', 'cliffhanger', 'sia', 'episode-en', 'episode-hi', 'practice', 'reward', 'next']
  : ['start', 'episode', 'cliffhanger', 'sia', 'practice', 'reward', 'next']

export type TrackedEvent = { name: string; at: string; data?: Record<string, unknown> }

export type State = {
  screen: Screen
  variant: Variant
  coins: number // lifetime balance
  lessonCoins: number // earned in the current lesson
  exIndex: number
  practiceDone: boolean
  skippedPractice: boolean
  siaVoice: boolean
  englishWatched: boolean // prototype 2: back at Sia after watching (or closing) a video
  events: TrackedEvent[]
}

export type Action =
  | { type: 'START' }
  | { type: 'EPISODE_ENDED' }
  | { type: 'CLIFFHANGER_DONE' }
  | { type: 'SIA_DONE' }
  | { type: 'WATCH_ENGLISH' }
  | { type: 'WATCH_HINDI' }
  | { type: 'VIDEO_CLOSED'; lang: 'en' | 'hi'; completed: boolean }
  | { type: 'ANSWERED'; correct: boolean; coins: number }
  | { type: 'NEXT_EXERCISE'; total: number }
  | { type: 'SKIP_PRACTICE' }
  | { type: 'CONTINUE_STORY' }
  | { type: 'JUMP'; screen: Screen }
  | { type: 'JUMP_QUESTION'; index: number }
  | { type: 'SET_VARIANT'; variant: Variant }
  | { type: 'SET_SIA_VOICE'; on: boolean }
  | { type: 'RESET' }
  | { type: 'TRACK'; name: string; data?: Record<string, unknown> }

const KEY = PROTOTYPE === 2 ? 'speakx-microdrama-v1-p2' : 'speakx-microdrama-v1' // each prototype keeps its own progress

const initial: State = {
  screen: 'start', variant: 'mandatory', coins: 0, lessonCoins: 0, exIndex: 0,
  practiceDone: false, skippedPractice: false, siaVoice: true, englishWatched: false, events: [],
}

function ev(state: State, name: string, data?: Record<string, unknown>): TrackedEvent[] {
  const e = { name, at: new Date().toISOString(), data }
  console.info('[event]', name, data ?? '')
  return [...state.events, e].slice(-200)
}

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case 'START':
      return { ...s, screen: 'episode', englishWatched: false, events: ev(s, 'episode_started') }
    case 'WATCH_ENGLISH':
      return { ...s, screen: 'episode-en', events: ev(s, 'english_video_started') }
    case 'WATCH_HINDI':
      return { ...s, screen: 'episode-hi', events: ev(s, 'hindi_video_started') }
    case 'VIDEO_CLOSED':
      return { ...s, screen: 'sia', englishWatched: true, events: ev(s, a.completed ? `${a.lang === 'en' ? 'english' : 'hindi'}_video_completed` : `${a.lang === 'en' ? 'english' : 'hindi'}_video_closed`) }
    case 'EPISODE_ENDED':
      return { ...s, screen: 'cliffhanger', events: ev(s, 'episode_completed') }
    case 'CLIFFHANGER_DONE':
      return { ...s, screen: 'sia', events: ev(s, 'cliffhanger_completed') }
    case 'SIA_DONE':
      return { ...s, screen: 'practice', exIndex: 0, lessonCoins: 0, practiceDone: false, skippedPractice: false, events: ev(s, 'sia_introduction_completed') }
    case 'ANSWERED':
      return { ...s, coins: s.coins + a.coins, lessonCoins: s.lessonCoins + a.coins, events: ev(s, 'exercise_completed', { index: s.exIndex, correct: a.correct, coins: a.coins }) }
    case 'NEXT_EXERCISE':
      if (s.exIndex + 1 >= a.total) return { ...s, screen: 'reward', practiceDone: true, events: ev(s, 'practice_completed', { coins: s.lessonCoins }) }
      return { ...s, exIndex: s.exIndex + 1, events: ev(s, 'exercise_started', { index: s.exIndex + 1 }) }
    case 'SKIP_PRACTICE':
      if (s.variant !== 'optional') return s
      return { ...s, screen: 'next', skippedPractice: true, events: ev(s, 'practice_skipped') }
    case 'CONTINUE_STORY':
      return { ...s, screen: 'next', events: ev(s, 'next_episode_started') }
    case 'JUMP':
      return { ...s, screen: a.screen, exIndex: a.screen === 'practice' ? 0 : s.exIndex, lessonCoins: a.screen === 'practice' ? 0 : s.lessonCoins, events: ev(s, 'demo_jump', { to: a.screen }) }
    case 'JUMP_QUESTION':
      return { ...s, screen: 'practice', exIndex: a.index, events: ev(s, 'demo_jump', { to: 'question', index: a.index }) }
    case 'SET_VARIANT':
      return { ...s, variant: a.variant, events: ev(s, 'variant_changed', { variant: a.variant }) }
    case 'SET_SIA_VOICE':
      return { ...s, siaVoice: a.on }
    case 'RESET':
      return { ...initial, variant: s.variant, siaVoice: s.siaVoice, events: ev({ ...s, events: [] }, 'progress_reset') }
    case 'TRACK':
      return { ...s, events: ev(s, a.name, a.data) }
  }
}

function load(): State {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const saved = JSON.parse(raw) as Partial<State>
      // Always open on the start screen; keep coins, variant and history.
      return { ...initial, ...saved, screen: 'start', exIndex: 0, lessonCoins: 0, englishWatched: false }
    }
  } catch { /* ignore a damaged save */ }
  return initial
}

export function useJourney() {
  const [state, dispatch] = useReducer(reducer, undefined, load)
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* storage full or blocked */ }
  }, [state])
  return { state, dispatch }
}
