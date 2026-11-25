import { useEffect, useState } from 'react'
import type { Episode } from '../content'
import { suspenseTone } from '../speech'

// The question card that follows the episode: the boy, his glowing eyes and chest mark,
// two lines of text timed to the voice-over, then an automatic hand-off to Sia.
export function Cliffhanger({ ep, voiceOn, onDone }: { ep: Episode; voiceOn: boolean; onDone: () => void }) {
  const c = ep.cliffhanger
  const [shown, setShown] = useState(0)

  useEffect(() => {
    let finished = false
    const timers: number[] = []
    const finish = () => { if (!finished) { finished = true; onDone() } }
    const lead = 650 // let the picture land before the voice starts
    const stopTone = suspenseTone(c.holdMs / 1000)
    const audio = c.audio && voiceOn ? new Audio(c.audio) : null
    c.lines.forEach((l, i) => timers.push(window.setTimeout(() => setShown(i + 1), lead + l.at * 1000)))
    if (audio) {
      audio.onended = () => timers.push(window.setTimeout(finish, 1300))
      timers.push(window.setTimeout(() => { audio.play().catch(() => { /* autoplay blocked: the timer below still moves on */ }) }, lead))
    }
    timers.push(window.setTimeout(finish, c.holdMs + (audio ? 1500 : 0)))
    return () => { finished = true; timers.forEach(t => window.clearTimeout(t)); stopTone(); audio?.pause() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="story cliff">
      <div className="cliff-stage">
        <div className="cliff-frame" style={{ backgroundImage: `url(${c.image})` }}>
          <i className="glow eye l" /><i className="glow eye r" /><i className="glow chest" />
        </div>
      </div>
      <div className="cliff-shade" />
      <div className="cliff-text">
        <div className="cliff-kicker">{ep.series} · Episode {ep.number}</div>
        {c.lines.map((l, i) => (
          <p key={i} className={`cliff-q ${i === 0 ? 'big' : 'small'} ${shown > i ? 'in' : ''}`}>{l.text}</p>
        ))}
      </div>
      <div className="cliff-bar"><div style={{ animationDuration: `${c.holdMs}ms` }} /></div>
    </div>
  )
}
