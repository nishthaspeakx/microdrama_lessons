import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, LayoutGroup, motion } from 'motion/react'
import type { Episode, Exercise, Moment, Option } from '../content'
import { listen, playClip, recognitionSupported, sharedAudio, speak, type HeardResult } from '../speech'
import { MicIcon } from './Start'
import { SpeakerIcon } from './Practice'

// Prototype 2's practice: every question happens inside a moment of the episode.
// The scene plays, freezes, Sia asks about it in her voice, the learner answers,
// and the scene plays again with the character saying the line in English.

type Phase = 'scene' | 'ask' | 'answer' | 'react' | 'reply' | 'done'
type Feedback = { ok: boolean; title: string; detail?: string; note?: string }

export function StoryPractice({ ep, index, lessonCoins, optional, onAnswered, onNext, onExit, onSkipAll, track }: {
  ep: Episode; index: number; lessonCoins: number; optional: boolean
  onAnswered: (correct: boolean, coins: number) => void; onNext: () => void; onExit: () => void; onSkipAll: () => void
  track: (name: string, data?: Record<string, unknown>) => void
}) {
  const ex = ep.exercises[index]
  const story = ex.story!
  const scene = ep.scenes[story.scene]
  const total = ep.exercises.length

  const [phase, setPhase] = useState<Phase>('scene')
  const [t, setT] = useState(0) // current time in the scene clip
  const [lang, setLang] = useState<'hi' | 'en'>(story.intro.lang)
  const [words, setWords] = useState(0) // how much of Sia's question is shown
  const [picked, setPicked] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [needTap, setNeedTap] = useState(false)
  const [burst, setBurst] = useState(0)

  const hi = useRef<HTMLVideoElement>(null)
  const en = useRef<HTMLVideoElement>(null)
  const raf = useRef(0)
  const stopAudio = useRef<() => void>(() => {})
  const pending = useRef<(() => void) | null>(null)
  const alive = useRef(true)
  const siaWords = story.sia.text.split(/\s+/)

  // ---- scene playback: play a moment of the clip, then hold its last frame ----
  const playMoment = (m: Moment, done: () => void) => {
    const v = m.lang === 'hi' ? hi.current : en.current
    const other = m.lang === 'hi' ? en.current : hi.current
    if (!v) return
    other?.pause()
    setLang(m.lang)
    cancelAnimationFrame(raf.current)
    v.currentTime = m.from
    const loop = () => {
      if (!alive.current) return
      setT(v.currentTime)
      if (v.currentTime >= m.to || v.ended) { v.pause(); v.currentTime = m.hold ?? Math.max(m.from, m.to - 0.05); done(); return }
      raf.current = requestAnimationFrame(loop)
    }
    v.play().then(() => { setNeedTap(false); raf.current = requestAnimationFrame(loop) })
      .catch(() => { pending.current = () => playMoment(m, done); setNeedTap(true) })
  }

  // ---- Sia asks: her recorded line, the words appear as she speaks ----
  const ask = () => {
    setPhase('ask')
    setWords(0)
    const a = sharedAudio()
    let shown = 0
    const reveal = () => {
      if (!alive.current) return
      const d = a.duration && isFinite(a.duration) ? a.duration : 5
      shown = Math.min(siaWords.length, Math.ceil((a.currentTime / (d * 0.92)) * siaWords.length))
      setWords(shown)
      if (!a.paused && !a.ended) raf.current = requestAnimationFrame(reveal)
    }
    stopAudio.current = playClip(story.sia.audio, () => { setWords(siaWords.length); setPhase('answer') })
    raf.current = requestAnimationFrame(reveal)
  }

  // ---- a question starts: the scene, then Sia ----
  useEffect(() => {
    alive.current = true
    setPhase('scene'); setPicked(null); setFeedback(null); setWords(0); setT(story.intro.from)
    const id = window.setTimeout(() => playMoment(story.intro, ask), 350)
    track('scene_question_started', { id: ex.id, scene: story.scene })
    return () => { alive.current = false; window.clearTimeout(id); cancelAnimationFrame(raf.current); stopAudio.current(); hi.current?.pause(); en.current?.pause() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index])

  const tapToPlay = () => {
    // A tap lets both clips play with sound on phones that block it otherwise.
    for (const v of [hi.current, en.current]) v?.play().then(() => v.pause()).catch(() => {})
    const p = pending.current; pending.current = null; p?.()
  }

  // ---- after an answer: Sia reacts, the character says the line in English, then the result ----
  const resolve = (ok: boolean, fb: Feedback) => {
    stopAudio.current()
    cancelAnimationFrame(raf.current)
    onAnswered(ok, ok ? ep.coinsPerCorrect : 0)
    if (ok) setBurst(b => b + 1)
    setPhase('react')
    stopAudio.current = playClip(ok ? story.siaCorrect : story.siaWrong, () => {
      setPhase('reply')
      playMoment(story.reply, () => { setPhase('done'); setFeedback(fb) })
    })
  }

  // Skip: no reaction, the result shows at once with the right answer, and the scene
  // still plays the line in English behind it so the story keeps going.
  const skip = () => {
    if (phase === 'react' || phase === 'reply' || phase === 'done') return
    track('question_skipped', { id: ex.id })
    stopAudio.current()
    cancelAnimationFrame(raf.current)
    onAnswered(false, 0)
    setPicked('__skipped__')
    setPhase('done')
    setFeedback({ ok: false, title: 'SKIPPED', detail: ex.type === 'speak' ? ex.sentence : ex.answer })
    playMoment(story.reply, () => {})
  }

  const choose = (o: Option) => {
    if (phase !== 'answer' && phase !== 'ask') return
    setPicked(o.text)
    track('scene_answer', { id: ex.id, answer: o.text, correct: !!o.correct })
    if (o.correct) resolve(true, { ok: true, title: 'FANTASTIC!' })
    else resolve(false, { ok: false, title: 'INCORRECT', detail: ex.type === 'speak' ? ex.sentence : ex.answer })
  }

  // ---- the line on the scene: a caption while it holds, the English subtitle while it replies ----
  const sub = (phase === 'reply' || phase === 'done' || phase === 'scene')
    ? (phase === 'scene' ? story.intro : story.reply).subs?.find(s => t >= s.from && t <= s.to)?.text
    : undefined
  const holdCaption = (phase === 'ask' || phase === 'answer') ? story.caption : undefined
  const correctText = ex.type === 'speak' ? ex.sentence : ex.options.find(o => o.correct)?.text
  const flying = (phase === 'react' || phase === 'reply' || phase === 'done') && ex.type !== 'speak'
  const flyText = picked && flying ? (ex.options.find(o => o.text === picked)?.correct ? picked : correctText) : null

  return (
    <LayoutGroup>
      <div className="lesson story-q">
        <header className="lesson-top">
          <button className="x" aria-label="Close lesson" onClick={onExit}>✕</button>
          <div className="filmstrip" aria-label={`Question ${index + 1} of ${total}`}>
            {ep.exercises.map((e, i) => (
              <span key={e.id} className={i < index || (i === index && feedback) ? 'done' : i === index ? 'now' : ''}>
                {i === index && <motion.i layoutId="strip-now" className="strip-now" transition={{ type: 'spring', stiffness: 380, damping: 32 }} />}
              </span>
            ))}
          </div>
          {ex.type !== 'speak' && !picked && (
            <motion.button className="q-skip" onClick={skip} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>Skip</motion.button>
          )}
          <span className="coins">
            <span className="coin">C</span>
            <motion.b key={lessonCoins} initial={{ scale: 1.5, color: '#FF4D00' }} animate={{ scale: 1, color: '#0A0B0F' }} transition={{ duration: 0.45 }}>{lessonCoins}</motion.b>
            <AnimatePresence>{burst > 0 && feedback?.ok !== false && phase !== 'scene' && (
              <motion.em key={burst} className="coin-pop" initial={{ y: 10, opacity: 0 }} animate={{ y: -18, opacity: [0, 1, 0] }} transition={{ duration: 1.1 }}>+{ep.coinsPerCorrect}</motion.em>
            )}</AnimatePresence>
          </span>
        </header>

        <main className="story-body">
          <motion.div
            key={ex.id}
            className={`scene-card ${ex.type === 'speak' ? 'small' : ''} ${story.role && (phase === 'ask' || phase === 'answer') ? 'spot' : ''}`}
            initial={{ opacity: 0, scale: 0.92, y: 14 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 26 }}
          >
            <video ref={hi} src={scene.hi} playsInline preload="auto" style={{ objectPosition: scene.focus, opacity: lang === 'hi' ? 1 : 0 }} />
            <video ref={en} src={scene.en} playsInline preload="auto" style={{ objectPosition: scene.focus, opacity: lang === 'en' ? 1 : 0 }} />
            <div className="scene-shade" />
            <motion.span className="scene-label" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>{scene.label}</motion.span>
            <AnimatePresence>
              {phase !== 'scene' && phase !== 'reply' && !needTap && (
                <motion.span key="freeze" className="freeze" aria-label="Paused" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><i /><i /></motion.span>
              )}
              {story.role && (phase === 'ask' || phase === 'answer') && (
                <motion.span key="role" className="role-chip" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>🎬 आप हैं {story.role}</motion.span>
              )}
            </AnimatePresence>
            <div className="scene-sub">
              <AnimatePresence mode="wait">
                {flyText && (phase === 'reply' || phase === 'done') && sub
                  ? <motion.p key="fly" layoutId={`opt-${flyText}`} className="sub en">{sub}</motion.p>
                  : sub
                    ? <motion.p key={sub} className={`sub ${lang}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>{sub}</motion.p>
                    : holdCaption
                      ? <motion.p key="cap" className="sub cap" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>{renderCaption(holdCaption)}</motion.p>
                      : null}
              </AnimatePresence>
            </div>
            {needTap && <button className="scene-tap" onClick={tapToPlay}><span className="play" />सीन देखें</button>}
          </motion.div>

          <AnimatePresence>
            {phase !== 'scene' && (
              <motion.div key="sia-ask" className="sia-ask" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 28 }}>
                <motion.div className="sia-ask-face" style={{ backgroundImage: `url(${ep.sia.face})` }} animate={phase === 'ask' ? { scale: [1, 1.06, 1] } : { scale: 1 }} transition={{ repeat: phase === 'ask' ? Infinity : 0, duration: 0.9 }} />
                <div className="sia-ask-bubble">
                  <p>{siaWords.map((w, i) => <motion.span key={i} initial={false} animate={{ opacity: i < words ? 1 : 0.18 }} transition={{ duration: 0.2 }}>{w} </motion.span>)}</p>
                  <button className="speaker sm" aria-label="Hear Sia again" onClick={() => { stopAudio.current(); stopAudio.current = playClip(story.sia.audio) }}><SpeakerIcon size={16} /></button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="story-answers">

            {ex.type === 'speak'
              ? <SpeakLine ex={ex} active={phase === 'answer' || phase === 'ask'} onDone={(ok, fb) => resolve(ok, fb)} onSkip={skip} track={track} />
              : (
                <AnimatePresence>
                  {(phase === 'answer' || phase === 'ask' && words >= siaWords.length * 0.6 || phase === 'react' || phase === 'reply' || phase === 'done') && ex.options.map((o, i) => {
                    const isPicked = picked === o.text
                    const flown = flyText === o.text && (phase === 'reply' || phase === 'done') && !!sub
                    const state = !picked ? '' : isPicked ? (o.correct ? 'right' : 'wrong') : o.correct ? 'reveal' : 'dim'
                    return (
                      <motion.button
                        key={o.text}
                        layoutId={flown ? undefined : `opt-${o.text}`}
                        className={`bubble ${state}`}
                        disabled={!!picked}
                        onClick={() => choose(o)}
                        initial={{ opacity: 0, y: 24, scale: 0.96 }}
                        animate={state === 'wrong' ? { opacity: 1, y: 0, scale: 1, x: [0, -9, 9, -6, 6, 0] } : { opacity: flown ? 0 : 1, y: 0, scale: 1 }}
                        transition={{ delay: picked ? 0 : 0.12 * i, type: 'spring', stiffness: 320, damping: 24 }}
                        whileTap={{ scale: 0.97 }}
                      >
                        <span className="q">“</span>{o.text}<span className="q">”</span>
                      </motion.button>
                    )
                  })}
                </AnimatePresence>
              )}
          </div>
        </main>

        {optional && !feedback && <button className="skip-all" onClick={onSkipAll}>Skip practice</button>}

        <AnimatePresence>
          {feedback && (
            <motion.footer key="sheet" className={`sheet ${feedback.ok ? 'good' : 'bad'}`} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', stiffness: 380, damping: 34 }} style={{ animation: 'none' }}>
              <div className="sheet-title"><span className="badge">{feedback.ok ? '✓' : '✕'}</span>{feedback.title}{feedback.ok && <span className="spark">✦</span>}</div>
              {feedback.detail && <div className="sheet-detail"><span>Correct Answer:</span><b>{feedback.detail}</b></div>}
              {feedback.note && <div className="sheet-note">{feedback.note}</div>}
              <button className="btn" onClick={onNext}>Continue</button>
            </motion.footer>
          )}
        </AnimatePresence>
      </div>
    </LayoutGroup>
  )
}

// "Mummy, where ___ you?" shows its blank as a slot on the scene.
function renderCaption(text: string) {
  const parts = text.split('___')
  return parts.length === 1 ? text : <>{parts[0]}<span className="slot" />{parts[1]}</>
}

// "Be the character": the line to say, a mic, and a skip.
function SpeakLine({ ex, active, onDone, onSkip, track }: {
  ex: Extract<Exercise, { type: 'speak' }>; active: boolean
  onDone: (ok: boolean, fb: Feedback) => void; onSkip: () => void; track: (name: string, data?: Record<string, unknown>) => void
}) {
  const [status, setStatus] = useState<'idle' | 'listening' | 'retry'>('idle')
  const [heard, setHeard] = useState<HeardResult | null>(null)
  const [locked, setLocked] = useState(false)
  const stopRef = useRef<() => void>(() => {})
  const supported = recognitionSupported()
  useEffect(() => () => stopRef.current(), [])

  const finish = (ok: boolean, fb: Feedback) => { setLocked(true); onDone(ok, fb) }
  const start = async () => {
    if (locked || status === 'listening') return
    track('speaking_attempted', { sentence: ex.sentence, recognition: supported })
    if (!supported) {
      setStatus('listening')
      window.setTimeout(() => finish(true, { ok: true, title: 'RECORDED', note: 'This browser cannot recognise speech, so your attempt was accepted without checking.' }), 2200)
      return
    }
    setStatus('listening')
    const l = listen(ex.sentence)
    stopRef.current = l.stop
    const r = await l.promise
    setHeard(r)
    if (r.passed) finish(true, { ok: true, title: 'FANTASTIC!', note: `We heard: “${r.transcript}”. Words matched; pronunciation is not scored in this demo.` })
    else setStatus('retry')
  }

  return (
    <motion.div className="line-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: active || locked ? 1 : 0.4, y: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 26 }}>
      <div className="line-text">
        <h2>{ex.sentence}</h2>
        <p>{ex.hindi}</p>
        <button className="speaker sm" aria-label="Hear the line" onClick={() => speak(ex.sentence, 'en-IN')}><SpeakerIcon size={16} /></button>
      </div>
      {status === 'retry' && heard && (
        <p className="heard">{heard.error === 'not-allowed' ? 'Microphone permission is blocked. Allow it in the browser and try again.' : heard.transcript ? <>We heard: “{heard.transcript}”. Try once more.</> : 'We could not hear you. Tap the mic and speak clearly.'}</p>
      )}
      {!locked && (
        <div className="line-mic">
          <motion.button className={`mic ${status === 'listening' ? 'live' : ''}`} aria-label="Tap to speak" onClick={start} disabled={!active} whileTap={{ scale: 0.92 }}>
            <MicIcon size={26} color={status === 'listening' ? '#fff' : '#3A3D4A'} />
          </motion.button>
          <span className="mic-hint">{status === 'listening' ? 'Listening… speak now' : status === 'retry' ? 'Tap to try again' : 'Tap and say the line'}</span>
          <button className="skip" onClick={() => { setLocked(true); stopRef.current(); onSkip() }}>Skip</button>
        </div>
      )}
    </motion.div>
  )
}
