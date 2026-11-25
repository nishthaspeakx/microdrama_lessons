import { useEffect, useMemo, useState } from 'react'
import type { Episode } from '../content'

// Lesson complete: coins and sentences earned, then the next episode's thumbnail, unlocked.
// This is the last screen of the prototype: until the next episode exists, its buttons show a short note.
export function Reward({ ep, lessonCoins, onContinue, onClose }: { ep: Episode; lessonCoins: number; totalCoins: number; onContinue: () => void; onClose: () => void }) {
  const [shown, setShown] = useState(0)
  const [soon, setSoon] = useState(false)
  const go = () => {
    onContinue()
    if (!ep.next.available) { setSoon(true); window.setTimeout(() => setSoon(false), 2600) }
  }
  useEffect(() => {
    if (lessonCoins <= 0) return
    const start = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const k = Math.min(1, (now - start - 350) / 900)
      setShown(k <= 0 ? 0 : Math.round(lessonCoins * (1 - Math.pow(1 - k, 3))))
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [lessonCoins])
  const bits = useMemo(() => Array.from({ length: 40 }).map((_, i) => ({
    left: (i * 37) % 100, delay: (i % 10) * 0.09, dur: 2.1 + (i % 5) * 0.3, rot: (i * 47) % 360,
    color: ['#FF4D00', '#FFCB55', '#02A372', '#6F23D0', '#2F80ED', '#FFFFFF'][i % 6], w: 5 + (i % 4) * 2.5,
  })), [])
  const n = ep.sentencesLearnt

  return (
    <div className="story reward2">
      <div className="reward2-confetti" aria-hidden="true">
        {bits.map((b, i) => <i key={i} className="bit" style={{ left: `${b.left}%`, width: b.w, height: b.w * 1.6, background: b.color, animationDelay: `${b.delay}s`, animationDuration: `${b.dur}s`, transform: `rotate(${b.rot}deg)` }} />)}
      </div>
      <button className="reward2-x" aria-label="Close" onClick={onClose}>✕</button>

      <div className="reward2-head">
        <TrophyIcon />
        <h2>Well done!</h2>
        {lessonCoins > 0 && <div className="reward2-coins"><span className="coin" />+{shown} coins</div>}
        <p>{n} new English {n === 1 ? 'sentence' : 'sentences'}</p>
      </div>

      <button className="ep-card" onClick={go} aria-label={`Watch Episode ${ep.next.number}`}>
        <img src={ep.next.thumbnail} alt="" />
        <span className="ep-card-shade" />
        <span className="ep-card-badge"><LockOpenIcon />Unlocked</span>
        <span className="ep-card-play"><i /></span>
        <span className="ep-card-text">
          <span className="chip">EPISODE {ep.next.number}</span>
          <b>{ep.next.title}</b>
          <em>{ep.next.titleEnglish}</em>
        </span>
      </button>

      {soon && <div className="toast" role="status">Episode {ep.next.number} is coming soon</div>}
      <div className="reward2-foot">
        <p>Episode {ep.next.number} unlocked</p>
        <button className="cta" onClick={go}><span className="play" />Watch next episode</button>
      </div>
    </div>
  )
}

function TrophyIcon() {
  return (
    <svg className="trophy" width="46" height="46" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path d="M14 8h20v10a10 10 0 0 1-20 0V8Z" fill="#FFCB55" stroke="#E0A21F" strokeWidth="2" strokeLinejoin="round" />
      <path d="M14 11H8v3a7 7 0 0 0 7 7M34 11h6v3a7 7 0 0 1-7 7" stroke="#E0A21F" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M24 28v6" stroke="#E0A21F" strokeWidth="3" strokeLinecap="round" />
      <rect x="15" y="34" width="18" height="6" rx="2" fill="#FFCB55" stroke="#E0A21F" strokeWidth="2" />
      <path d="M20 12v6a4 4 0 0 0 2 3.4" stroke="#FFF3CF" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function LockOpenIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="11" width="16" height="10" rx="2.5" fill="currentColor" stroke="none" />
      <path d="M8 11V7a4 4 0 0 1 7.6-1.7" />
    </svg>
  )
}
