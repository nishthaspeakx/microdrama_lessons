import { useEffect, useRef, useState } from 'react'
import type { Episode, Exercise, Option } from '../content'
import { listen, recognitionSupported, speak, type HeardResult } from '../speech'
import { MicIcon } from './Start'

type Feedback = { ok: boolean; title: string; detail?: string; note?: string } | null

export function Practice({ ep, index, lessonCoins, optional, onAnswered, onNext, onExit, onSkipAll, track }: {
  ep: Episode; index: number; lessonCoins: number; optional: boolean
  onAnswered: (correct: boolean, coins: number) => void; onNext: () => void; onExit: () => void; onSkipAll: () => void
  track: (name: string, data?: Record<string, unknown>) => void
}) {
  const ex = ep.exercises[index]
  const total = ep.exercises.length
  const [feedback, setFeedback] = useState<Feedback>(null)
  const [picked, setPicked] = useState<string | null>(null)

  useEffect(() => { setFeedback(null); setPicked(null) }, [index])

  const settle = (ok: boolean, fb: NonNullable<Feedback>) => {
    setFeedback(fb)
    onAnswered(ok, ok ? ep.coinsPerCorrect : 0)
  }

  const choose = (o: Option, answer: string) => {
    if (feedback) return
    setPicked(o.text)
    if (o.correct) { settle(true, { ok: true, title: 'FANTASTIC!' }); speak(answer, 'en-IN') }
    else settle(false, { ok: false, title: 'INCORRECT', detail: answer })
  }

  return (
    <div className="lesson">
      <header className="lesson-top">
        <button className="x" aria-label="Close lesson" onClick={onExit}>✕</button>
        <div className="progress"><div style={{ width: `${((index + (feedback ? 1 : 0.15)) / total) * 100}%` }} /></div>
        <span className="translate" aria-hidden="true">A<small>अ</small></span>
        <span className="coins"><span className="coin">C</span>{lessonCoins}</span>
      </header>

      <main className="lesson-body" key={ex.id}>
        {ex.type === 'speak'
          ? <Speak ex={ex} face={ep.sia.face} locked={!!feedback} onResult={(ok, fb) => settle(ok, fb)} track={track} />
          : <Choice ex={ex} picked={picked} locked={!!feedback} onPick={o => choose(o, ex.answer)} />}
      </main>

      {optional && !feedback && <button className="skip-all" onClick={onSkipAll}>Skip practice</button>}

      {feedback && (
        <footer className={`sheet ${feedback.ok ? 'good' : 'bad'}`}>
          <div className="sheet-title"><span className="badge">{feedback.ok ? '✓' : '✕'}</span>{feedback.title}{feedback.ok && <span className="spark">✦</span>}</div>
          {feedback.detail && <div className="sheet-detail"><span>Correct Answer:</span><b>{feedback.detail}</b></div>}
          {feedback.note && <div className="sheet-note">{feedback.note}</div>}
          <button className="btn" onClick={onNext}>Continue</button>
        </footer>
      )}
    </div>
  )
}

function Choice({ ex, picked, locked, onPick }: { ex: Extract<Exercise, { type: 'mcq' | 'blank' }>; picked: string | null; locked: boolean; onPick: (o: Option) => void }) {
  const say = () => ex.type === 'mcq'
    ? speak(ex.promptAudio?.text ?? ex.prompt, ex.promptAudio?.lang ?? 'hi-IN')
    : speak(ex.answer, 'en-IN')
  return (
    <>
      <div className="scene"><img src={ex.image} alt="Scene from the episode" /></div>
      <div className="question">
        <div className="q-text">
          {ex.type === 'mcq'
            ? <h2>{ex.prompt}</h2>
            : <><h2>{ex.before} <span className="blank">____</span> {ex.after}</h2><p>{ex.hindi}</p></>}
        </div>
        <button className="speaker" aria-label="Listen" onClick={say}><SpeakerIcon /></button>
      </div>
      <div className="options">
        {ex.options.map(o => {
          const state = !locked || picked !== o.text ? (locked && o.correct && picked !== o.text ? 'reveal' : '') : o.correct ? 'right' : 'wrong'
          return <button key={o.text} className={`option ${state}`} disabled={locked} onClick={() => onPick(o)}>{o.text}</button>
        })}
      </div>
    </>
  )
}

function Speak({ ex, face, locked, onResult, track }: {
  ex: Extract<Exercise, { type: 'speak' }>; face: string; locked: boolean
  onResult: (ok: boolean, fb: NonNullable<Feedback>) => void; track: (name: string, data?: Record<string, unknown>) => void
}) {
  const [status, setStatus] = useState<'idle' | 'listening' | 'retry'>('idle')
  const [heard, setHeard] = useState<HeardResult | null>(null)
  const stopRef = useRef<() => void>(() => {})
  const supported = recognitionSupported()

  useEffect(() => { const c = speak(ex.sentence, 'en-IN'); return () => { c(); stopRef.current() } }, [ex.sentence])

  const start = async () => {
    if (locked || status === 'listening') return
    window.speechSynthesis?.cancel()
    track('speaking_attempted', { sentence: ex.sentence, recognition: supported })
    if (!supported) {
      // No speech recognition in this browser: accept the attempt and say so plainly.
      setStatus('listening')
      window.setTimeout(() => onResult(true, { ok: true, title: 'RECORDED', note: 'Speech check is simulated here. This browser cannot recognise speech, so your attempt was accepted without checking.' }), 2600)
      return
    }
    setStatus('listening')
    const l = listen(ex.sentence)
    stopRef.current = l.stop
    const r = await l.promise
    setHeard(r)
    if (r.passed) onResult(true, { ok: true, title: 'FANTASTIC!', note: `We heard: “${r.transcript}”. Words matched, pronunciation is not scored in this demo.` })
    else setStatus('retry')
  }

  return (
    <div className="speak">
      <p className="speak-title">{ex.title}</p>
      <button className="speaker big" aria-label="Listen to the sentence" onClick={() => speak(ex.sentence, 'en-IN')}><SpeakerIcon size={30} /></button>
      <div className="avatar" style={{ backgroundImage: `url(${face})` }} />
      <div className="say-card"><h2>{ex.sentence}</h2><hr /><p>{ex.hindi}</p></div>
      {status === 'retry' && heard && (
        <p className="heard">{heard.error === 'not-allowed' ? 'Microphone permission is blocked. Allow it in the browser and try again.' : heard.transcript ? <>We heard: “{heard.transcript}”. Try once more.</> : 'We could not hear you. Tap the mic and speak clearly.'}</p>
      )}
      {!locked && (
        <div className="mic-row">
          <button className={`mic ${status === 'listening' ? 'live' : ''}`} aria-label="Tap to speak" onClick={start}><MicIcon size={26} color={status === 'listening' ? '#fff' : '#3A3D4A'} /></button>
          <button className="skip" onClick={() => onResult(false, { ok: false, title: 'SKIPPED', detail: ex.sentence })}>Skip</button>
          <span className="mic-hint">{status === 'listening' ? 'Listening… speak now' : status === 'retry' ? 'Tap to try again' : 'Tap to speak'}</span>
        </div>
      )}
    </div>
  )
}

export function SpeakerIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 9.5v5h3.2l4.3 3.6V5.9L7.2 9.5H4z" fill="#fff" />
      <path d="M15 9.2v5.6M18 7.4v9.2" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" opacity=".85" />
    </svg>
  )
}
