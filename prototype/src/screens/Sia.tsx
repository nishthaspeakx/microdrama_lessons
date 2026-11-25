import { useEffect, useRef, useState } from 'react'
import type { Episode } from '../content'

// Sia bridges the story into practice. She plays her lip-synced clip (or, if the clip is not
// there, her photo with the recorded voice), the lines light up in time, and the learner
// moves on with the button.
export function Sia({ ep, voiceOn, optional, onDone, onSkip }: { ep: Episode; voiceOn: boolean; optional: boolean; onDone: () => void; onSkip: () => void }) {
  const s = ep.sia
  const [useVideo, setUseVideo] = useState(!!s.video)
  const [t, setT] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [ended, setEnded] = useState(false)
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
        <div className="sia2-lines">
          {s.lines.map((l, i) => <p key={i} className={ended || i === line ? 'on' : i < line ? 'past' : ''}>{l.text}</p>)}
        </div>
        <button className={`cta ${ended ? 'ready' : ''}`} onClick={onDone}>{s.cta}</button>
        <div className="sia2-foot">
          {ended && <button className="link" onClick={play}>↻ Sia को फिर से सुनें</button>}
          {optional && <button className="link" onClick={onSkip}>Skip practice · Watch Episode {ep.next.number}</button>}
        </div>
      </div>
    </div>
  )
}
