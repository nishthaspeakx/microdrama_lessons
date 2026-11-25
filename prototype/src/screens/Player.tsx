import { useEffect, useRef, useState } from 'react'
import type { Episode } from '../content'

const fmt = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`

export function Player({ ep, src, english, onEnded, onExit }: { ep: Episode; src?: string; english?: boolean; onEnded: () => void; onExit: () => void }) {
  const ref = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  const [time, setTime] = useState(0)
  const [dur, setDur] = useState(0)
  const [chrome, setChrome] = useState(true)
  const hideTimer = useRef<number | undefined>(undefined)
  const ambient = useRef<HTMLCanvasElement>(null)
  const finished = useRef(false)
  const end = ep.videoEnd
  const finish = () => { if (!finished.current) { finished.current = true; onEnded() } }

  // Stop just before the black tail and cut straight to the next screen (checked every frame, so no black shows).
  useEffect(() => {
    let raf = 0
    const tick = () => {
      const v = ref.current
      if (v && !v.paused && v.currentTime >= end) { v.pause(); finish(); return }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    // Warm up the next screen's picture so it is ready at the cut.
    if (!src) { const img = new Image(); img.src = ep.cliffhanger.image }
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const wake = () => {
    setChrome(true)
    window.clearTimeout(hideTimer.current)
    hideTimer.current = window.setTimeout(() => setChrome(false), 2600)
  }

  useEffect(() => {
    const v = ref.current
    if (!v) return
    // The tap on "Watch Episode" is the user gesture, so sound is allowed.
    v.play().catch(() => { v.muted = true; setMuted(true); void v.play().catch(() => setChrome(true)) })
    wake()
    return () => window.clearTimeout(hideTimer.current)
  }, [])

  // Soft blurred copy of the picture behind the video, so the bars on tall phones are not flat black.
  useEffect(() => {
    const id = window.setInterval(() => {
      const v = ref.current, c = ambient.current
      if (!v || !c || v.readyState < 2) return
      try { c.getContext('2d')?.drawImage(v, 0, 0, c.width, c.height) } catch { /* drawing is cosmetic */ }
    }, 160)
    return () => window.clearInterval(id)
  }, [])

  const toggle = () => { const v = ref.current; if (!v) return; if (v.paused) void v.play(); else v.pause(); wake() }
  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const v = ref.current; if (!v || !dur) return
    const r = e.currentTarget.getBoundingClientRect()
    v.currentTime = Math.min(dur - 0.3, Math.max(0, ((e.clientX - r.left) / r.width) * dur)); wake()
  }

  return (
    <div className="story player" onClick={wake}>
      <canvas ref={ambient} className="player-ambient" width={36} height={64} aria-hidden="true" />
      <video
        ref={ref} src={src ?? ep.video} playsInline preload="auto"
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
        onTimeUpdate={e => setTime(Math.min(e.currentTarget.currentTime, end))}
        onLoadedMetadata={e => setDur(Math.min(e.currentTarget.duration, end))}
        onEnded={finish}
        onClick={e => { e.stopPropagation(); toggle() }}
      />
      <div className={`player-chrome ${chrome || !playing ? 'on' : ''}`}>
        <div className="player-top">
          <button className="icon-btn" aria-label="Close" onClick={e => { e.stopPropagation(); onExit() }}>✕</button>
          <div className="player-title"><b>{ep.series}</b><span>Episode {ep.number} · {english ? `${ep.titleEnglish} · English` : ep.title}</span></div>
          <button className="icon-btn" aria-label={muted ? 'Unmute' : 'Mute'} onClick={e => { e.stopPropagation(); const v = ref.current; if (v) { v.muted = !v.muted; setMuted(v.muted) } wake() }}>{muted ? '🔇' : '🔊'}</button>
        </div>
        {!playing && <button className="big-play" aria-label="Play" onClick={e => { e.stopPropagation(); toggle() }}><span /></button>}
        <div className="player-bottom" onClick={e => e.stopPropagation()}>
          <button className="icon-btn small" aria-label="Replay" onClick={() => { const v = ref.current; if (v) { v.currentTime = 0; void v.play() } wake() }}>↺</button>
          <span className="time">{fmt(time)}</span>
          <div className="scrub" onClick={seek}><div style={{ width: dur ? `${(time / dur) * 100}%` : 0 }} /></div>
          <span className="time">{fmt(dur)}</span>
        </div>
      </div>
    </div>
  )
}
