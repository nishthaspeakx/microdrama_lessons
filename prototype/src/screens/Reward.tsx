import { useEffect, useMemo, useState } from 'react'
import type { Episode } from '../content'

export function Reward({ ep, lessonCoins, totalCoins, onContinue, onClose }: { ep: Episode; lessonCoins: number; totalCoins: number; onContinue: () => void; onClose: () => void }) {
  const [step, setStep] = useState<'confetti' | 'summary'>('confetti')
  useEffect(() => { const t = window.setTimeout(() => setStep('summary'), 2400); return () => window.clearTimeout(t) }, [])
  const bits = useMemo(() => Array.from({ length: 46 }).map((_, i) => ({
    left: (i * 37) % 100, delay: (i % 12) * 0.12, dur: 2.2 + (i % 5) * 0.35, rot: (i * 47) % 360,
    color: ['#FF4D00', '#6F23D0', '#02A372', '#FFCB55', '#2F80ED', '#D83C3C'][i % 6], w: 6 + (i % 4) * 3,
  })), [])

  if (step === 'confetti') {
    return (
      <div className="lesson reward-confetti" onClick={() => setStep('summary')}>
        {bits.map((b, i) => <i key={i} className="bit" style={{ left: `${b.left}%`, width: b.w, height: b.w * 1.6, background: b.color, animationDelay: `${b.delay}s`, animationDuration: `${b.dur}s`, transform: `rotate(${b.rot}deg)` }} />)}
        <div className="congrats"><span>Congratulations!</span><p>You have successfully completed this Lesson</p></div>
      </div>
    )
  }
  const n = String(ep.sentencesLearnt).padStart(2, '0')
  return (
    <div className="lesson reward">
      <button className="x right" aria-label="Close" onClick={onClose}>✕</button>
      <div className="reward-head"><h2>Super job!</h2><p>You are doing really well</p></div>
      <div className="reward-card">
        <div className="big-num">{n}</div>
        <div className="caps">SENTENCES LEARNT</div>
        <div className="level"><span>Episode {ep.number}</span><span>Next: Episode {ep.next.number}</span></div>
        <div className="level-bar"><div style={{ width: `${(ep.number / ep.totalEpisodes) * 100}%` }} /></div>
        <p className="level-note"><b>{ep.rewardLine}</b></p>
      </div>
      <div className="ach">✦ YOUR ACHIEVEMENTS ✦</div>
      <div className="coin-card">
        <div><b>{lessonCoins} Coins</b><span>Earned in this lesson · Balance {totalCoins}</span></div>
        <div className="coin-stack" aria-hidden="true"><i /><i /><i /><i /></div>
      </div>
      <div className="grow" />
      <button className="btn primary" onClick={onContinue}>WATCH EPISODE {ep.next.number}</button>
    </div>
  )
}
