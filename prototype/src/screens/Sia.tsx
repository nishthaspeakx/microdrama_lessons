import { useEffect, useRef, useState } from 'react'
import type { SiaScene } from '../content'

export type SiaAction = { label: string; onClick: () => void; kind?: 'primary' | 'secondary'; icon?: 'play' | 'mic' }

// Sia speaks to the learner. She plays her lip-synced clip (or, if the clip is not there, her photo
// with the recorded voice), the lines light up in time, and the learner moves on with a button.
// Prototype 1 shows one button (practice); prototype 2 shows two (English video, practice).
export function Sia({ scene, actions, voiceOn, autoplay = true, footer }: { scene: SiaScene; actions: SiaAction[]; voiceOn: boolean; autoplay?: boolean; footer?: React.ReactNode }) {
  const s = scene
  const [useVideo, setUseVideo] = useState(!!s.video)
  const [t, setT] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [ended, setEnded] = useState(!autoplay)
  const [blocked, setBlocked] = useState(false)
  const vid = useRef<HTMLVideoElement>(null)
  const aud = useRef<HTMLAudioElement>(null)
  const media = () => (useVideo ? vid.current : aud.current)

  const play = () => {
    const m = media()
    if (!m) return
    m.currentTime = 0
    setEnded(false)
    m.play().then(() => setBlocked(false)).catch(() => setBlocked(true))
  }

  useEffect(() => {
    if (!autoplay) return
    const id = window.setTimeout(play, 400)
    return () => { window.clearTimeout(id); media()?.pause() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useVideo])

  const line = s.lines.reduce((acc, l, i) => (t >= l.at ? i : acc), 0)
  const handlers = {
    onTimeUpdate: (e: React.SyntheticEvent<HTMLMediaElement>) => setT(e.currentTarget.currentTime),
    onPlay: () => setPlaying(true),
    onPause: () => setPlaying(false),
    onEnded: () => { setPlaying(false); setEnded(true) },
  }

  return (
    <div className="sia2">
      <div className="sia2-media">
        {useVideo
          ? <video ref={vid} src={s.video} poster={s.poster} playsInline preload="auto" muted={!voiceOn} onError={() => setUseVideo(false)} {...handlers} />
          : <>
              <img className={playing ? 'talking' : ''} src={s.poster} alt="Sia" />
              {s.audio && <audio ref={aud} src={s.audio} preload="auto" muted={!voiceOn} {...handlers} />}
            </>}
        <div className="sia2-top"><div className="brand ink">Speak<i>X</i></div></div>
        {blocked && <button className="sia2-tap" onClick={play}><span className="play" />Tap to hear Sia</button>}
      </div>
      <div className="sia2-sheet">
        <div className="sia2-who">
          <div><b>Sia</b><span>आपकी English coach</span></div>
          <div className={`sia-wave ${playing ? '' : 'idle'}`} aria-hidden="true">{Array.from({ length: 12 }).map((_, i) => <i key={i} style={{ animationDelay: `${i * 0.07}s` }} />)}</div>
        </div>
        <div className={`sia2-lines ${actions.length > 1 ? 'compact' : ''}`}>
          {s.lines.map((l, i) => <p key={i} className={ended || i === line ? 'on' : i < line ? 'past' : ''}>{l.text}</p>)}
        </div>
        <div className={`sia2-actions n${actions.length}`}>
          {actions.map(a => (
            <button key={a.label} className={`cta ${a.kind === 'secondary' ? 'alt' : ''} ${ended && a.kind !== 'secondary' ? 'ready' : ''}`} onClick={a.onClick}>
              {a.icon === 'play' && <span className="play" />}
              {a.icon === 'mic' && <MicGlyph />}
              {a.label}
            </button>
          ))}
        </div>
        <div className="sia2-foot">
          {ended && <button className="link" onClick={play}>↻ Sia को फिर से सुनें</button>}
          {footer}
        </div>
      </div>
    </div>
  )
}

function MicGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" stroke="none" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  )
}
