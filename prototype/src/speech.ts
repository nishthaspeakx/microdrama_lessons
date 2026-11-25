// Speech helpers. Recorded clips in Sia's voice play where they exist; browser text-to-speech is the fallback
// for any line without a recording. Speech recognition checks the words that were said;
// it does not score pronunciation.

type SR = {
  lang: string; interimResults: boolean; maxAlternatives: number; continuous: boolean
  start(): void; stop(): void; abort(): void
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
}

function pickVoice(lang: string): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis?.getVoices() ?? []
  const exact = voices.filter(v => v.lang === lang)
  const prefix = voices.filter(v => v.lang.startsWith(lang.split('-')[0]))
  const prefer = (list: SpeechSynthesisVoice[]) => list.find(v => /google|natural|premium|enhanced/i.test(v.name)) ?? list[0]
  return prefer(exact) ?? prefer(prefix)
}

// Recorded lines in Sia's voice, keyed by the exact text passed to speak().
// Anything without a recording falls back to the browser's voice.
const clips = new Map<string, string>()
let playing: HTMLAudioElement | null = null
export function setVoiceClips(map: Record<string, string>) {
  clips.clear()
  Object.entries(map).forEach(([text, src]) => clips.set(text, src))
}

export const ttsSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window

/** Speak text. Calls onEnd when the audio really finishes (or after an estimate if speech is unavailable). */
export function speak(text: string, lang: string, onEnd?: () => void, rate = 0.95): () => void {
  let done = false
  const finish = () => { if (!done) { done = true; onEnd?.() } }
  const estimate = Math.max(1400, text.length * 85)
  playing?.pause()
  playing = null
  const clip = clips.get(text)
  if (clip) {
    window.speechSynthesis?.cancel()
    const a = new Audio(clip)
    playing = a
    a.onended = finish
    a.onerror = finish
    a.play().catch(finish)
    return () => { a.pause(); done = true }
  }
  if (!ttsSupported()) {
    const t = window.setTimeout(finish, estimate)
    return () => { window.clearTimeout(t); done = true }
  }
  const synth = window.speechSynthesis
  synth.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = lang
  u.rate = rate
  const v = pickVoice(lang)
  if (v) u.voice = v
  u.onend = finish
  u.onerror = finish
  // Safety net: some browsers never fire onend.
  const guard = window.setTimeout(finish, estimate * 2 + 2500)
  synth.speak(u)
  return () => { window.clearTimeout(guard); done = true; synth.cancel() }
}

export function recognitionSupported(): boolean {
  const w = window as unknown as Record<string, unknown>
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition)
}

export type HeardResult = { supported: boolean; transcript: string; match: number; passed: boolean; error?: string }

const norm = (s: string) => s.toLowerCase().replace(/[^a-z' ]/g, ' ').replace(/\s+/g, ' ').trim()

/** Share of the expected words that were heard, 0 to 1. */
export function wordMatch(expected: string, heard: string): number {
  const want = norm(expected).split(' ').filter(Boolean)
  const got = new Set(norm(heard).replace(/do not/g, "don't").split(' '))
  if (!want.length) return 0
  return want.filter(w => got.has(w) || got.has(w.replace("'", ''))).length / want.length
}

/** Listen once for an English sentence. Resolves when the browser stops listening. */
export function listen(expected: string, onStart?: () => void): { promise: Promise<HeardResult>; stop: () => void } {
  const w = window as unknown as Record<string, new () => SR>
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition
  if (!Ctor) {
    return { promise: Promise.resolve({ supported: false, transcript: '', match: 0, passed: false }), stop: () => {} }
  }
  const rec = new Ctor()
  rec.lang = 'en-IN'
  rec.interimResults = false
  rec.maxAlternatives = 3
  rec.continuous = false
  let best = ''
  let bestMatch = 0
  let error: string | undefined
  const promise = new Promise<HeardResult>(resolve => {
    rec.onresult = e => {
      const alts = e.results[0]
      for (let i = 0; i < alts.length; i++) {
        const m = wordMatch(expected, alts[i].transcript)
        if (m >= bestMatch) { bestMatch = m; best = alts[i].transcript }
      }
    }
    rec.onerror = e => { error = e.error }
    rec.onend = () => resolve({ supported: true, transcript: best, match: bestMatch, passed: bestMatch >= 0.66, error })
    try { rec.start(); onStart?.() } catch { resolve({ supported: true, transcript: '', match: 0, passed: false, error: 'start-failed' }) }
  })
  return { promise, stop: () => { try { rec.stop() } catch { /* already stopped */ } } }
}

/** A soft low swell for the cliffhanger. Returns a stop function. */
export function suspenseTone(seconds: number): () => void {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + seconds * 0.6)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + seconds)
    gain.connect(ctx.destination)
    const oscs = [55, 82.4, 110.5].map(f => {
      const o = ctx.createOscillator()
      o.type = 'sine'
      o.frequency.value = f
      o.connect(gain)
      o.start()
      o.stop(ctx.currentTime + seconds)
      return o
    })
    return () => { oscs.forEach(o => { try { o.stop() } catch { /* ended */ } }); void ctx.close() }
  } catch { return () => {} }
}
