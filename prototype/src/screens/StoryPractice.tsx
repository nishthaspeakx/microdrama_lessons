import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, LayoutGroup, motion } from 'motion/react'
import type { Episode, Exercise, Moment, Option, SiaLine } from '../content'
import { listen, playClip, recognitionSupported, sharedAudio, speak, type HeardResult } from '../speech'
import { MicIcon } from './Start'
import { SpeakerIcon } from './Practice'

// Prototype 2's practice plays as one continuous scene that Sia guides.
// No Continue or Next: the learner only answers. After each answer Sia reacts, the
// character says the line in English, and Sia goes straight on to the next question.
// The scene card, Sia and the answer area stay on screen the whole time.

type Phase = 'intro' | 'ask' | 'answer' | 'feedback'

export function StoryPractice({ ep, index, lessonCoins, optional, onAnswered, onNext, onExit, onSkipAll, track }: {
  ep: Episode; index: number; lessonCoins: number; optional: boolean
  onAnswered: (correct: boolean, coins: number) => void; onNext: () => void; onExit: () => void; onSkipAll: () => void
  track: (name: string, data?: Record<string, unknown>) => void
}) {
  const ex = ep.exercises[index]
  const story = ex.story!
  const total = ep.exercises.length
  const last = index === total - 1

  const [q, setQ] = useState<{ i: number; phase: Phase; result: 'right' | 'wrong' | null; picked: string | null }>({ i: index, phase: 'intro', result: null, picked: null })
  const own = q.i === index
  const phase: Phase = own ? q.phase : (story.intro ? 'intro' : 'ask')
  const result = own ? q.result : null
  const picked = own ? q.picked : null
  const setPhase = (ph: Phase) => setQ(s => ({ ...s, i: index, phase: ph }))
  const setResult = (r: 'right' | 'wrong' | null) => setQ(s => ({ ...s, i: index, result: r }))
  const setPicked = (p: string | null) => setQ(s => ({ ...s, i: index, picked: p }))
  const [view, setView] = useState<{ scene: string; lang: 'hi' | 'en' }>({ scene: story.scene, lang: story.intro?.lang ?? 'hi' })
  const [moment, setMoment] = useState<Moment | null>(null) // the stretch now playing (for its subtitles)
  const [t, setT] = useState(0)
  const [line, setLine] = useState<SiaLine | null>(null) // what Sia is saying now
  const [words, setWords] = useState(0)
  const [needTap, setNeedTap] = useState(false)
  const [burst, setBurst] = useState(0)

  const videos = useRef<Record<string, HTMLVideoElement | null>>({})
  const raf = useRef(0)
  const stopAudio = useRef<() => void>(() => {})
  const pending = useRef<(() => void) | null>(null)
  const alive = useRef(true)
  const sceneKeys = Object.keys(ep.scenes)

  // ---- the scene: play a stretch of a clip, then hold a frame ----
  const playMoment = (m: Moment, done: () => void) => {
    const key = `${story.scene}-${m.lang}`
    const v = videos.current[key]
    if (!v) return
    Object.entries(videos.current).forEach(([k, o]) => { if (k !== key) o?.pause() })
    setView({ scene: story.scene, lang: m.lang })
    setMoment(m)
    cancelAnimationFrame(raf.current)
    v.currentTime = m.from
    const loop = () => {
      if (!alive.current) return
      setT(v.currentTime)
      if (v.currentTime >= m.to || v.ended) { v.pause(); v.currentTime = m.hold ?? Math.max(m.from, m.to - 0.05); setMoment(null); done(); return }
      raf.current = requestAnimationFrame(loop)
    }
    v.play().then(() => { setNeedTap(false); raf.current = requestAnimationFrame(loop) })
      .catch(() => { pending.current = () => playMoment(m, done); setNeedTap(true) })
  }

  // ---- Sia speaks a line; her words light up as she says them ----
  const say = (l: SiaLine, done?: () => void) => {
    setLine(l)
    setWords(0)
    const n = l.text.split(/\s+/).length
    const a = sharedAudio()
    const reveal = () => {
      if (!alive.current) return
      const d = a.duration && isFinite(a.duration) ? a.duration : 4
      setWords(Math.min(n, Math.ceil((a.currentTime / (d * 0.9)) * n)))
      if (!a.paused && !a.ended) requestAnimationFrame(reveal)
    }
    stopAudio.current = playClip(l.audio, () => { setWords(n); done?.() })
    requestAnimationFrame(reveal)
  }

  // ---- each question: (the scene, if it is new) then Sia asks ----
  useEffect(() => {
    alive.current = true
    setQ({ i: index, phase: story.intro ? 'intro' : 'ask', result: null, picked: null })
    const ask = () => { setPhase('ask'); say(story.sia, () => setPhase('answer')) }
    const start = () => { if (story.intro) playMoment(story.intro, ask); else ask() }
    const id = window.setTimeout(start, index === 0 ? 300 : 0)
    track('scene_question_started', { id: ex.id, scene: story.scene })
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index])

  // stop everything when practice ends or the learner leaves
  useEffect(() => () => {
    alive.current = false
    cancelAnimationFrame(raf.current)
    stopAudio.current()
    Object.values(videos.current).forEach(v => v?.pause())
  }, [])

  const tapToPlay = () => {
    // A tap lets the clips play with sound on phones that block it otherwise.
    Object.values(videos.current).forEach(v => v?.play().then(() => v.pause()).catch(() => {}))
    const p = pending.current; pending.current = null; p?.()
  }

  // ---- after an answer: Sia reacts, the character says it in English, and the next question follows ----
  const goOn = () => (last ? say(ep.practiceOutro, onNext) : onNext())
  const resolve = (ok: boolean) => {
    stopAudio.current()
    cancelAnimationFrame(raf.current)
    onAnswered(ok, ok ? ep.coinsPerCorrect : 0)
    setResult(ok ? 'right' : 'wrong')
    setPhase('feedback')
    if (ok) { setBurst(b => b + 1); playMoment(story.reply, () => say(story.praise, goOn)) }
    else say(story.wrong, () => playMoment(story.reply, goOn))
  }

  const choose = (o: Option) => {
    if (phase !== 'answer' && phase !== 'ask') return
    setPicked(o.text)
    track('scene_answer', { id: ex.id, answer: o.text, correct: !!o.correct })
    resolve(!!o.correct)
  }
  const skip = () => {
    if (phase === 'feedback') return
    track('question_skipped', { id: ex.id })
    setPicked('__skipped__')
    resolve(false)
  }

  // ---- what shows on the scene ----
  const sub = moment?.subs?.find(s => t >= s.from && t <= s.to)?.text
  const holdCaption = !moment && (phase === 'ask' || phase === 'answer') ? story.caption : undefined
  const correctText = ex.type === 'speak' ? ex.sentence : ex.options.find(o => o.correct)?.text
  const replying = phase === 'feedback' && moment === story.reply
  const flyText = ex.type !== 'speak' && replying && picked ? (ex.options.find(o => o.text === picked)?.correct ? picked : correctText) : null
  const askWords = story.sia.text.split(/\s+/).length
  const showOptions = ex.type !== 'speak' && (phase === 'answer' || (phase === 'feedback' && picked !== null) || (phase === 'ask' && line === story.sia && words >= askWords * 0.6))
  const lineWords = line ? line.text.split(/\s+/) : []

  return (
    <LayoutGroup>
      <div className="lesson story-q">
        <header className="lesson-top">
          <button className="x" aria-label="Close lesson" onClick={onExit}>✕</button>
          <div className="filmstrip" aria-label={`Question ${index + 1} of ${total}`}>
            {ep.exercises.map((e, i) => (
              <span key={e.id} className={i < index || (i === index && result) ? 'done' : i === index ? 'now' : ''}>
                {i === index && !result && <motion.i layoutId="strip-now" className="strip-now" transition={{ type: 'spring', stiffness: 380, damping: 32 }} />}
              </span>
            ))}
          </div>
          <motion.button className="q-skip" onClick={skip} disabled={phase === 'feedback'} animate={{ opacity: phase === 'feedback' ? 0.35 : 1 }}>Skip</motion.button>
          <span className="coins">
            <span className="coin">C</span>
            <motion.b key={lessonCoins} initial={{ scale: 1.5, color: '#FF4D00' }} animate={{ scale: 1, color: '#0A0B0F' }} transition={{ duration: 0.45 }}>{lessonCoins}</motion.b>
            <AnimatePresence>{burst > 0 && result === 'right' && (
              <motion.em key={burst} className="coin-pop" initial={{ y: 10, opacity: 0 }} animate={{ y: -18, opacity: [0, 1, 0] }} transition={{ duration: 1.1 }}>+{ep.coinsPerCorrect}</motion.em>
            )}</AnimatePresence>
          </span>
        </header>

        <main className="story-body">
          {/* One scene card for all six questions: the clips cross-fade, nothing reloads. */}
          <div className={`scene-card ${ex.type === 'speak' ? 'small' : ''} ${story.role && (phase === 'ask' || phase === 'answer') ? 'spot' : ''}`}>
            {sceneKeys.flatMap(k => (['hi', 'en'] as const).map(lang => (
              <video
                key={`${k}-${lang}`}
                ref={el => { videos.current[`${k}-${lang}`] = el }}
                src={ep.scenes[k][lang]} playsInline preload="auto"
                style={{ objectPosition: ep.scenes[k].focus, opacity: view.scene === k && view.lang === lang ? 1 : 0 }}
              />
            )))}
            <div className="scene-shade" />
            <AnimatePresence mode="wait">
              <motion.span key={ep.scenes[story.scene].label} className="scene-label" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>{ep.scenes[story.scene].label}</motion.span>
            </AnimatePresence>
            <AnimatePresence>
              {story.role && (phase === 'ask' || phase === 'answer') && (
                <motion.span key="role" className="role-chip" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>🎬 आप हैं {story.role}</motion.span>
              )}
            </AnimatePresence>
            <div className="scene-sub">
              <AnimatePresence mode="wait">
                {flyText && sub
                  ? <motion.p key="fly" layoutId={`opt-${ex.id}-${flyText}`} className="sub en">{sub}</motion.p>
                  : sub
                    ? <motion.p key={sub} className={`sub ${view.lang}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>{sub}</motion.p>
                    : holdCaption
                      ? <motion.p key={`cap-${ex.id}`} className="sub cap" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>{renderCaption(holdCaption)}</motion.p>
                      : null}
              </AnimatePresence>
            </div>
            {needTap && <button className="scene-tap" onClick={tapToPlay}><span className="play" />सीन देखें</button>}
          </div>

          {/* Sia stays beside the scene; only her words change. */}
          <AnimatePresence>
            {line && (
              <motion.div key="sia-ask" className="sia-ask" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 28 }}>
                <div className={`sia-ask-face ${words < lineWords.length ? 'talking' : ''}`} style={{ backgroundImage: `url(${ep.sia.face})` }} />
                <div className={`sia-ask-bubble ${line === story.praise ? 'good' : ''}`}>
                  <AnimatePresence mode="wait">
                    <motion.p key={line.text} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.18 }}>
                      {lineWords.map((w, i) => <span key={i} style={{ opacity: i < words ? 1 : 0.2, transition: 'opacity .2s' }}>{w} </span>)}
                    </motion.p>
                  </AnimatePresence>
                  <button className="speaker sm" aria-label="Hear Sia again" onClick={() => { if (phase === 'answer') { stopAudio.current(); say(story.sia, () => {}) } }}><SpeakerIcon size={16} /></button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="story-answers">
            <AnimatePresence mode="popLayout">
              {ex.type === 'speak'
                ? <SpeakLine key={ex.id} ex={ex} active={phase === 'answer' || phase === 'ask'} done={phase === 'feedback'} ok={result === 'right'} onPass={() => resolve(true)} onSkip={skip} track={track} />
                : showOptions && ex.options.map((o, i) => {
                    const isPicked = picked === o.text
                    const flown = flyText === o.text && !!sub
                    const state = !picked ? '' : isPicked ? (o.correct ? 'right' : 'wrong') : o.correct ? 'reveal' : 'dim'
                    return (
                      <motion.button
                        key={`${ex.id}-${o.text}`}
                        layoutId={flown ? undefined : `opt-${ex.id}-${o.text}`}
                        className={`bubble ${state}`}
                        disabled={!!picked}
                        onClick={() => choose(o)}
                        initial={{ opacity: 0, y: 24, scale: 0.96 }}
                        animate={state === 'wrong' ? { opacity: 1, y: 0, scale: 1, x: [0, -9, 9, -6, 6, 0] } : { opacity: flown ? 0 : 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, transition: { duration: 0.2 } }}
                        transition={{ delay: picked ? 0 : 0.1 * i, type: 'spring', stiffness: 320, damping: 24 }}
                        whileTap={{ scale: 0.97 }}
                      >
                        <span className="q">“</span>{o.text}<span className="q">”</span>
                      </motion.button>
                    )
                  })}
            </AnimatePresence>
          </div>
        </main>

        {optional && phase !== 'feedback' && <button className="skip-all" onClick={onSkipAll}>Skip practice</button>}
      </div>
    </LayoutGroup>
  )
}

// "Mummy, where ___ you?" shows its blank as a slot on the scene.
function renderCaption(text: string) {
  const parts = text.split('___')
  return parts.length === 1 ? text : <>{parts[0]}<span className="slot" />{parts[1]}</>
}

// "Be the character": the line to say and a mic. Skip is also in the top bar.
function SpeakLine({ ex, active, done, ok, onPass, onSkip, track }: {
  ex: Extract<Exercise, { type: 'speak' }>; active: boolean; done: boolean; ok: boolean
  onPass: () => void; onSkip: () => void; track: (name: string, data?: Record<string, unknown>) => void
}) {
  const [status, setStatus] = useState<'idle' | 'listening' | 'retry'>('idle')
  const [heard, setHeard] = useState<HeardResult | null>(null)
  const stopRef = useRef<() => void>(() => {})
  const supported = recognitionSupported()
  useEffect(() => () => stopRef.current(), [])

  const start = async () => {
    if (done || status === 'listening') return
    track('speaking_attempted', { sentence: ex.sentence, recognition: supported })
    setStatus('listening')
    if (!supported) { window.setTimeout(onPass, 1800); return } // no speech check in this browser: accept the attempt
    const l = listen(ex.sentence)
    stopRef.current = l.stop
    const r = await l.promise
    setHeard(r)
    if (r.passed) onPass()
    else setStatus('retry')
  }

  return (
    <motion.div className={`line-card ${done ? (ok ? 'good' : 'bad') : ''}`} initial={{ opacity: 0, y: 20 }} animate={{ opacity: active || done ? 1 : 0.45, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ type: 'spring', stiffness: 300, damping: 26 }}>
      <div className="line-text">
        <h2>{ex.sentence}</h2>
        <p>{ex.hindi}</p>
        <button className="speaker sm" aria-label="Hear the line" onClick={() => speak(ex.sentence, 'en-IN')}><SpeakerIcon size={16} /></button>
      </div>
      {status === 'retry' && heard && !done && (
        <p className="heard">{heard.error === 'not-allowed' ? 'Microphone is blocked. Allow it in the browser, or tap Skip.' : heard.transcript ? <>We heard: “{heard.transcript}”. Try once more.</> : 'We could not hear you. Tap the mic and speak clearly.'}</p>
      )}
      {!done && (
        <div className="line-mic">
          <motion.button className={`mic ${status === 'listening' ? 'live' : ''}`} aria-label="Tap to speak" onClick={start} disabled={!active} whileTap={{ scale: 0.92 }}>
            <MicIcon size={26} color={status === 'listening' ? '#fff' : '#3A3D4A'} />
          </motion.button>
          <span className="mic-hint">{status === 'listening' ? 'Listening… speak now' : status === 'retry' ? 'Tap to try again' : 'Tap and say the line'}</span>
          <button className="skip" onClick={() => { stopRef.current(); onSkip() }}>Skip</button>
        </div>
      )}
    </motion.div>
  )
}
